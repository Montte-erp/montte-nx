export const FEATURE_FLAG_KEYS = [
   "contatos",
   "servicos-catalogo",
   "servicos-medidores",
   "servicos-beneficios",
   "servicos-cupons",
   "analises-avancadas",
   "dados",
] as const;

export type FeatureFlagKey = (typeof FEATURE_FLAG_KEYS)[number];

export type PostHogSurveyEntry = {
   id: string;
   flagKey: string | null;
};

export const POSTHOG_SURVEYS = {
   bugReport: {
      id: "019d3b2e-8eb3-0000-a93d-a90c32f043ef",
      flagKey: null,
   },
   featureRequest: {
      id: "019d3b2e-92f9-0000-1abb-5edfc2ee742b",
      flagKey: null,
   },
   featureFeedback: {
      id: "019d3b2e-970f-0000-0200-2dd39ff7eac2",
      flagKey: null,
   },
   feedbackContatos: {
      id: "019d3b2f-a58f-0000-bc30-ac03e413d7fc",
      flagKey: "contatos",
   },
   feedbackAnalisesAvancadas: {
      id: "019d3b2f-b5d7-0000-60aa-b7dd238e70d3",
      flagKey: "analises-avancadas",
   },
   feedbackDados: {
      id: "019d3b2f-ba55-0000-c8b0-25a1ce21c7f8",
      flagKey: "dados",
   },
   suggestIntegration: {
      id: "019d3b8e-c77a-0000-fb14-82f93cfb23bd",
      flagKey: null,
   },
   monthlySatisfaction: {
      id: "019d3c06-06d2-0000-4ed8-26677cdabed3",
      flagKey: null,
   },
} as const satisfies Record<string, PostHogSurveyEntry>;

export type PostHogSurveyKey = keyof typeof POSTHOG_SURVEYS;
