import { Resend } from "resend";
export {
   createResendClient,
   type ResendClient,
} from "@core/transactional/utils";
export declare function getResendClient(apiKey: string): Resend;
export interface SendEmailOTPOptions {
   email: string;
   otp: string;
   type: "sign-in" | "email-verification" | "forget-password" | "change-email";
}
export interface SendOrganizationInvitationOptions {
   email: string;
   invitedByUsername: string;
   invitedByEmail: string;
   teamName: string;
   inviteLink: string;
}
export declare const sendOrganizationInvitation: (
   client: Resend,
   {
      email,
      invitedByUsername,
      invitedByEmail,
      teamName,
      inviteLink,
   }: SendOrganizationInvitationOptions,
) => Promise<void>;
export declare const sendEmailOTP: (
   client: Resend,
   { email, otp, type }: SendEmailOTPOptions,
) => Promise<void>;
export interface SendMagicLinkEmailOptions {
   email: string;
   magicLinkUrl: string;
}
export declare const sendMagicLinkEmail: (
   client: Resend,
   { email, magicLinkUrl }: SendMagicLinkEmailOptions,
) => Promise<void>;
export interface SendBudgetAlertEmailOptions {
   email: string;
   categoryName: string;
   spentAmount: string;
   limitAmount: string;
   percentUsed: number;
   alertThreshold: number;
   month: string;
}
export declare const sendBudgetAlertEmail: (
   client: Resend,
   {
      email,
      categoryName,
      spentAmount,
      limitAmount,
      percentUsed,
      alertThreshold,
      month,
   }: SendBudgetAlertEmailOptions,
) => Promise<void>;
//# sourceMappingURL=client.d.ts.map
