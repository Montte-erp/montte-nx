import type { ToolCall } from "@tanstack/ai";
import type { DatabaseInstance } from "@core/database/client";
import { proModel } from "@core/ai/models";
import { buildServiceTools } from "./tools/services";
import { buildSystemPrompt } from "./system-prompt";
import type { ChatMessage, PageContext } from "../../contracts/chat";

export interface RubiChatOptions {
   db: DatabaseInstance;
   teamId: string;
   userId: string;
   organizationId: string;
   messages: ChatMessage[];
   pageContext: PageContext;
   abortSignal?: AbortSignal;
}

export function buildRubiChatArgs(options: RubiChatOptions) {
   const tools = buildServiceTools({ db: options.db, teamId: options.teamId });
   const systemPrompt = buildSystemPrompt(options.pageContext);

   return {
      adapter: proModel,
      systemPrompts: [systemPrompt],
      messages: options.messages.map((m) => ({
         role: m.role,
         content: m.content,
         toolCalls: m.toolCalls?.map<ToolCall>((tc) => ({
            id: tc.id,
            type: "function",
            function: { name: tc.name, arguments: tc.arguments },
         })),
         toolCallId: m.toolCallId,
      })),
      tools,
      abortController: options.abortSignal
         ? abortControllerFromSignal(options.abortSignal)
         : undefined,
   };
}

function abortControllerFromSignal(signal: AbortSignal) {
   const controller = new AbortController();
   if (signal.aborted) controller.abort();
   else
      signal.addEventListener("abort", () => controller.abort(), {
         once: true,
      });
   return controller;
}
