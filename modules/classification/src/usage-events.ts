export const CLASSIFICATION_USAGE_EVENTS = {
   aiKeywordDerived: {
      eventName: "ai.keyword_derived",
      displayName: "Derivação de palavras-chave por IA",
      description:
         "Cobrado por categoria criada ou atualizada quando o agente de IA gera palavras-chave para classificação automática.",
      defaultQuantity: 1,
   },
   aiTransactionClassified: {
      eventName: "ai.transaction_classified",
      displayName: "Classificação de transação por IA",
      description:
         "Cobrado por transação que o agente de IA classifica em lote (categoria + centro de custo derivado).",
      defaultQuantity: 1,
   },
} as const;

export type ClassificationUsageEventKey =
   keyof typeof CLASSIFICATION_USAGE_EVENTS;

export type ClassificationUsageEvent =
   (typeof CLASSIFICATION_USAGE_EVENTS)[ClassificationUsageEventKey];
