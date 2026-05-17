import { createNotify } from "@betternotify/core";
import { emailChannel } from "@betternotify/email";
import { reactEmail } from "@betternotify/react-email";
import { z } from "zod";
import { MagicLinkEmail } from "@core/notifications/emails/magic-link";
import { OrganizationInvitationEmail } from "@core/notifications/emails/organization-invitation";
import { OtpEmail } from "@core/notifications/emails/otp";

const email = emailChannel({
   defaults: {
      from: { name: "Montte", email: "suporte@mail.montte.co" },
   },
});

const notify = createNotify({ channels: { email } });

const magicLinkInputSchema = z.object({
   magicLinkUrl: z.string().url(),
});

const otpInputSchema = z.object({
   otp: z.string().min(1),
   type: z.enum([
      "sign-in",
      "email-verification",
      "forget-password",
      "change-email",
   ]),
});

const organizationInvitationInputSchema = z.object({
   invitedByUsername: z.string().min(1),
   invitedByEmail: z.string().email(),
   teamName: z.string().min(1),
   inviteLink: z.string().url(),
});

export const notificationCatalog = notify.catalog({
   magicLink: notify
      .email()
      .input(magicLinkInputSchema)
      .subject("Acesse sua conta Montte")
      .template(({ input }) =>
         reactEmail(
            MagicLinkEmail,
            { magicLinkUrl: input.magicLinkUrl },
            { plainText: true },
         ),
      ),
   emailOtp: notify
      .email()
      .input(otpInputSchema)
      .subject(({ input }) => {
         switch (input.type) {
            case "sign-in":
               return "Faça login na sua conta";
            case "email-verification":
               return "Verifique seu e-mail";
            case "forget-password":
               return "Redefina sua senha";
            case "change-email":
               return "Confirme seu novo e-mail";
            default:
               return "Verifique seu e-mail";
         }
      })
      .template(({ input }) =>
         reactEmail(OtpEmail, input, { plainText: true }),
      ),
   organizationInvitation: notify
      .email()
      .input(organizationInvitationInputSchema)
      .subject(
         ({ input }) =>
            `Convite para se juntar à equipe ${input.teamName} no Montte`,
      )
      .template(({ input }) =>
         reactEmail(OrganizationInvitationEmail, input, { plainText: true }),
      ),
});

export type NotificationCatalog = typeof notificationCatalog;
