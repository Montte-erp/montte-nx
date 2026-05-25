import { Result } from "better-result";
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
      const providerEnvResult = validateFlueProviderEnv(env);
      if (Result.isError(providerEnvResult)) throw providerEnvResult.error;

      configureFlueProvidersFromEnv(providerEnvResult.value);
      return flue().fetch(req, env, ctx);
   },
};
