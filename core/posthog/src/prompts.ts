import { Prompts } from "@posthog/ai";

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

let _client: Prompts | null = null;

function getClient(): Prompts | null {
   if (_client) return _client;
   const host = process.env.POSTHOG_HOST;
   const key = process.env.POSTHOG_KEY;
   const personalApiKey = process.env.POSTHOG_PERSONAL_API_KEY;
   if (!host || !key || !personalApiKey) return null;
   _client = new Prompts({ personalApiKey, projectApiKey: key, host });
   return _client;
}

export async function fetchSystemPrompt(promptKey: PromptKey): Promise<string> {
   const { name, fallback } = POSTHOG_PROMPTS[promptKey];
   try {
      const client = getClient();
      if (!client) return fallback;
      return await client.get(name, { fallback });
   } catch {
      return fallback;
   }
}
