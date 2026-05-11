import { chromium, type Page } from "@playwright/test";
import { expect, test } from "../fixtures";
import {
   deleteInvitationsByEmail,
   deleteUserByEmail,
   findInvitationByEmail,
   findPendingInvitationByEmail,
} from "../helpers/db";

const RUN_ID = `${process.pid}-${Math.floor(Math.random() * 1e9)}`;
const INVITEE_EMAIL = `invitee-ui-${RUN_ID}@example.com`;
const INVITEE_PASSWORD = "Test12345!";
const INVITEE_NAME = "Invitee UI Tester";

test.describe.configure({ mode: "serial" });

test.beforeEach(async () => {
   await deleteInvitationsByEmail(INVITEE_EMAIL);
   await deleteUserByEmail(INVITEE_EMAIL);
});

test.afterAll(async () => {
   await deleteInvitationsByEmail(INVITEE_EMAIL);
   await deleteUserByEmail(INVITEE_EMAIL);
});

async function sendInviteViaModal(page: Page, email: string) {
   await page.getByRole("button", { name: "Convidar membro" }).click();
   await expect(
      page.getByRole("heading", { name: "Convidar para o workspace" }),
   ).toBeVisible();
   await page.getByRole("textbox", { name: "E-mail", exact: true }).fill(email);
   await page.getByRole("button", { name: "Enviar convites" }).click();
   await expect(page.getByText(/[Cc]onvite enviado/)).toBeVisible();
   await expect(page.getByRole("cell", { name: email })).toBeVisible();
}

test("usuário sem conta abre invite, cria conta e entra na org", async ({
   page,
   e2eSession,
   baseURL,
}) => {
   test.setTimeout(120_000);

   await page.goto(
      `/${e2eSession.orgSlug}/${e2eSession.teamSlug}/settings/organization/members`,
   );
   await sendInviteViaModal(page, INVITEE_EMAIL);

   const invite = await findPendingInvitationByEmail(INVITEE_EMAIL);
   expect(invite).toBeTruthy();

   const browser = await chromium.launch();
   const inviteeContext = await browser.newContext({ baseURL });
   const inviteePage = await inviteeContext.newPage();

   await inviteePage.goto(`/callback/organization/invitation/${invite!.id}`);
   await inviteePage.waitForURL(/\/auth\/sign-in/, { timeout: 15_000 });

   await inviteePage
      .getByRole("link", { name: /criar conta|cadastr/i })
      .click();
   await inviteePage.waitForURL(/\/auth\/sign-up/, { timeout: 10_000 });

   await inviteePage.getByLabel("Nome", { exact: true }).fill(INVITEE_NAME);
   await inviteePage.getByLabel("Email", { exact: true }).fill(INVITEE_EMAIL);
   await inviteePage.getByRole("button", { name: "Continuar" }).click();

   await inviteePage
      .getByLabel("Senha", { exact: true })
      .fill(INVITEE_PASSWORD);
   await inviteePage
      .getByLabel(/Confirmar senha|Repita a senha/i)
      .fill(INVITEE_PASSWORD);
   await inviteePage.getByRole("button", { name: "Criar conta" }).click();

   await inviteePage.waitForURL(
      (url) =>
         /\/[^/]+\/[^/]+\//.test(url.pathname) &&
         !url.pathname.startsWith("/auth/") &&
         !url.pathname.startsWith("/callback/") &&
         !url.pathname.startsWith("/onboarding"),
      { timeout: 30_000 },
   );

   await expect
      .poll(
         async () =>
            (await findInvitationByEmail(INVITEE_EMAIL))?.status ?? "pending",
         { timeout: 10_000 },
      )
      .toBe("accepted");

   await inviteePage.goto(
      `/${e2eSession.orgSlug}/${e2eSession.teamSlug}/settings/organization/members`,
   );
   await expect(
      inviteePage.getByRole("cell", { name: INVITEE_EMAIL }).first(),
   ).toBeVisible({ timeout: 15_000 });

   await browser.close();
});
