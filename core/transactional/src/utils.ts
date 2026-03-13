import { Resend } from "resend";

export type ResendClient = Resend;

export function createResendClient(apiKey: string): Resend {
   return new Resend(apiKey);
}
