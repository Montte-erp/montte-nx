import dayjs from "dayjs";
import { DBOS } from "@dbos-inc/dbos-sdk";
import { chat } from "@tanstack/ai";
import { openRouterText } from "@tanstack/ai-openrouter";
import { z } from "zod";
import { updateCategory } from "@core/database/repositories/categories-repository";
import { emitAiKeywordDerived } from "@packages/events/ai";
import { createEmitFn } from "@packages/events/emit";
import { enforceCreditBudget } from "@packages/events/credits";
import { NOTIFICATION_TYPES } from "@packages/notifications/types";
import type { JobNotification } from "@packages/notifications/schema";
import { jobPublisher } from "@/integrations/dbos/publisher";
import { db, redis, posthog, stripeClient } from "@/integrations/singletons";

const MODEL = "google/gemini-3.1-flash-lite-preview";

const keywordsOutputSchema = z.object({
   keywords: z
      .array(z.string().min(1).max(60))
      .min(1)
      .max(20)
      .describe(
         "Lista de palavras-chave financeiras para categorização de transações",
      ),
});

export type DeriveKeywordsInput = {
   categoryId: string;
   teamId: string;
   organizationId: string;
   name: string;
   description?: string | null;
   userId?: string;
   stripeCustomerId?: string | null;
};

export class DeriveKeywordsWorkflow {
   @DBOS.workflow()
   static async run(input: DeriveKeywordsInput) {
      const ctx = `[derive-keywords] category=${input.categoryId} team=${input.teamId}`;

      const failNotification = (error: string): JobNotification => ({
         jobId: crypto.randomUUID(),
         type: NOTIFICATION_TYPES.AI_KEYWORD_DERIVED,
         status: "failed",
         message: error,
         teamId: input.teamId,
         timestamp: dayjs().toISOString(),
      });

      DBOS.logger.info(`${ctx} started name="${input.name}"`);

      await DeriveKeywordsWorkflow.publishStep({
         jobId: crypto.randomUUID(),
         type: NOTIFICATION_TYPES.AI_KEYWORD_DERIVED,
         status: "started",
         message: `Gerando palavras-chave para ${input.name}...`,
         teamId: input.teamId,
         timestamp: dayjs().toISOString(),
      });

      try {
         await DeriveKeywordsWorkflow.enforceBudgetStep(input);
      } catch (e) {
         const msg = e instanceof Error ? e.message : String(e);
         DBOS.logger.warn(`${ctx} budget exceeded: ${msg}`);
         await DeriveKeywordsWorkflow.publishStep(failNotification(msg));
         return;
      }

      let keywords: string[];
      try {
         keywords = await DeriveKeywordsWorkflow.deriveStep(input);
         DBOS.logger.info(
            `${ctx} derived ${keywords.length} keywords: [${keywords.join(", ")}]`,
         );
      } catch (e) {
         const msg = e instanceof Error ? e.message : String(e);
         DBOS.logger.error(`${ctx} derive failed: ${msg}`);
         await DeriveKeywordsWorkflow.publishStep(failNotification(msg));
         return;
      }

      try {
         await DeriveKeywordsWorkflow.saveStep({
            categoryId: input.categoryId,
            keywords,
         });
         DBOS.logger.info(`${ctx} saved`);
      } catch (e) {
         const msg = e instanceof Error ? e.message : String(e);
         DBOS.logger.error(`${ctx} save failed: ${msg}`);
         await DeriveKeywordsWorkflow.publishStep(failNotification(msg));
         return;
      }

      await DeriveKeywordsWorkflow.emitBillingStep({ input, keywords });
      await DeriveKeywordsWorkflow.publishStep({
         jobId: crypto.randomUUID(),
         type: NOTIFICATION_TYPES.AI_KEYWORD_DERIVED,
         status: "completed",
         message: `Palavras-chave geradas para ${input.name}.`,
         payload: {
            categoryId: input.categoryId,
            categoryName: input.name,
            count: keywords.length,
         },
         teamId: input.teamId,
         timestamp: dayjs().toISOString(),
      });

      DBOS.logger.info(`${ctx} completed`);
   }

   @DBOS.step()
   static async enforceBudgetStep(input: DeriveKeywordsInput) {
      DBOS.logger.debug(
         `[derive-keywords] enforceBudgetStep org=${input.organizationId}`,
      );
      await enforceCreditBudget(
         input.organizationId,
         "ai.keyword_derived",
         redis,
         input.stripeCustomerId,
      );
   }

   @DBOS.step()
   static async deriveStep(input: DeriveKeywordsInput) {
      DBOS.logger.debug(
         `[derive-keywords] deriveStep model=${MODEL} name="${input.name}"`,
      );
      const result = await chat({
         adapter: openRouterText(MODEL),
         messages: [
            {
               role: "user",
               content: [
                  {
                     type: "text",
                     content: `Você é um assistente financeiro brasileiro. Gere palavras-chave para a categoria financeira abaixo. As palavras-chave devem ser termos comuns que aparecem em descrições de transações bancárias.

Categoria: ${input.name}${input.description ? `\nDescrição: ${input.description}` : ""}

Retorne entre 5 e 15 palavras-chave relevantes em português brasileiro. Inclua variações, abreviações e termos relacionados.`,
                  },
               ],
            },
         ],
         outputSchema: keywordsOutputSchema,
         stream: false,
      });
      return result.keywords;
   }

   @DBOS.step()
   static async saveStep({
      categoryId,
      keywords,
   }: {
      categoryId: string;
      keywords: string[];
   }) {
      DBOS.logger.debug(
         `[derive-keywords] saveStep category=${categoryId} count=${keywords.length}`,
      );
      const result = await updateCategory(db, categoryId, { keywords });
      if (result.isErr()) throw result.error;
   }

   @DBOS.step()
   static async emitBillingStep({
      input,
      keywords,
   }: {
      input: DeriveKeywordsInput;
      keywords: string[];
   }) {
      DBOS.logger.debug(
         `[derive-keywords] emitBillingStep category=${input.categoryId}`,
      );
      const emit = createEmitFn(
         db,
         posthog,
         stripeClient,
         input.stripeCustomerId ?? undefined,
         redis,
      );
      await emitAiKeywordDerived(
         emit,
         {
            organizationId: input.organizationId,
            teamId: input.teamId,
            userId: input.userId,
         },
         {
            categoryId: input.categoryId,
            keywordCount: keywords.length,
            model: MODEL,
            latencyMs: 0,
         },
      );
   }

   @DBOS.step()
   static async publishStep(notification: JobNotification) {
      DBOS.logger.debug(
         `[derive-keywords] publishStep status=${notification.status} team=${notification.teamId}`,
      );
      await jobPublisher.publish("job.notification", notification);
   }
}
