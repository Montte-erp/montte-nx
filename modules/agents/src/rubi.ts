import { maxIterations } from "@tanstack/ai";
import type { DatabaseInstance } from "@core/database/client";
import type { PostHog, Prompts } from "@core/posthog/server";
import { flashModel } from "@core/ai/models";
import { createPosthogAiMiddleware } from "@core/ai/middleware";
import { RUBI_PROMPTS } from "@modules/agents/constants";
import type { RubiModelMessage } from "@modules/agents/messages";
import {
   buildSkillCatalog,
   buildSkillDiscoverTool,
} from "@modules/agents/skills";
import { buildAdvisorTool } from "@modules/agents/tools/advisor";
import { buildBenefitsTools } from "@modules/agents/tools/benefits";
import { buildCouponsTools } from "@modules/agents/tools/coupons";
import { buildMetersTools } from "@modules/agents/tools/meters";
import { buildPricesTools } from "@modules/agents/tools/prices";
import { buildServicesTools } from "@modules/agents/tools/services";
import { buildSetupTools } from "@modules/agents/tools/setup";
import type { ToolDeps } from "@modules/agents/tools/types";
import type { PageContext } from "@modules/agents/router/chat";

export interface RubiChatOptions {
   db: DatabaseInstance;
   prompts: Prompts;
   posthog: PostHog;
   teamId: string;
   userId: string;
   organizationId: string;
   threadId?: string;
   messages: RubiModelMessage[];
   pageContext: PageContext;
   abortSignal?: AbortSignal;
}

const RENDERING_PRIMER = `## Renderização (json-render)

Toda tool de leitura/escrita retorna um campo \`ui\` com um spec json-render que o cliente renderiza usando shadcn. Você nunca precisa formatar a saída em markdown — o spec já mostra a tabela/alert/card.

**Não duplique a informação em texto.** Após uma tool call, escreva no máximo 1-2 frases curtas conectando o resultado à próxima ação. Nunca repita a tabela / contagem / nomes que o spec já mostra.

Vocabulário disponível no catalog (quando o tool não monta o spec por você): Card, Stack, Grid, Separator, Heading, Text, Badge, Alert, Table, Accordion, Collapsible, Tabs, Progress, Skeleton, Spinner, Avatar, Image, Link, Tooltip.`;

function formatPageContext(pageContext: PageContext): string {
   if (pageContext === undefined) return "Nenhum contexto de página fornecido.";
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

function buildDomainTools(deps: ToolDeps) {
   return [
      ...buildSetupTools(deps),
      ...buildServicesTools(deps),
      ...buildPricesTools(deps),
      ...buildMetersTools(deps),
      ...buildBenefitsTools(deps),
      ...buildCouponsTools(deps),
   ];
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

export async function buildRubiChatArgs(options: RubiChatOptions) {
   const turnId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
   const toolDeps: ToolDeps = { db: options.db, teamId: options.teamId };

   const skillDiscoverTool = buildSkillDiscoverTool(options.prompts);
   const advisorTool = buildAdvisorTool({
      prompts: options.prompts,
      posthog: options.posthog,
      distinctId: options.userId,
      threadId: options.threadId,
      turnId,
   });
   const domainTools = buildDomainTools(toolDeps);

   const rootTemplate = await options.prompts.get(RUBI_PROMPTS.root, {
      withMetadata: false,
   });
   const systemPrompt = options.prompts.compile(rootTemplate, {
      skill_catalog: buildSkillCatalog(),
      page_context: formatPageContext(options.pageContext),
   });

   return {
      adapter: flashModel,
      systemPrompts: [systemPrompt, RENDERING_PRIMER],
      messages: options.messages,
      tools: [skillDiscoverTool, advisorTool, ...domainTools],
      agentLoopStrategy: maxIterations(25),
      ...(options.threadId && { conversationId: options.threadId }),
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
