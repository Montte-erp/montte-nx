import { createClient } from "@betternotify/core";
import { mockTransport } from "@betternotify/email";
import { describe, expect, it } from "vitest";
import { notificationCatalog } from "@core/notifications/catalog";
import { createNotificationsClient } from "@core/notifications/client";

function createTestClient() {
   const email = mockTransport();
   const client = createClient({
      catalog: notificationCatalog,
      transportsByChannel: { email },
   });
   return { client, email };
}

describe("notificationCatalog", () => {
   it("fails fast when Resend API key is empty", () => {
      expect(() => createNotificationsClient({ resendApiKey: " " })).toThrow(
         "RESEND_API_KEY is required to create notifications client.",
      );
   });

   it("sends a magic link email with rendered html and plain text", async () => {
      const { client, email } = createTestClient();

      await client.magicLink.send({
         to: "user@example.com",
         input: {
            magicLinkUrl: "https://app.montte.co/auth/magic-link?token=abc",
         },
      });

      expect(email.sent).toHaveLength(1);
      expect(email.sent[0]?.subject).toBe("Acesse sua conta Montte");
      expect(email.sent[0]?.html).toContain("Acessar Conta");
      expect(email.sent[0]?.text).toContain("Acessar Conta");
   });

   it("sends auth otp and organization invitation emails", async () => {
      const { client, email } = createTestClient();

      await client.emailOtp.send({
         to: "user@example.com",
         input: {
            otp: "123456",
            type: "email-verification",
         },
      });
      await client.organizationInvitation.send({
         to: "user@example.com",
         input: {
            invitedByEmail: "inviter@example.com",
            invitedByUsername: "Maria",
            inviteLink:
               "https://app.montte.co/callback/organization/invitation/abc",
            teamName: "Montte",
         },
      });

      expect(email.sent).toHaveLength(2);
      expect(email.sent[0]?.subject).toBe("Verifique seu e-mail");
      expect(email.sent[0]?.html).toContain("123 456");
      expect(email.sent[1]?.subject).toBe(
         "Convite para se juntar à equipe Montte no Montte",
      );
      expect(email.sent[1]?.html).toContain("Aceitar convite");
   });
});
