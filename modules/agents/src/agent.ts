import {
   chat,
   convertMessagesToModelMessages,
   maxIterations,
   type ChatMiddleware,
   type UIMessage,
} from "@tanstack/ai";
import type { Prompts } from "@core/posthog/server";
import { flashModel } from "@core/ai/models";
import { createAiObservabilityMiddleware } from "@core/ai/middleware";
import { AGENT_PROMPTS, type PageContext } from "@modules/agents/constants";
import { buildSkillCatalog } from "@modules/agents/skills";
import { buildAdvisorTool } from "@modules/agents/tools/advisor";

export interface AgentChatOptions {
   prompts: Prompts;
   userId: string;
   organizationId: string;
   teamId: string;
   headers: Headers;
   request: Request;
   threadId?: string;
   messages: UIMessage[];
   pageContext?: PageContext;
   reasoningEffort?: "high" | "xhigh";
   abortSignal?: AbortSignal;
   extraMiddleware?: ChatMiddleware[];
}

const RENDERING_PRIMER = `## Renderização (json-render)

Toda tool de leitura/escrita retorna um campo \`ui\` com um spec json-render que o cliente renderiza usando shadcn. Você nunca precisa formatar a saída em markdown — o spec já mostra a tabela/alert/card.

Não duplique a informação em texto. Após uma tool call, escreva no máximo 1-2 frases curtas conectando o resultado à próxima ação. Nunca repita tabela, contagem ou nomes que o spec já mostra.

Vocabulário disponível no catalog: Card, Stack, Grid, Separator, Heading, Text, Badge, Alert, Table, Accordion, Collapsible, Tabs, Progress, Skeleton, Spinner, Avatar, Image, Link, Tooltip.`;

function formatPageContext(pageContext: PageContext | undefined): string {
   if (pageContext === undefined) return "Nenhum contexto de página fornecido.";
   const lines: string[] = [];
   if (pageContext.route) lines.push(`Rota: ${pageContext.route}`);
   if (pageContext.title) lines.push(`Título: ${pageContext.title}`);
   if (pageContext.summary) lines.push(`Resumo: ${pageContext.summary}`);
   return lines.length === 0
      ? "Nenhum contexto de página fornecido."
      : lines.join("\n");
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

async function buildAgentChatArgs(options: AgentChatOptions) {
   const turnId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
   const tools = [
      buildAdvisorTool({
         prompts: options.prompts,
         distinctId: options.userId,
         organizationId: options.organizationId,
         teamId: options.teamId,
         threadId: options.threadId,
         turnId,
      }),
   ];

   const rootTemplate = await options.prompts.get(AGENT_PROMPTS.root, {
      withMetadata: false,
   });
   const systemPrompt = options.prompts.compile(rootTemplate, {
      skill_catalog: buildSkillCatalog(),
      page_context: formatPageContext(options.pageContext),
   });

   return {
      adapter: flashModel,
      systemPrompts: [systemPrompt, RENDERING_PRIMER],
      messages: convertMessagesToModelMessages(options.messages),
      tools,
      modelOptions: {
         reasoning: { effort: options.reasoningEffort ?? "high" },
         parallelToolCalls: false,
      },
      agentLoopStrategy: maxIterations(8),
      ...(options.threadId && { conversationId: options.threadId }),
      abortController: options.abortSignal
         ? abortControllerFromSignal(options.abortSignal)
         : undefined,
      middleware: [
         createAiObservabilityMiddleware({
            distinctId: options.userId,
            organizationId: options.organizationId,
            teamId: options.teamId,
            conversationId: options.threadId,
            promptName: AGENT_PROMPTS.root,
            customProperties: {
               agent_role: "executor",
               agent_organization_id: options.organizationId,
               agent_team_id: options.teamId,
               ...(options.threadId && { agent_thread_id: options.threadId }),
               agent_turn_id: turnId,
               ...(options.pageContext?.skillHint && {
                  agent_skill: options.pageContext.skillHint,
               }),
            },
         }),
         ...(options.extraMiddleware ?? []),
      ],
   };
}

export async function createAgentChat(options: AgentChatOptions) {
   return chat(await buildAgentChatArgs(options));
}
