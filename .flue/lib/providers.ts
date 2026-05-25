import { configureProvider } from "@flue/runtime/app";
import type { FlueProviderEnv } from "./agent-utils.ts";

const DEFAULT_OPENCODE_GO_BASE_URL = "https://opencode.ai/zen/go/v1";

export function configureFlueProvidersFromEnv(env: FlueProviderEnv) {
   if (env.OPENCODE_GO_GATEWAY_KEY) {
      configureProvider("opencode-go", {
         baseUrl: env.OPENCODE_GO_BASE_URL ?? DEFAULT_OPENCODE_GO_BASE_URL,
         apiKey: env.OPENCODE_API_KEY ?? "dummy",
         headers: { "X-Custom-Auth": env.OPENCODE_GO_GATEWAY_KEY },
      });
      return;
   }

   configureProvider("opencode-go", {
      baseUrl: env.OPENCODE_GO_BASE_URL ?? DEFAULT_OPENCODE_GO_BASE_URL,
      apiKey: env.OPENCODE_API_KEY ?? "dummy",
   });
}
