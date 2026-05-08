import { createModel, extendAdapter, type AnyTextAdapter } from "@tanstack/ai";
import { openRouterText } from "@tanstack/ai-openrouter";

const customModels = [
   createModel("deepseek/deepseek-v4-pro", ["text"]),
   createModel("deepseek/deepseek-v4-flash", ["text"]),
] as const;

const openRouter = extendAdapter(openRouterText, customModels);

const serverURL = process.env.OPENROUTER_BASE_URL || undefined;
const baseConfig = serverURL ? { serverURL } : undefined;

export const proModel: AnyTextAdapter = openRouter(
   "deepseek/deepseek-v4-pro",
   baseConfig,
);
export const flashModel: AnyTextAdapter = openRouter(
   "deepseek/deepseek-v4-flash",
   baseConfig,
);
