import {
   openRouterResponsesText,
   openRouterText,
} from "@tanstack/ai-openrouter";

const serverURL = process.env.OPENROUTER_BASE_URL || undefined;
const baseConfig = serverURL ? { serverURL } : undefined;

export const proModel = openRouterText("deepseek/deepseek-v4-pro", baseConfig);
export const flashModel = openRouterText(
   "deepseek/deepseek-v4-flash",
   baseConfig,
);
export const fileModel = openRouterResponsesText(
   "google/gemini-3.1-flash-lite",
   baseConfig,
);
