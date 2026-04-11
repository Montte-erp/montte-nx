import { DBOS } from "@dbos-inc/dbos-sdk";
import { ResultAsync } from "neverthrow";
import { AppError } from "@core/logging/errors";
import { chat } from "@tanstack/ai";
import { openRouterText } from "@tanstack/ai-openrouter";
import { z } from "zod";
import { env } from "@core/environment/server";
import { updateCategory } from "@core/database/repositories/categories-repository";
import { emitAiKeywordDerived } from "@packages/events/ai";
import { createEmitFn } from "@packages/events/emit";
import { enforceCreditBudget } from "@packages/events/credits";
import { NOTIFICATION_TYPES } from "@packages/notifications/types";
import type { JobNotification } from "@packages/notifications/schema";
import { jobPublisher } from "../publisher";
import { db, redis, posthog, stripeClient } from "../singletons";

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
      const budgetResult =
         await DeriveKeywordsWorkflow.enforceBudgetStep(input);

      if (budgetResult.isErr()) {
         await DeriveKeywordsWorkflow.publishStep({
            jobId: crypto.randomUUID(),
            type: NOTIFICATION_TYPES.AI_KEYWORD_DERIVED,
            status: "failed",
            error: budgetResult.error.message,
            teamId: input.teamId,
            timestamp: new Date().toISOString(),
         });
         return;
      }

      const deriveResult = await DeriveKeywordsWorkflow.deriveStep(input);

      if (deriveResult.isErr()) {
         await DeriveKeywordsWorkflow.publishStep({
            jobId: crypto.randomUUID(),
            type: NOTIFICATION_TYPES.AI_KEYWORD_DERIVED,
            status: "failed",
            error: deriveResult.error.message,
            teamId: input.teamId,
            timestamp: new Date().toISOString(),
         });
         return;
      }

      const keywords = deriveResult.value;
      const saveResult = await DeriveKeywordsWorkflow.saveStep({
         categoryId: input.categoryId,
         keywords,
      });
      if (saveResult.isErr()) {
         await DeriveKeywordsWorkflow.publishStep({
            jobId: crypto.randomUUID(),
            type: NOTIFICATION_TYPES.AI_KEYWORD_DERIVED,
            status: "failed",
            error: saveResult.error.message,
            teamId: input.teamId,
            timestamp: new Date().toISOString(),
         });
         return;
      }
      await DeriveKeywordsWorkflow.emitBillingStep({ input, keywords });
      await DeriveKeywordsWorkflow.publishStep({
         jobId: crypto.randomUUID(),
         type: NOTIFICATION_TYPES.AI_KEYWORD_DERIVED,
         status: "completed",
         payload: {
            categoryId: input.categoryId,
            categoryName: input.name,
            count: keywords.length,
         },
         teamId: input.teamId,
         timestamp: new Date().toISOString(),
      });
   }

   @DBOS.step()
   static async enforceBudgetStep(input: DeriveKeywordsInput) {
      return ResultAsync.fromPromise(
         enforceCreditBudget(
            input.organizationId,
            "ai.keyword_derived",
            redis,
            input.stripeCustomerId,
         ),
         () =>
            AppError.forbidden(
               "Free tier limit exceeded for ai.keyword_derived",
            ),
      );
   }

   @DBOS.step()
   static async deriveStep(input: DeriveKeywordsInput) {
      return ResultAsync.fromPromise(
         chat({
            adapter: openRouterText("liquid/lfm2-8b-a1b", {
               apiKey: env.OPENROUTER_API_KEY,
            }),
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
         }).then((r) => r.keywords),
         (e) => AppError.internal(`LLM derivation failed: ${String(e)}`),
      );
   }

   @DBOS.step()
   static async saveStep({
      categoryId,
      keywords,
   }: {
      categoryId: string;
      keywords: string[];
   }) {
      return ResultAsync.fromPromise(
         updateCategory(db, categoryId, { keywords }),
         (e) => AppError.internal(`Failed to save keywords: ${String(e)}`),
      );
   }

   @DBOS.step()
   static async emitBillingStep({
      input,
      keywords,
   }: {
      input: DeriveKeywordsInput;
      keywords: string[];
   }) {
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
            model: "liquid/lfm2-8b",
            latencyMs: 0,
         },
      );
   }

   @DBOS.step()
   static async publishStep(notification: JobNotification) {
      await jobPublisher.publish("job.notification", notification);
   }
}
