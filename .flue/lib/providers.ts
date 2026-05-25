import { configureProvider } from "@flue/runtime/app";

const OPENCODE_GO_BASE_URL = "https://opencode.ai/zen/go/v1";

export function configureFlueProvider(apiKey: string) {
   configureProvider("opencode-go", {
      baseUrl: OPENCODE_GO_BASE_URL,
      apiKey,
   });
}
