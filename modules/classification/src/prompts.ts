export const CLASSIFICATION_PROMPTS = {
   classifyTransaction: "montte-classify-transaction",
   deriveKeywords: "montte-derive-keywords",
} as const;

export type ClassificationPromptKey = keyof typeof CLASSIFICATION_PROMPTS;
