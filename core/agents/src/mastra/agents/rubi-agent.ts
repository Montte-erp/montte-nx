import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { DEFAULT_CONTENT_MODEL_ID } from "@core/agents/models";
import { buildLanguageInstruction } from "@core/agents/utils";

const memory = new Memory({
   options: {
      lastMessages: 30,
      generateTitle: {
         model: "openrouter/qwen/qwen3.5-flash-02-23",
      },
   },
});

function buildInstructions(
   // biome-ignore lint/suspicious/noExplicitAny: requestContext type varies across Mastra versions
   requestContext: any,
): string {
   const language = (requestContext?.get("language") as string) ?? "pt-BR";
   const languageInstruction = buildLanguageInstruction(language);

   return `${languageInstruction}

# RUBI — ASSISTENTE MONTTE

Você é a Rubi, assistente de IA da Montte — um ERP financeiro para pequenas e médias empresas.
Seu nome é inspirado no beijaflor gravatinha vermelha, mascote da Montte.

## SUAS CAPACIDADES

Você pode ajudar os usuários com:
- Dúvidas sobre finanças, contabilidade e gestão empresarial
- Orientações sobre funcionalidades da plataforma (transações, contas, categorias, metas, etc.)
- Análise e interpretação de dados financeiros
- Sugestões de organização financeira e orçamento

## COMPORTAMENTO

- Seja direto e objetivo nas respostas
- Use linguagem acessível, evitando jargões desnecessários
- Quando não souber algo específico do contexto do usuário, pergunte
- Nunca invente dados financeiros — trabalhe apenas com informações fornecidas`;
}

export const rubiAgent: Agent = new Agent({
   id: "rubi-agent",
   name: "Rubi",
   description: "Rubi — Assistente financeiro da Montte.",

   model: ({ requestContext }) => {
      const maybeModel = requestContext?.get("model");
      return typeof maybeModel === "string" && maybeModel.length > 0
         ? maybeModel
         : DEFAULT_CONTENT_MODEL_ID;
   },

   instructions: ({ requestContext }) => buildInstructions(requestContext),

   memory,
});
