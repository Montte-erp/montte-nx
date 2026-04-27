import { createHyprPayClient, type HyprPayClient } from "@montte/hyprpay";

export type { HyprPayClient };

export function createHyprpay(apiKey: string): HyprPayClient {
   return createHyprPayClient({ apiKey });
}
