export const FEATURE_FLAG_KEYS = [
  "contatos",
  "produtos-estoque",
  "gestao-de-servicos",
  "analises-avancadas",
  "dados",
] as const;

export type FeatureFlagKey = (typeof FEATURE_FLAG_KEYS)[number];
