import {
   chat,
   convertMessagesToModelMessages,
   maxIterations,
   type ChatMiddleware,
   type UIMessage,
} from "@tanstack/ai";
import { otelMiddleware } from "@tanstack/ai/middlewares/otel";
import { defineErrorCatalog } from "evlog";
import { Result, TaggedError } from "better-result";
import type { Prompts } from "@core/posthog/server";
import { flashModel } from "@core/ai/models";
import { aiTraceAttributes } from "@core/ai/otel";
import { getAiTracer } from "@core/logging";
import type { ORPCContextWithOrganization } from "@core/orpc/context";
import { AGENT_PROMPTS, type PageContext } from "@modules/agents/constants";
import { buildSkillCatalog, getSkillPromptName } from "@modules/agents/skills";
import { buildAdvisorTool } from "@modules/agents/tools/advisor";
import { buildAgentReadTools } from "@modules/agents/tools/registry";

const agentErrors = defineErrorCatalog("agents.chat", {
   PROMPT_FAILED: {
      status: 500,
      message: "Falha ao carregar prompt do agente.",
      why: "Não foi possível carregar o template de prompts necessário para a conversa.",
      fix: "Tente novamente. Se persistir, verifique a configuração de prompts.",
      tags: ["agents", "prompt"],
   },
});

declare module "evlog" {
   interface RegisteredErrorCatalogs {
      "agents.chat": typeof agentErrors;
   }
}

type AgentCatalogError = ReturnType<typeof agentErrors.PROMPT_FAILED>;

class AgentChatError extends TaggedError("AgentChatError")<{
   error: AgentCatalogError;
   message: string;
}>() {}

export interface AgentChatOptions {
   prompts: Prompts;
   userId: string;
   organizationId: string;
   teamId: string;
   headers: Headers;
   request: Request;
   orpcContext: ORPCContextWithOrganization;
   threadId?: string;
   runId?: string;
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
         userId: options.userId,
         organizationId: options.organizationId,
         teamId: options.teamId,
         threadId: options.threadId,
         turnId,
      }),
      ...buildAgentReadTools({ context: options.orpcContext }),
   ];

   const rootTemplate = await (async () => {
      const result = await Result.tryPromise({
         try: () =>
            options.prompts.get(AGENT_PROMPTS.root, {
               withMetadata: false,
            }),
         catch: () =>
            new AgentChatError({
               error: agentErrors.PROMPT_FAILED(),
               message: agentErrors.PROMPT_FAILED().message,
            }),
      });
      if (Result.isError(result)) throw result.error;
      return result.value;
   })();
   const systemPrompt = Result.try(() =>
      options.prompts.compile(rootTemplate, {
         skill_catalog: buildSkillCatalog(),
         page_context: formatPageContext(options.pageContext),
      }),
   );
   if (Result.isError(systemPrompt)) throw systemPrompt.error;

   const skillPromptName = getSkillPromptName(options.pageContext?.skillHint);
   const activeSkillPrompt = await (async () => {
      if (!skillPromptName) return undefined;
      const template = await (async () => {
         const result = await Result.tryPromise({
            try: () =>
               options.prompts.get(skillPromptName, {
                  withMetadata: false,
               }),
            catch: () =>
               new AgentChatError({
                  error: agentErrors.PROMPT_FAILED(),
                  message: agentErrors.PROMPT_FAILED().message,
               }),
         });
         if (Result.isError(result)) throw result.error;
         return result.value;
      })();

      const compiled = Result.try(() => options.prompts.compile(template, {}));
      if (Result.isError(compiled)) throw compiled.error;
      return compiled.value;
   })();

   return {
      adapter: flashModel,
      systemPrompts: [
         systemPrompt.value,
         ...(activeSkillPrompt ? [activeSkillPrompt] : []),
         RENDERING_PRIMER,
      ],
      messages: convertMessagesToModelMessages(options.messages),
      tools,
      modelOptions: {
         reasoning: { effort: options.reasoningEffort ?? "high" },
         parallelToolCalls: false,
      },
      agentLoopStrategy: maxIterations(8),
      ...(options.threadId && { threadId: options.threadId }),
      ...(options.runId && { runId: options.runId }),
      abortController: options.abortSignal
         ? abortControllerFromSignal(options.abortSignal)
         : undefined,
      middleware: [
         otelMiddleware({
            tracer: getAiTracer(),
            captureContent: false,
            attributeEnricher: () =>
               aiTraceAttributes({
                  distinctId: options.userId,
                  userId: options.userId,
                  organizationId: options.organizationId,
                  teamId: options.teamId,
                  threadId: options.threadId,
                  promptName: AGENT_PROMPTS.root,
                  customProperties: {
                     agent_role: "executor",
                     agent_organization_id: options.organizationId,
                     agent_team_id: options.teamId,
                     ...(options.threadId && {
                        agent_thread_id: options.threadId,
                     }),
                     ...(options.runId && {
                        agent_run_id: options.runId,
                     }),
                     agent_turn_id: turnId,
                     ...(options.pageContext?.skillHint && {
                        agent_skill: options.pageContext.skillHint,
                     }),
                  },
               }),
         }),
         ...(options.extraMiddleware ?? []),
      ],
   };
}

export async function createAgentChat(options: AgentChatOptions) {
   return chat(await buildAgentChatArgs(options));
}
