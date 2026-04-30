import { chat, toolDefinition } from "@tanstack/ai";
import { z } from "zod";
import { fromPromise } from "neverthrow";
import { proModel } from "@core/ai/models";
import { createPosthogAiMiddleware } from "@core/ai/middleware";
import type { PostHog, Prompts } from "@core/posthog/server";
import { RUBI_PROMPTS } from "../../../constants";

export interface AdvisorToolDeps {
   prompts: Prompts;
   posthog: PostHog;
   distinctId: string;
   threadId?: string;
   turnId?: string;
}

const ADVISOR_FALLBACK_PROMPT = `Você é o consultor sênior do Rubi. Você NÃO tem ferramentas e NÃO fala com o usuário.
Recebe uma situação curada do executor e retorna uma decisão clara em pt-BR.

Formato da resposta:
1. Decisão recomendada (1 linha objetiva)
2. Justificativa (2-3 linhas)
3. Próximos passos concretos (lista curta)

Princípios de modelagem do catálogo (use quando relevante):
- Desconto recorrente (%) sempre vira **benefit**, nunca serviço duplicado.
- Preço com unidade temporal (hora/turno/dia/mês) exige **meter** existente antes do price.
- "Plano" recorrente (mensal/semestral/anual) é serviço com 3 preços, um por período.
- Ambíguo ou faltando dado → recomende perguntar ao usuário, nunca invente valor.

Sem rodeios. Não escreva "como advisor, eu...". Direto à decisão.`;

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
   }).server(async ({ situation, question, options }) => {
      const templateResult = await fromPromise(
         deps.prompts.get(RUBI_PROMPTS.advisor, {
            withMetadata: false,
            fallback: ADVISOR_FALLBACK_PROMPT,
         }),
         (e) => (e instanceof Error ? e : new Error(String(e))),
      );
      const systemPrompt = templateResult.isOk()
         ? deps.prompts.compile(templateResult.value, {})
         : ADVISOR_FALLBACK_PROMPT;

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
               createPosthogAiMiddleware({
                  posthog: deps.posthog,
                  distinctId: deps.distinctId,
                  promptName: RUBI_PROMPTS.advisor,
                  customProperties: {
                     rubi_role: "advisor",
                     ...(deps.threadId && { rubi_thread_id: deps.threadId }),
                     ...(deps.turnId && { rubi_turn_id: deps.turnId }),
                  },
               }),
            ],
         }),
         (e) => (e instanceof Error ? e : new Error(String(e))),
      );
      clearTimeout(timeout);

      if (result.isErr()) {
         return {
            guidance:
               "Advisor indisponível no momento. Prossiga com seu melhor julgamento, ou peça esclarecimento ao usuário se o ponto travado for de dado.",
            fallback: true,
            error: result.error.message,
         };
      }
      return {
         guidance: result.value,
         fallback: false,
      };
   });
}
