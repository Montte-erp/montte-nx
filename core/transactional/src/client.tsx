import { Resend } from "resend";
import BudgetAlertEmail from "@core/transactional/emails/budget-alert";
import MagicLinkEmail from "@core/transactional/emails/magic-link";
import OrganizationInvitationEmail from "@core/transactional/emails/organization-invitation";
import OTPEmail from "@core/transactional/emails/otp";

export {
   createResendClient,
   type ResendClient,
} from "@core/transactional/utils";

export function getResendClient(apiKey: string): Resend {
   return new Resend(apiKey);
}

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
const name = "Montte";
export const sendOrganizationInvitation = async (
   client: Resend,
   {
      email,
      invitedByUsername,
      invitedByEmail,
      teamName,
      inviteLink,
   }: SendOrganizationInvitationOptions,
) => {
   const subject = `Convite para se juntar à equipe ${teamName} no Montte`;
   await client.emails.send({
      from: `${name} <suporte@mail.montte.co>`,
      react: (
         <OrganizationInvitationEmail
            invitedByEmail={invitedByEmail}
            invitedByUsername={invitedByUsername}
            inviteLink={inviteLink}
            teamName={teamName}
         />
      ),
      subject,
      to: email,
   });
};

export const sendEmailOTP = async (
   client: Resend,
   { email, otp, type }: SendEmailOTPOptions,
) => {
   const getSubject = () => {
      switch (type) {
         case "sign-in":
            return "Faça login na sua conta";
         case "email-verification":
            return "Verifique seu e-mail";
         case "forget-password":
            return "Redefina sua senha";
         default:
            return "Verifique seu e-mail";
      }
   };
   await client.emails.send({
      from: `${name} <suporte@mail.montte.co>`,
      react: <OTPEmail otp={otp} type={type} />,
      subject: getSubject(),
      to: email,
   });
};

export interface SendMagicLinkEmailOptions {
   email: string;
   magicLinkUrl: string;
}

export const sendMagicLinkEmail = async (
   client: Resend,
   { email, magicLinkUrl }: SendMagicLinkEmailOptions,
) => {
   const subject = "Acesse sua conta Montte";
   await client.emails.send({
      from: `${name} <suporte@mail.montte.co>`,
      react: <MagicLinkEmail magicLinkUrl={magicLinkUrl} />,
      subject,
      to: email,
   });
};

export interface SendBudgetAlertEmailOptions {
   email: string;
   categoryName: string;
   spentAmount: string;
   limitAmount: string;
   percentUsed: number;
   alertThreshold: number;
   month: string;
}

export const sendBudgetAlertEmail = async (
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
) => {
   const subject = `Alerta de meta: ${categoryName} atingiu ${percentUsed}% do limite`;
   await client.emails.send({
      from: `${name} <suporte@mail.montte.co>`,
      react: (
         <BudgetAlertEmail
            alertThreshold={alertThreshold}
            categoryName={categoryName}
            limitAmount={limitAmount}
            month={month}
            percentUsed={percentUsed}
            spentAmount={spentAmount}
         />
      ),
      subject,
      to: email,
   });
};
