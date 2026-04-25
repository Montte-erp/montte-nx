import { openRouterText } from "@tanstack/ai-openrouter";

// @ts-expect-error model id not yet in OpenRouterTextModels catalog
export const proModel = openRouterText("deepseek/deepseek-v4-pro");
// @ts-expect-error model id not yet in OpenRouterTextModels catalog
export const flashModel = openRouterText("deepseek/deepseek-v4-flash");
