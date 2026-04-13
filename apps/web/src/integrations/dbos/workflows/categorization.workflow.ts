import { DBOS } from "@dbos-inc/dbos-sdk";
import { chat } from "@tanstack/ai";
import { openRouterText } from "@tanstack/ai-openrouter";
import { z } from "zod";
import {
   findCategoryByKeywords,
   listCategories,
} from "@core/database/repositories/categories-repository";
import { updateTransactionCategory } from "@core/database/repositories/transactions-repository";
import { NOTIFICATION_TYPES } from "@packages/notifications/types";
import type { JobNotification } from "@packages/notifications/schema";
import { jobPublisher } from "@/integrations/dbos/publisher";
import { db } from "@/integrations/singletons";

export type CategorizationInput = {
   transactionId: string;
   teamId: string;
   name: string;
   type: "income" | "expense";
   contactName?: string | null;
};

const MODEL = "google/gemini-3.1-flash-lite-preview";

const outputSchema = z.object({
   categoryName: z.string().nullable(),
   confidence: z.enum(["high", "low"]),
});

export class CategorizationWorkflow {
   @DBOS.workflow()
   static async run(input: CategorizationInput) {
      const ctx = `[categorization] tx=${input.transactionId} team=${input.teamId}`;

      const failNotification = (error: string): JobNotification => ({
         jobId: crypto.randomUUID(),
         type: NOTIFICATION_TYPES.AI_TRANSACTION_CATEGORIZED,
         status: "failed",
         message: error,
         teamId: input.teamId,
         timestamp: new Date().toISOString(),
      });

      DBOS.logger.info(`${ctx} started name="${input.name}"`);

      await CategorizationWorkflow.publishStep({
         jobId: crypto.randomUUID(),
         type: NOTIFICATION_TYPES.AI_TRANSACTION_CATEGORIZED,
         status: "started",
         message: `Categorizando transação "${input.name}"...`,
         teamId: input.teamId,
         timestamp: new Date().toISOString(),
      });

      let keywordMatch: { id: string } | null;
      try {
         keywordMatch = await CategorizationWorkflow.matchKeywordsStep(input);
      } catch (e) {
         const msg = e instanceof Error ? e.message : String(e);
         DBOS.logger.error(`${ctx} keyword match failed: ${msg}`);
         await CategorizationWorkflow.publishStep(failNotification(msg));
         return;
      }

      if (keywordMatch) {
         await CategorizationWorkflow.applyStep(input.transactionId, {
            categoryId: keywordMatch.id,
         });
         await CategorizationWorkflow.publishStep({
            jobId: crypto.randomUUID(),
            type: NOTIFICATION_TYPES.AI_TRANSACTION_CATEGORIZED,
            status: "completed",
            message: `Transação "${input.name}" categorizada.`,
            payload: { transactionId: input.transactionId },
            teamId: input.teamId,
            timestamp: new Date().toISOString(),
         });
         DBOS.logger.info(`${ctx} completed via keyword match`);
         return;
      }

      let aiResult: { categoryId: string; confidence: "high" | "low" } | null;
      try {
         aiResult = await CategorizationWorkflow.inferWithAIStep(input);
      } catch (e) {
         const msg = e instanceof Error ? e.message : String(e);
         DBOS.logger.error(`${ctx} AI inference failed: ${msg}`);
         await CategorizationWorkflow.publishStep(failNotification(msg));
         return;
      }

      if (!aiResult) {
         DBOS.logger.info(`${ctx} no category match found`);
         return;
      }

      await CategorizationWorkflow.applyStep(
         input.transactionId,
         aiResult.confidence === "high"
            ? { categoryId: aiResult.categoryId }
            : { suggestedCategoryId: aiResult.categoryId },
      );

      await CategorizationWorkflow.publishStep({
         jobId: crypto.randomUUID(),
         type: NOTIFICATION_TYPES.AI_TRANSACTION_CATEGORIZED,
         status: "completed",
         message: `Transação "${input.name}" categorizada.`,
         payload: { transactionId: input.transactionId },
         teamId: input.teamId,
         timestamp: new Date().toISOString(),
      });

      DBOS.logger.info(`${ctx} completed via AI inference`);
   }

   @DBOS.step()
   static async matchKeywordsStep(
      input: Pick<CategorizationInput, "teamId" | "name" | "type">,
   ): Promise<{ id: string } | null> {
      return findCategoryByKeywords(db, input.teamId, {
         name: input.name,
         type: input.type,
      });
   }

   @DBOS.step()
   static async inferWithAIStep(
      input: CategorizationInput,
   ): Promise<{ categoryId: string; confidence: "high" | "low" } | null> {
      const cats = await listCategories(db, input.teamId, {
         type: input.type,
         includeArchived: false,
      });
      if (cats.length === 0) return null;

      const categoryList = cats
         .map(
            (c) =>
               `- ${c.name}${c.keywords?.length ? ` (palavras: ${c.keywords.join(", ")})` : ""}`,
         )
         .join("\n");

      const prompt = `Você é um assistente financeiro brasileiro. Classifique a transação abaixo na categoria mais adequada.

Transação:
- Nome: ${input.name}${input.contactName ? `\n- Contato: ${input.contactName}` : ""}
- Tipo: ${input.type === "income" ? "Receita" : "Despesa"}

Categorias disponíveis:
${categoryList}

Retorne o nome exato de uma categoria da lista acima, ou null se nenhuma for adequada.
Se tiver certeza, retorne confidence "high". Se estiver em dúvida, retorne "low".`;

      const result = await chat({
         adapter: openRouterText(MODEL),
         messages: [
            { role: "user", content: [{ type: "text", content: prompt }] },
         ],
         outputSchema,
         stream: false,
      });

      if (!result.categoryName) return null;

      const match = cats.find((c) => c.name === result.categoryName);
      if (!match) return null;

      return { categoryId: match.id, confidence: result.confidence };
   }

   @DBOS.step()
   static async applyStep(
      transactionId: string,
      data: { categoryId?: string; suggestedCategoryId?: string },
   ) {
      await updateTransactionCategory(db, transactionId, data);
   }

   @DBOS.step()
   static async publishStep(notification: JobNotification) {
      DBOS.logger.debug(
         `[categorization] publishStep status=${notification.status} team=${notification.teamId}`,
      );
      await jobPublisher.publish("job.notification", notification);
   }
}
