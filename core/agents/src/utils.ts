export function buildLanguageInstruction(language: string): string {
   const languageMap: Record<string, string> = {
      "pt-BR":
         "OBRIGATÓRIO: Sempre escreva e responda EXCLUSIVAMENTE em Português Brasileiro (pt-BR). NUNCA use inglês ou qualquer outro idioma.",
      "en-US": "Always respond and write content in American English (en-US).",
      es: "Siempre responda y escriba contenido en Español.",
   };
   return `## IDIOMA DE SAÍDA\n${languageMap[language] ?? languageMap["pt-BR"]}`;
}

export type MastraLLMUsage = {
   inputTokens: number;
   outputTokens: number;
   totalTokens: number;
   reasoningTokens?: number | null;
   cachedInputTokens?: number | null;
};
