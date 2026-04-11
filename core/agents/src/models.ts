export type ModelPreset = {
   label: string;
   provider: string;
   description: string;
   temperature: number;
   topP: number;
   maxTokens: number;
   frequencyPenalty?: number;
   presencePenalty?: number;
   default?: true;
};

export const AVAILABLE_MODELS = {
   "openrouter/google/gemini-3-flash-preview": {
      label: "Gemini 3 Flash",
      provider: "Google",
      description:
         "Contexto de 1M tokens — ideal para análises financeiras longas e relatórios detalhados",
      temperature: 0.7,
      topP: 0.95,
      maxTokens: 8192,
      frequencyPenalty: 0.2,
      presencePenalty: 0.1,
   },
   "openrouter/moonshotai/kimi-k2.5": {
      label: "Kimi K2.5",
      provider: "Moonshot AI",
      description:
         "Multimodal com boa relação custo-benefício — modelo padrão da Rubi",
      temperature: 0.7,
      topP: 0.9,
      maxTokens: 8192,
      frequencyPenalty: 0.2,
      presencePenalty: 0.1,
      default: true,
   },
   "openrouter/openai/gpt-oss-20b": {
      label: "GPT-OSS-20B",
      provider: "OpenAI",
      description:
         "Rápido e econômico — bom para respostas curtas e consultas simples",
      temperature: 0.65,
      topP: 0.9,
      maxTokens: 6144,
      frequencyPenalty: 0.3,
      presencePenalty: 0.1,
   },
   "openrouter/qwen/qwen3.5-flash-02-23": {
      label: "Qwen 3.5 Flash",
      provider: "Qwen",
      description: "Ultra-leve e econômico — opção para equipes no plano FREE",
      temperature: 0.6,
      topP: 0.9,
      maxTokens: 4096,
      frequencyPenalty: 0.2,
      presencePenalty: 0.1,
   },
} as const satisfies Record<string, ModelPreset>;

export type ModelId = keyof typeof AVAILABLE_MODELS;

export const DEFAULT_CONTENT_MODEL_ID: ModelId =
   "openrouter/moonshotai/kimi-k2.5";

export const DEFAULT_MODEL_ID: ModelId = DEFAULT_CONTENT_MODEL_ID;

export function getModelPreset<T extends Record<string, ModelPreset>>(
   models: T,
   id: string | undefined,
   defaultId: keyof T,
): T[keyof T] {
   return (
      id !== undefined && id in models
         ? models[id as keyof T]
         : models[defaultId]
   ) as T[keyof T];
}
