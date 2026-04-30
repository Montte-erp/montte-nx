import type { DatabaseInstance } from "@core/database/client";
import type { PostHog, Prompts } from "@core/posthog/server";
import { maxIterations } from "@tanstack/ai";
import { flashModel } from "@core/ai/models";
import { createPosthogAiMiddleware } from "@core/ai/middleware";
import { RUBI_PROMPTS } from "../../constants";
import {
   buildAllSkillTools,
   buildSkillCatalog,
   buildSkillDiscoverTool,
} from "./skills";
import { buildAdvisorTool } from "./tools/advisor";
import type { PageContext } from "../../contracts/chat";

export interface RubiChatOptions {
   db: DatabaseInstance;
   prompts: Prompts;
   posthog: PostHog;
   teamId: string;
   userId: string;
   organizationId: string;
   threadId?: string;
   messages: ReadonlyArray<unknown>;
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
   const turnId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
   const advisorTool = buildAdvisorTool({
      prompts: options.prompts,
      posthog: options.posthog,
      distinctId: options.userId,
      threadId: options.threadId,
      turnId,
   });

   const rootTemplate = await options.prompts.get(RUBI_PROMPTS.root, {
      withMetadata: false,
      fallback:
         "Você é Rubi, a assistente de IA do Montte. Responda em pt-BR de forma direta e amigável.",
   });
   const systemPrompt = options.prompts.compile(rootTemplate, {
      skill_catalog: buildSkillCatalog(),
      page_context: formatPageContext(options.pageContext),
   });

   const renderingPrimer = `## Renderização (json-render)

Toda tool de leitura/escrita retorna um campo \`ui\` com um spec json-render que o cliente renderiza usando shadcn. Você nunca precisa formatar a saída em markdown — o spec já mostra a tabela/alert/card.

**Não duplique a informação em texto.** Após uma tool call, escreva no máximo 1-2 frases curtas conectando o resultado à próxima ação. Nunca repita a tabela / contagem / nomes que o spec já mostra.

Vocabulário disponível no catalog (quando o tool não monta o spec por você): Card, Stack, Grid, Separator, Heading, Text, Badge, Alert, Table, Accordion, Collapsible, Tabs, Progress, Skeleton, Spinner, Avatar, Image, Link, Tooltip.`;

   return {
      adapter: flashModel,
      systemPrompts: [systemPrompt, renderingPrimer],
      messages: options.messages as never,
      tools: [skillDiscoverTool, advisorTool, ...skillTools],
      agentLoopStrategy: maxIterations(25),
      abortController: options.abortSignal
         ? abortControllerFromSignal(options.abortSignal)
         : undefined,
      middleware: [
         createPosthogAiMiddleware({
            posthog: options.posthog,
            distinctId: options.userId,
            promptName: RUBI_PROMPTS.root,
            customProperties: {
               rubi_role: "executor",
               ...(options.threadId && { rubi_thread_id: options.threadId }),
               rubi_turn_id: turnId,
               ...(options.pageContext?.skillHint && {
                  rubi_skill: options.pageContext.skillHint,
               }),
            },
         }),
      ],
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
