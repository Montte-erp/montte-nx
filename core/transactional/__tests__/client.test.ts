import { describe, expect, it, vi } from "vitest";
import { createMockResend } from "./helpers/create-mock-resend";

vi.mock("@core/environment/server", () => ({
   env: {
      RESEND_API_KEY: "re_test_123",
   },
}));

vi.mock("resend", () => ({
   Resend: function MockResend() {
      return createMockResend();
   },
}));

import {
   sendBudgetAlertEmail,
   sendEmailOTP,
   sendMagicLinkEmail,
   sendOrganizationInvitation,
} from "../src/client";

describe("sendOrganizationInvitation", () => {
   it("sends email with correct subject and recipient", async () => {
      const client = createMockResend();
      await sendOrganizationInvitation(client, {
         email: "test@example.com",
         invitedByUsername: "John",
         invitedByEmail: "john@example.com",
         teamName: "Acme",
         inviteLink: "https://app.montte.co/invite/123",
      });

      expect(client.emails.send).toHaveBeenCalledWith(
         expect.objectContaining({
            to: "test@example.com",
            subject: "Convite para se juntar à equipe Acme no Montte",
            from: "Montte <suporte@mail.montte.co>",
         }),
      );
   });
});

describe("sendEmailOTP", () => {
   it("sends sign-in OTP with correct subject", async () => {
      const client = createMockResend();
      await sendEmailOTP(client, {
         email: "test@example.com",
         otp: "123456",
         type: "sign-in",
      });

      expect(client.emails.send).toHaveBeenCalledWith(
         expect.objectContaining({
            to: "test@example.com",
            subject: "Faça login na sua conta",
         }),
      );
   });

   it("sends email-verification OTP with correct subject", async () => {
      const client = createMockResend();
      await sendEmailOTP(client, {
         email: "test@example.com",
         otp: "654321",
         type: "email-verification",
      });

      expect(client.emails.send).toHaveBeenCalledWith(
         expect.objectContaining({
            subject: "Verifique seu e-mail",
         }),
      );
   });

   it("sends forget-password OTP with correct subject", async () => {
      const client = createMockResend();
      await sendEmailOTP(client, {
         email: "test@example.com",
         otp: "111111",
         type: "forget-password",
      });

      expect(client.emails.send).toHaveBeenCalledWith(
         expect.objectContaining({
            subject: "Redefina sua senha",
         }),
      );
   });
});

describe("sendMagicLinkEmail", () => {
   it("sends email with correct subject and recipient", async () => {
      const client = createMockResend();
      await sendMagicLinkEmail(client, {
         email: "test@example.com",
         magicLinkUrl: "https://app.montte.co/magic/abc",
      });

      expect(client.emails.send).toHaveBeenCalledWith(
         expect.objectContaining({
            to: "test@example.com",
            subject: "Acesse sua conta Montte",
            from: "Montte <suporte@mail.montte.co>",
         }),
      );
   });
});

describe("sendBudgetAlertEmail", () => {
   it("sends email with category and percentage in subject", async () => {
      const client = createMockResend();
      await sendBudgetAlertEmail(client, {
         email: "test@example.com",
         categoryName: "Marketing",
         spentAmount: "R$ 800,00",
         limitAmount: "R$ 1.000,00",
         percentUsed: 80,
         alertThreshold: 75,
         month: "março",
      });

      expect(client.emails.send).toHaveBeenCalledWith(
         expect.objectContaining({
            to: "test@example.com",
            subject: "Alerta de meta: Marketing atingiu 80% do limite",
            from: "Montte <suporte@mail.montte.co>",
         }),
      );
   });
});
