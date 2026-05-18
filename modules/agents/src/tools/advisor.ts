import { chat, toolDefinition } from "@tanstack/ai";
import { otelMiddleware } from "@tanstack/ai/middlewares/otel";
import { defineErrorCatalog } from "evlog";
import { Result, TaggedError } from "better-result";
import { z } from "zod";
import { proModel } from "@core/ai/models";
import { aiTraceAttributes } from "@core/ai/otel";
import { getAiTracer } from "@core/logging";
import type { Prompts } from "@core/posthog/server";
import { AGENT_PROMPTS } from "@modules/agents/constants";
import { SKILLS } from "@modules/agents/skills";

const advisorErrors = defineErrorCatalog("agents.advisor", {
   PROMPT_LOAD_FAILED: {
      status: 500,
      message: "Falha ao carregar prompt do advisor.",
      why: "O prompt remoto do advisor não pôde ser carregado.",
      fix: "Tente novamente. Se persistir, verifique a configuração de prompts.",
      tags: ["agents", "advisor", "prompt"],
   },
   PROMPT_COMPILE_FAILED: {
      status: 500,
      message: "Falha ao compilar prompt do advisor.",
      why: "O template do advisor não pôde ser compilado.",
      fix: "Tente novamente. Se persistir, verifique o template do advisor.",
      tags: ["agents", "advisor", "prompt"],
   },
   RUN_FAILED: {
      status: 500,
      message: "Advisor falhou ao responder.",
      why: "A chamada de IA do advisor falhou.",
      fix: "Tente novamente.",
      tags: ["agents", "advisor", "ai"],
   },
   EMPTY_RESPONSE: {
      status: 500,
      message: "Advisor não retornou conteúdo.",
      why: "A chamada de IA terminou sem texto utilizável.",
      fix: "Tente novamente com mais contexto.",
      tags: ["agents", "advisor", "ai"],
   },
});

declare module "evlog" {
   interface RegisteredErrorCatalogs {
      "agents.advisor": typeof advisorErrors;
   }
}

type AdvisorCatalogError =
   | ReturnType<typeof advisorErrors.PROMPT_LOAD_FAILED>
   | ReturnType<typeof advisorErrors.PROMPT_COMPILE_FAILED>
   | ReturnType<typeof advisorErrors.RUN_FAILED>
   | ReturnType<typeof advisorErrors.EMPTY_RESPONSE>;

class AdvisorToolError extends TaggedError("AdvisorToolError")<{
   error: AdvisorCatalogError;
}>() {}

export interface AdvisorToolDeps {
   prompts: Prompts;
   distinctId: string;
   userId?: string;
   organizationId?: string;
   teamId?: string;
   threadId?: string;
   turnId?: string;
}

const ADVISOR_TIMEOUT_MS = 45_000;

const advisorConsultInputSchema = z.object({
   situation: z
      .string()
      .trim()
      .min(20)
      .max(4_000)
      .describe(
         "Resumo da situação atual: pedido do usuário, ações já tentadas e ponto travado.",
      ),
   question: z
      .string()
      .trim()
      .min(5)
      .max(1_000)
      .describe("Decisão específica que precisa do advisor."),
   options: z
      .array(z.string().trim().min(1).max(500))
      .max(5)
      .optional()
      .describe("Opções consideradas, quando existirem."),
});

export function buildAdvisorTool(deps: AdvisorToolDeps) {
   return toolDefinition({
      name: "advisor_consult",
      description:
         "Consulte o advisor sênior antes de tomar decisões ambíguas dentro de uma skill ativa: tabela/dado confuso ou mesma operação falhou 2x. NÃO consulte para CRUD trivial, listagem, input claro ou pedidos sem skill ativa. Budget: até 3 consultas por turno.",
      inputSchema: advisorConsultInputSchema,
   }).server(async ({ situation, question, options }) => {
      if (SKILLS.length === 0) {
         return {
            guidance:
               "Nenhuma skill operacional está disponível no momento. Não é possível consultar o advisor para este pedido.",
            fallback: true,
         };
      }

      const templateResult = await Result.tryPromise({
         try: () =>
            deps.prompts.get(AGENT_PROMPTS.advisor, {
               withMetadata: false,
            }),
         catch: () =>
            new AdvisorToolError({
               error: advisorErrors.PROMPT_LOAD_FAILED(),
            }),
      });
      if (Result.isError(templateResult)) throw templateResult.error;

      const systemPromptResult = Result.try({
         try: () => deps.prompts.compile(templateResult.value, {}),
         catch: () =>
            new AdvisorToolError({
               error: advisorErrors.PROMPT_COMPILE_FAILED(),
            }),
      });
      if (Result.isError(systemPromptResult)) throw systemPromptResult.error;
      const systemPrompt = systemPromptResult.value;

      const optionsBlock =
         options && options.length > 0
            ? `\nOpções consideradas:\n${options.map((o, i) => `${i + 1}. ${o}`).join("\n")}`
            : "";

      const userContent = `Situação:\n${situation}\n\nDecisão necessária:\n${question}${optionsBlock}`;

      const advisorController = new AbortController();
      const timeout = setTimeout(
         () => advisorController.abort("advisor-timeout"),
         ADVISOR_TIMEOUT_MS,
      );

      const result = await Result.tryPromise({
         try: () =>
            chat({
               adapter: proModel,
               systemPrompts: [systemPrompt],
               messages: [
                  {
                     role: "user",
                     content: [{ type: "text", content: userContent }],
                  },
               ],
               stream: false,
               abortController: advisorController,
               middleware: [
                  otelMiddleware({
                     tracer: getAiTracer(),
                     captureContent: false,
                     attributeEnricher: () =>
                        aiTraceAttributes({
                           distinctId: deps.distinctId,
                           userId: deps.userId,
                           organizationId: deps.organizationId,
                           teamId: deps.teamId,
                           threadId: deps.threadId,
                           promptName: AGENT_PROMPTS.advisor,
                           customProperties: {
                              agent_role: "advisor",
                              ...(deps.organizationId && {
                                 agent_organization_id: deps.organizationId,
                              }),
                              ...(deps.teamId && {
                                 agent_team_id: deps.teamId,
                              }),
                              ...(deps.threadId && {
                                 agent_thread_id: deps.threadId,
                              }),
                              ...(deps.turnId && {
                                 agent_turn_id: deps.turnId,
                              }),
                           },
                        }),
                  }),
               ],
            }),
         catch: () =>
            new AdvisorToolError({
               error: advisorErrors.RUN_FAILED(),
            }),
      }).finally(() => clearTimeout(timeout));

      if (Result.isError(result)) throw result.error;
      if (!result.value)
         throw new AdvisorToolError({
            error: advisorErrors.EMPTY_RESPONSE(),
         });
      return {
         guidance: result.value,
         fallback: false,
      };
   });
}
