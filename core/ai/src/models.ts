import type { AnyTextAdapter } from "@tanstack/ai";
import { openRouterText } from "@tanstack/ai-openrouter";

const serverURL = process.env.OPENROUTER_BASE_URL || undefined;
const baseConfig = serverURL ? { serverURL } : undefined;

export const proModel: AnyTextAdapter = openRouterText(
   "deepseek/deepseek-v4-pro",
   baseConfig,
);
export const flashModel: AnyTextAdapter = openRouterText(
   "deepseek/deepseek-v4-flash",
   baseConfig,
);
