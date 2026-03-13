import { Mastra } from "@mastra/core/mastra";
import { RequestContext } from "@mastra/core/request-context";
import type { DatabaseInstance } from "@core/database/client";
import type { ModelId } from "../models";
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
export declare const mastra: Mastra;
export declare function createRequestContext(
   context: CustomRequestContext,
): RequestContext<CustomRequestContext>;
export * from "@mastra/ai-sdk";
export { handleWorkflowStream } from "@mastra/ai-sdk";
//# sourceMappingURL=index.d.ts.map
