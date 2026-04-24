import { Resend } from "resend";
export function createResendClient(apiKey) {
   return new Resend(apiKey);
}
