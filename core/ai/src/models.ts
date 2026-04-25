import { openRouterText } from "@tanstack/ai-openrouter";

const serverURL = process.env.OPENROUTER_BASE_URL || undefined;
const baseConfig = serverURL ? { serverURL } : undefined;

// `@ts-expect-error` self-cleans: remove once deepseek/deepseek-v4-* lands in @tanstack/ai-openrouter catalog.
export const proModel = openRouterText(
   // @ts-expect-error model id not yet in OpenRouterTextModels catalog
   "deepseek/deepseek-v4-pro",
   baseConfig,
);
export const flashModel = openRouterText(
   // @ts-expect-error model id not yet in OpenRouterTextModels catalog
   "deepseek/deepseek-v4-flash",
   baseConfig,
);
