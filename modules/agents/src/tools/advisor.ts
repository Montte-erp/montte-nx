import { chat, toolDefinition } from "@tanstack/ai";
import { otelMiddleware } from "@tanstack/ai/middlewares/otel";
import { z } from "zod";
import { fromPromise } from "neverthrow";
import { proModel } from "@core/ai/models";
import { WebAppError } from "@core/logging/errors";
import { aiTraceAttributes } from "@core/ai/otel";
import { getAiTracer } from "@core/logging";
import type { Prompts } from "@core/posthog/server";
import { AGENT_PROMPTS } from "@modules/agents/constants";
import { SKILLS } from "@modules/agents/skills";

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

      const templateResult = await fromPromise(
         deps.prompts.get(AGENT_PROMPTS.advisor, {
            withMetadata: false,
         }),
         () => "Falha ao carregar prompt do advisor.",
      );
      if (templateResult.isErr())
         throw WebAppError.internal(templateResult.error);

      const systemPrompt = deps.prompts.compile(templateResult.value, {});

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

      const result = await fromPromise(
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
                           ...(deps.teamId && { agent_team_id: deps.teamId }),
                           ...(deps.threadId && {
                              agent_thread_id: deps.threadId,
                           }),
                           ...(deps.turnId && { agent_turn_id: deps.turnId }),
                        },
                     }),
               }),
            ],
         }),
         () => "Advisor falhou ao responder.",
      );
      clearTimeout(timeout);

      if (result.isErr()) {
         throw WebAppError.internal(result.error);
      }
      if (!result.value)
         throw WebAppError.internal("Advisor não retornou conteúdo.");
      return {
         guidance: result.value,
         fallback: false,
      };
   });
}
