import { env } from "@core/environment/server";
import { Resend } from "resend";

export type ResendClient = Resend;

export const resendClient = new Resend(env.RESEND_API_KEY);
