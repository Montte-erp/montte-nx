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
export declare const AVAILABLE_MODELS: {
   readonly "openrouter/google/gemini-3-flash-preview": {
      readonly label: "Gemini 3 Flash";
      readonly provider: "Google";
      readonly description: "Contexto de 1M tokens — ideal para análises financeiras longas e relatórios detalhados";
      readonly temperature: 0.7;
      readonly topP: 0.95;
      readonly maxTokens: 8192;
      readonly frequencyPenalty: 0.2;
      readonly presencePenalty: 0.1;
   };
   readonly "openrouter/moonshotai/kimi-k2.5": {
      readonly label: "Kimi K2.5";
      readonly provider: "Moonshot AI";
      readonly description: "Multimodal com boa relação custo-benefício — modelo padrão da Rubi";
      readonly temperature: 0.7;
      readonly topP: 0.9;
      readonly maxTokens: 8192;
      readonly frequencyPenalty: 0.2;
      readonly presencePenalty: 0.1;
      readonly default: true;
   };
   readonly "openrouter/openai/gpt-oss-20b": {
      readonly label: "GPT-OSS-20B";
      readonly provider: "OpenAI";
      readonly description: "Rápido e econômico — bom para respostas curtas e consultas simples";
      readonly temperature: 0.65;
      readonly topP: 0.9;
      readonly maxTokens: 6144;
      readonly frequencyPenalty: 0.3;
      readonly presencePenalty: 0.1;
   };
   readonly "openrouter/liquid/lfm2-8b-a1b": {
      readonly label: "LFM2-8B-A1B";
      readonly provider: "Liquid AI";
      readonly description: "Ultra-leve e econômico — opção para equipes no plano FREE";
      readonly temperature: 0.6;
      readonly topP: 0.9;
      readonly maxTokens: 4096;
      readonly frequencyPenalty: 0.2;
      readonly presencePenalty: 0.1;
   };
};
export type ModelId = keyof typeof AVAILABLE_MODELS;
export declare const DEFAULT_CONTENT_MODEL_ID: ModelId;
export declare const DEFAULT_MODEL_ID: ModelId;
export declare function getModelPreset<T extends Record<string, ModelPreset>>(
   models: T,
   id: string | undefined,
   defaultId: keyof T,
): T[keyof T];
//# sourceMappingURL=models.d.ts.map
