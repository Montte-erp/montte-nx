import { chat, toolDefinition } from "@tanstack/ai";
import { z } from "zod";
import { fromPromise } from "neverthrow";
import { proModel } from "@core/ai/models";
import { WebAppError } from "@core/logging/errors";
import { createPosthogAiMiddleware } from "@core/ai/middleware";
import type { PostHog, Prompts } from "@core/posthog/server";
import { AGENT_PROMPTS } from "@modules/agents/constants";

export interface AdvisorToolDeps {
   prompts: Prompts;
   posthog: PostHog;
   distinctId: string;
   threadId?: string;
   turnId?: string;
}

const ADVISOR_TIMEOUT_MS = 45_000;

export function buildAdvisorTool(deps: AdvisorToolDeps) {
   return toolDefinition({
      name: "advisor_consult",
      description:
         "Consulte o advisor sênior antes de tomar decisões ambíguas: tabela/dado confuso, conflito service vs benefit vs meter, mesma operação falhou 2x, ou pedido fora de skill conhecida. NÃO consulte para CRUD trivial, listagem ou input claro. Budget: até 3 consultas por turno.",
      inputSchema: z.object({
         situation: z
            .string()
            .min(20)
            .describe(
               "Resumo da situação atual (o que o usuário pediu, o que você já fez/tentou, qual o ponto travado).",
            ),
         question: z
            .string()
            .min(5)
            .describe("A decisão específica que você precisa do advisor."),
         options: z
            .array(z.string())
            .optional()
            .describe("Opções que você está considerando, se houver."),
      }),
   }).server(async ({ situation, question, options }, context) => {
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

      context?.emitCustomEvent("advisor_stream_start", { content: "" });

      const result = await fromPromise(
         (async () => {
            let guidance = "";
            const stream = chat({
               adapter: proModel,
               systemPrompts: [systemPrompt],
               messages: [
                  {
                     role: "user",
                     content: [{ type: "text", content: userContent }],
                  },
               ],
               abortController: advisorController,
               middleware: [
                  createPosthogAiMiddleware({
                     posthog: deps.posthog,
                     distinctId: deps.distinctId,
                     promptName: AGENT_PROMPTS.advisor,
                     customProperties: {
                        agent_role: "advisor",
                        ...(deps.threadId && {
                           agent_thread_id: deps.threadId,
                        }),
                        ...(deps.turnId && { agent_turn_id: deps.turnId }),
                     },
                  }),
               ],
            });

            for await (const chunk of stream) {
               if (chunk.type === "TEXT_MESSAGE_CONTENT") {
                  guidance = chunk.content ?? `${guidance}${chunk.delta}`;
                  context?.emitCustomEvent("advisor_stream_delta", {
                     content: guidance,
                     delta: chunk.delta,
                  });
               }
               if (chunk.type === "RUN_ERROR") {
                  throw WebAppError.internal(chunk.message);
               }
            }

            context?.emitCustomEvent("advisor_stream_end", {
               content: guidance,
            });
            return guidance;
         })(),
         (error) =>
            error instanceof WebAppError
               ? error
               : WebAppError.internal("Advisor falhou ao responder.", {
                    cause: error,
                 }),
      );
      clearTimeout(timeout);

      if (result.isErr()) {
         throw result.error;
      }
      if (!result.value)
         throw WebAppError.internal("Advisor não retornou conteúdo.");
      return {
         guidance: result.value,
         fallback: false,
      };
   });
}
