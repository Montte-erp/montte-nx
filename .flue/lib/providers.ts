import { configureProvider } from "@flue/runtime/app";

const DEFAULT_OPENCODE_GO_BASE_URL = "https://opencode.ai/zen/go/v1";

interface ProviderEnv {
   OPENCODE_API_KEY?: string;
   OPENCODE_GO_BASE_URL?: string;
   OPENCODE_GO_GATEWAY_KEY?: string;
}

export function configureFlueProvidersFromEnv(env: ProviderEnv) {
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
