import { flue } from "@flue/runtime/app";
import { configureFlueProvidersFromEnv } from "./lib/providers.ts";

interface FlueEnv {
   OPENCODE_API_KEY?: string;
   OPENCODE_GO_BASE_URL?: string;
   OPENCODE_GO_GATEWAY_KEY?: string;
}

type FlueFetch = ReturnType<typeof flue>["fetch"];
type FlueExecutionContext = Parameters<FlueFetch>[2];

function toProcessEnv(env: FlueEnv) {
   return {
      OPENCODE_API_KEY: env.OPENCODE_API_KEY,
      OPENCODE_GO_BASE_URL: env.OPENCODE_GO_BASE_URL,
      OPENCODE_GO_GATEWAY_KEY: env.OPENCODE_GO_GATEWAY_KEY,
   };
}

export default {
   fetch(req: Request, env: FlueEnv, ctx: FlueExecutionContext) {
      configureFlueProvidersFromEnv(toProcessEnv(env));
      return flue().fetch(req, env, ctx);
   },
};
