import { expect, test } from "../fixtures";
import {
   deleteInvitationsByEmail,
   findPendingInvitationByEmail,
} from "../helpers/db";

const INVITEE_EMAIL = `invitee-${Date.now()}@e2e.test.local`;

test.describe.configure({ mode: "serial" });

test.beforeEach(async () => {
   await deleteInvitationsByEmail(INVITEE_EMAIL);
});

test.afterAll(async () => {
   await deleteInvitationsByEmail(INVITEE_EMAIL);
});

test("envia convite via modal e cria invitation pendente no banco", async ({
   page,
   e2eSession,
}) => {
   await page.goto(
      `/${e2eSession.orgSlug}/${e2eSession.teamSlug}/settings/organization/members`,
   );

   await page.getByRole("button", { name: "Convidar membro" }).click();

   await expect(
      page.getByRole("heading", { name: "Convidar para o workspace" }),
   ).toBeVisible();

   await page.getByLabel("E-mail").fill(INVITEE_EMAIL);
   await page.getByRole("button", { name: "Enviar convites" }).click();

   await expect(page.getByText(/[Cc]onvite enviado/)).toBeVisible();

   const invite = await findPendingInvitationByEmail(INVITEE_EMAIL);
   expect(invite, "invitation row should exist").toBeTruthy();
   expect(invite?.status).toBe("pending");
});

test("convite com sessão errada mostra erro em pt-BR e redireciona", async ({
   page,
   e2eSession,
}) => {
   await page.goto(
      `/${e2eSession.orgSlug}/${e2eSession.teamSlug}/settings/organization/members`,
   );
   await page.getByRole("button", { name: "Convidar membro" }).click();
   await page.getByLabel("E-mail").fill(INVITEE_EMAIL);
   await page.getByRole("button", { name: "Enviar convites" }).click();
   await expect(page.getByText(/[Cc]onvite enviado/)).toBeVisible();

   const invite = await findPendingInvitationByEmail(INVITEE_EMAIL);
   expect(invite).toBeTruthy();

   await page.goto(`/callback/organization/invitation/${invite!.id}`);

   await expect(page.getByText(/destinatário|recipient/i).first()).toBeVisible({
      timeout: 10_000,
   });

   await page.waitForURL(/\/auth\/sign-in/, { timeout: 15_000 });
});
