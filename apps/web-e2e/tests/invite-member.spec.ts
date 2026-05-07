import { chromium, type Page } from "@playwright/test";
import { expect, test } from "../fixtures";
import { signUpViaApi } from "../features/auth";
import {
   deleteInvitationsByEmail,
   deleteUserByEmail,
   findInvitationByEmail,
   findPendingInvitationByEmail,
} from "../helpers/db";

const INVITEE_EMAIL = `invitee-${Date.now()}@e2e.test.local`;

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
   await expect(page.getByText("Convites pendentes")).toBeVisible();
   await expect(page.getByRole("cell", { name: email })).toBeVisible();
}

test("envia convite via modal e atualiza tabela com group pendente", async ({
   page,
   e2eSession,
}) => {
   await page.goto(
      `/${e2eSession.orgSlug}/${e2eSession.teamSlug}/settings/organization/members`,
   );

   await sendInviteViaModal(page, INVITEE_EMAIL);

   await expect
      .poll(
         async () =>
            (await findPendingInvitationByEmail(INVITEE_EMAIL))?.status,
         { timeout: 5_000 },
      )
      .toBe("pending");
});

test("convite com sessão errada mostra erro em pt-BR e redireciona", async ({
   page,
   e2eSession,
}) => {
   await page.goto(
      `/${e2eSession.orgSlug}/${e2eSession.teamSlug}/settings/organization/members`,
   );
   await sendInviteViaModal(page, INVITEE_EMAIL);

   const invite = await findPendingInvitationByEmail(INVITEE_EMAIL);
   expect(invite).toBeTruthy();

   await page.goto(`/callback/organization/invitation/${invite!.id}`);

   await expect(page.getByText(/destinatário|recipient/i).first()).toBeVisible({
      timeout: 10_000,
   });
   await page.waitForURL(/\/auth\/sign-in/, { timeout: 15_000 });
});

test("aceita convite automaticamente após sign-up quando invitee não tem conta", async ({
   page,
   e2eSession,
   baseURL,
}) => {
   await page.goto(
      `/${e2eSession.orgSlug}/${e2eSession.teamSlug}/settings/organization/members`,
   );
   await sendInviteViaModal(page, INVITEE_EMAIL);

   await expect
      .poll(() => findPendingInvitationByEmail(INVITEE_EMAIL), {
         timeout: 5_000,
      })
      .toBeTruthy();
   const invite = await findPendingInvitationByEmail(INVITEE_EMAIL);
   expect(invite).toBeTruthy();

   const browser = await chromium.launch();
   const inviteeContext = await browser.newContext({
      baseURL,
      extraHTTPHeaders: { Origin: baseURL ?? "" },
   });
   const inviteePage = await inviteeContext.newPage();

   await inviteePage.goto(`/callback/organization/invitation/${invite!.id}`);
   await inviteePage.waitForURL(/\/auth\/sign-in/, { timeout: 15_000 });

   const status = await signUpViaApi(inviteePage.request, {
      email: INVITEE_EMAIL,
      password: "Test12345!",
      name: "Invitee Tester",
      workspace: "Invitee Workspace",
   });
   expect(status).toBe("created");

   await inviteePage.goto(`/callback/organization/invitation/${invite!.id}`);
   await inviteePage.waitForURL(
      (url) => !url.pathname.startsWith("/callback/organization/invitation/"),
      { timeout: 20_000 },
   );

   await expect
      .poll(
         async () =>
            (await findInvitationByEmail(INVITEE_EMAIL))?.status ?? "pending",
         { timeout: 5_000 },
      )
      .toBe("accepted");

   await page.goto(
      `/${e2eSession.orgSlug}/${e2eSession.teamSlug}/settings/organization/members`,
   );
   await expect(page.getByText("Membros").first()).toBeVisible();
   await expect(
      page.getByRole("cell", { name: /Invitee Tester/ }).first(),
   ).toBeVisible();
   await expect(
      page.getByRole("cell", { name: INVITEE_EMAIL }).first(),
   ).toBeVisible();

   await inviteePage.goto(
      `/${e2eSession.orgSlug}/${e2eSession.teamSlug}/settings/organization/members`,
   );
   await expect(
      inviteePage.getByRole("cell", { name: INVITEE_EMAIL }).first(),
   ).toBeVisible({ timeout: 15_000 });

   await browser.close();
});

test("aceita convite com sucesso quando logado com a conta convidada", async ({
   page,
   e2eSession,
   baseURL,
}) => {
   await page.goto(
      `/${e2eSession.orgSlug}/${e2eSession.teamSlug}/settings/organization/members`,
   );
   await sendInviteViaModal(page, INVITEE_EMAIL);

   await expect
      .poll(() => findPendingInvitationByEmail(INVITEE_EMAIL), {
         timeout: 5_000,
      })
      .toBeTruthy();
   const invite = await findPendingInvitationByEmail(INVITEE_EMAIL);
   expect(invite).toBeTruthy();

   const browser = await chromium.launch();
   const inviteeContext = await browser.newContext({
      baseURL,
      extraHTTPHeaders: { Origin: baseURL ?? "" },
   });
   const inviteePage = await inviteeContext.newPage();
   await inviteePage.goto("/");

   const status = await signUpViaApi(inviteePage.request, {
      email: INVITEE_EMAIL,
      password: "Test12345!",
      name: "Invitee Tester",
      workspace: "Invitee Workspace",
   });
   expect(status).toBe("created");

   await inviteePage.goto(`/callback/organization/invitation/${invite!.id}`);
   await inviteePage.waitForURL(
      (url) => !url.pathname.startsWith("/callback/organization/invitation/"),
      { timeout: 15_000 },
   );

   await expect
      .poll(
         async () =>
            (await findInvitationByEmail(INVITEE_EMAIL))?.status ?? "pending",
         { timeout: 5_000 },
      )
      .toBe("accepted");

   await page.goto(
      `/${e2eSession.orgSlug}/${e2eSession.teamSlug}/settings/organization/members`,
   );
   await expect(page.getByText("Membros").first()).toBeVisible();
   await expect(
      page.getByRole("cell", { name: /Invitee Tester/ }).first(),
   ).toBeVisible();
   await expect(
      page.getByRole("cell", { name: INVITEE_EMAIL }).first(),
   ).toBeVisible();

   await inviteePage.goto(
      `/${e2eSession.orgSlug}/${e2eSession.teamSlug}/settings/organization/members`,
   );
   await expect(
      inviteePage.getByRole("cell", { name: INVITEE_EMAIL }).first(),
   ).toBeVisible({ timeout: 15_000 });

   await browser.close();
});
