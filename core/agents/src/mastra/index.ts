import { Mastra } from "@mastra/core/mastra";
import { RequestContext } from "@mastra/core/request-context";
import { Observability } from "@mastra/observability";
import { PostgresStore } from "@mastra/pg";
import { PosthogExporter } from "@mastra/posthog";
import type { DatabaseInstance } from "@core/database/client";
import { env as serverEnv } from "@core/environment/web";
import type { ModelId } from "@core/agents/models";
import { rubiAgent } from "@core/agents/mastra/agents/rubi-agent";
import { workspace } from "@core/agents/mastra/workspace-instance";
export type { RequestContext };

export type CustomRequestContext = {
   userId: string;
   teamId?: string;
   organizationId?: string;
   memberId?: string;
   db?: DatabaseInstance;
   model?: ModelId;
   language?: string;
   temperature?: number;
   topP?: number;
   maxTokens?: number;
   frequencyPenalty?: number;
   presencePenalty?: number;
   thinkingBudget?: number;
};

const mastraStorage = new PostgresStore({
   id: "mastra-storage",
   connectionString: serverEnv.DATABASE_URL,
   schemaName: "mastra",
});

const observability = new Observability({
   configs: {
      posthog: {
         serviceName: "montte-agents",
         exporters: [
            new PosthogExporter({
               apiKey: serverEnv.POSTHOG_KEY,
               host: serverEnv.POSTHOG_HOST,
               defaultDistinctId: "system",
            }),
         ],
      },
   },
});

export const mastra: Mastra = new Mastra({
   agents: {
      rubiAgent,
   },
   vectors: {},
   storage: mastraStorage,
   workspace,
   observability,
});

export function createRequestContext(context: CustomRequestContext) {
   const requestContext = new RequestContext<CustomRequestContext>();
   requestContext.set("userId", context.userId);

   if (context.teamId) {
      requestContext.set("teamId", context.teamId);
   }
   if (context.organizationId) {
      requestContext.set("organizationId", context.organizationId);
   }
   if (context.memberId) {
      requestContext.set("memberId", context.memberId);
   }
   if (context.db) {
      requestContext.set("db", context.db);
   }
   if (context.model) {
      requestContext.set("model", context.model);
   }
   if (context.temperature !== undefined) {
      requestContext.set("temperature", context.temperature);
   }
   if (context.topP !== undefined) {
      requestContext.set("topP", context.topP);
   }
   if (context.maxTokens !== undefined) {
      requestContext.set("maxTokens", context.maxTokens);
   }
   if (context.frequencyPenalty !== undefined) {
      requestContext.set("frequencyPenalty", context.frequencyPenalty);
   }
   if (context.presencePenalty !== undefined) {
      requestContext.set("presencePenalty", context.presencePenalty);
   }
   if (context.thinkingBudget !== undefined && context.thinkingBudget > 0) {
      requestContext.set("thinkingBudget", context.thinkingBudget);
   }
   if (context.language) {
      requestContext.set("language", context.language);
   }
   return requestContext;
}

export * from "@mastra/ai-sdk";
export { handleWorkflowStream } from "@mastra/ai-sdk";
