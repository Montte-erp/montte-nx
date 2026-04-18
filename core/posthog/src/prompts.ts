import { Prompts } from "@posthog/ai";
import { fromPromise, okAsync } from "neverthrow";

export const POSTHOG_PROMPTS = {
   categorizeTransaction: {
      name: "montte-categorize-transaction",
      fallback:
         "Você é um assistente financeiro brasileiro especializado em classificação de transações bancárias. Classifique a transação na categoria mais adequada da lista. Retorne o nome exato ou null. Inclua o campo confidence (high/low).",
   },
   deriveKeywords: {
      name: "montte-derive-keywords",
      fallback:
         "Você é um assistente financeiro brasileiro. Gere entre 5 e 15 palavras-chave em português para a categoria fornecida. Retorne um array JSON no campo keywords.",
   },
   suggestTag: {
      name: "montte-suggest-tag",
      fallback:
         "Você é um assistente financeiro brasileiro. Identifique o Centro de Custo mais adequado da lista para a transação fornecida. Retorne o nome exato ou null. Inclua o campo confidence (high/low).",
   },
} as const;

export type PromptKey = keyof typeof POSTHOG_PROMPTS;

const client =
   process.env.POSTHOG_HOST &&
   process.env.POSTHOG_KEY &&
   process.env.POSTHOG_PERSONAL_API_KEY
      ? new Prompts({
           personalApiKey: process.env.POSTHOG_PERSONAL_API_KEY,
           projectApiKey: process.env.POSTHOG_KEY,
           host: process.env.POSTHOG_HOST,
        })
      : null;

export function fetchSystemPrompt(promptKey: PromptKey) {
   const { name, fallback } = POSTHOG_PROMPTS[promptKey];
   if (!client) return okAsync(fallback);
   return fromPromise(client.get(name, { fallback }), () => fallback).orElse(
      (fb) => okAsync(fb),
   );
}
