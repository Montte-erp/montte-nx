import { Result } from "better-result";
import { flue } from "@flue/runtime/app";
import { requireEnv } from "./lib/agent-utils.ts";
import { configureFlueProvider } from "./lib/providers.ts";

type FlueFetch = ReturnType<typeof flue>["fetch"];
type FlueExecutionContext = Parameters<FlueFetch>[2];

export default {
   fetch(
      req: Request,
      env: Record<string, unknown>,
      ctx: FlueExecutionContext,
   ) {
      const apiKeyResult = requireEnv(env, "OPENCODE_API_KEY");
      if (Result.isError(apiKeyResult)) throw apiKeyResult.error;

      configureFlueProvider(apiKeyResult.value);
      return flue().fetch(req, env, ctx);
   },
};
