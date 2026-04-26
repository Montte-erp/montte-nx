import { createHyprPayClient } from "@montte/hyprpay";
export function createHyprpay(apiKey) {
   return createHyprPayClient({ apiKey });
}
