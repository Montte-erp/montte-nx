import type { ToolCall } from "@tanstack/ai";
import type { DatabaseInstance } from "@core/database/client";
import type { Prompts } from "@core/posthog/server";
import { proModel } from "@core/ai/models";
import { RUBI_PROMPTS } from "../../constants";
import {
   buildAllSkillTools,
   buildSkillCatalog,
   buildSkillDiscoverTool,
} from "./skills";
import type { ChatMessage, PageContext } from "../../contracts/chat";

export interface RubiChatOptions {
   db: DatabaseInstance;
   prompts: Prompts;
   teamId: string;
   userId: string;
   organizationId: string;
   messages: ChatMessage[];
   pageContext: PageContext;
   abortSignal?: AbortSignal;
}

function formatPageContext(pageContext: PageContext): string {
   if (!pageContext) return "Nenhum contexto de página fornecido.";
   const lines: string[] = [];
   if (pageContext.skillHint)
      lines.push(
         `Skill sugerida pelo usuário: \`${pageContext.skillHint}\`. Chame skill_discover com esse skillId antes de responder, a menos que o pedido claramente esteja fora do domínio dela.`,
      );
   if (pageContext.route) lines.push(`Rota: ${pageContext.route}`);
   if (pageContext.title) lines.push(`Título: ${pageContext.title}`);
   if (pageContext.summary) lines.push(`Resumo: ${pageContext.summary}`);
   return lines.length === 0
      ? "Nenhum contexto de página fornecido."
      : lines.join("\n");
}

export async function buildRubiChatArgs(options: RubiChatOptions) {
   const skillTools = buildAllSkillTools({
      db: options.db,
      teamId: options.teamId,
   });
   const skillDiscoverTool = buildSkillDiscoverTool({
      prompts: options.prompts,
   });

   const rootTemplate = await options.prompts.get(RUBI_PROMPTS.root, {
      fallback:
         "Você é Rubi, a assistente de IA do Montte. Responda em pt-BR de forma direta e amigável.",
   });
   const systemPrompt = options.prompts.compile(rootTemplate, {
      skill_catalog: buildSkillCatalog(),
      page_context: formatPageContext(options.pageContext),
   });

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
      tools: [skillDiscoverTool, ...skillTools],
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
