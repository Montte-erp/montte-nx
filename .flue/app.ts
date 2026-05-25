import { flue } from "@flue/runtime/app";
import { validateFlueProviderEnv } from "./lib/agent-utils.ts";
import { configureFlueProvidersFromEnv } from "./lib/providers.ts";

type FlueFetch = ReturnType<typeof flue>["fetch"];
type FlueExecutionContext = Parameters<FlueFetch>[2];

export default {
   fetch(
      req: Request,
      env: Record<string, unknown>,
      ctx: FlueExecutionContext,
   ) {
      configureFlueProvidersFromEnv(validateFlueProviderEnv(env));
      return flue().fetch(req, env, ctx);
   },
};
