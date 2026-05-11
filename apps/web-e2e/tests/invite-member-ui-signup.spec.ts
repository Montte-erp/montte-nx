import {
   chromium,
   type Browser,
   type BrowserContext,
   type Page,
} from "@playwright/test";
import { expect, test } from "../fixtures";
import { signUpViaApi } from "../features/auth";
import {
   deleteInvitationsByEmail,
   deleteUserByEmail,
   findInvitationByEmail,
   findPendingInvitationByEmail,
} from "../helpers/db";

const RUN_ID = `${process.pid}-${Math.floor(Math.random() * 1e9)}`;
const INVITEE_EMAIL = `invitee-ml-${RUN_ID}@example.com`;
const OTHER_USER_EMAIL = `other-ml-${RUN_ID}@example.com`;
const OTHER_USER_PASSWORD = "Test12345!";

test.describe.configure({ mode: "serial" });

test.beforeEach(async () => {
   await deleteInvitationsByEmail(INVITEE_EMAIL);
   await deleteUserByEmail(INVITEE_EMAIL);
});

test.afterAll(async () => {
   await deleteInvitationsByEmail(INVITEE_EMAIL);
   await deleteUserByEmail(INVITEE_EMAIL);
   await deleteUserByEmail(OTHER_USER_EMAIL);
});

async function sendInviteViaModal(page: Page, email: string) {
   await page.getByRole("button", { name: "Convidar membro" }).click();
   await expect(
      page.getByRole("heading", { name: "Convidar para o workspace" }),
   ).toBeVisible();
   await page.getByRole("textbox", { name: "E-mail", exact: true }).fill(email);
   await page.getByRole("button", { name: "Enviar convites" }).click();
   await expect(page.getByText(/[Cc]onvite enviado/).first()).toBeVisible();
   await expect(page.getByRole("cell", { name: email })).toBeVisible();
}

async function openIsolatedContext(baseURL: string | undefined) {
   const browser = await chromium.launch();
   const context = await browser.newContext({
      baseURL,
      storageState: { cookies: [], origins: [] },
      extraHTTPHeaders: { Origin: baseURL ?? "" },
   });
   const page = await context.newPage();
   return { browser, context, page };
}

async function signInViaMagicLink(
   page: Page,
   context: import("@playwright/test").BrowserContext,
   email: string,
   callbackURL: string,
) {
   const origin = new URL(callbackURL).origin;
   const sendRes = await context.request.post("/api/auth/sign-in/magic-link", {
      data: { email, callbackURL },
      headers: { Origin: origin },
   });
   expect(
      sendRes.ok(),
      `magic-link send failed ${sendRes.status()}: ${await sendRes.text()}`,
   ).toBeTruthy();
   const linkRes = await context.request.get(
      `/api/auth/dev/magic-link?email=${encodeURIComponent(email)}`,
   );
   const { url } = await linkRes.json();
   expect(url).toBeTruthy();
   await page.goto(url);
}

test("invite + magic link: usuário sem conta cria conta e entra na org", async ({
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

   const inviteUrl = `/callback/organization/invitation/${invite!.id}`;
   let browser: Browser | null = null;
   let context: BrowserContext | null = null;
   try {
      const isolated = await openIsolatedContext(baseURL);
      browser = isolated.browser;
      context = isolated.context;
      const inviteePage = isolated.page;

      await inviteePage.goto(inviteUrl);
      await inviteePage.waitForURL(
         (url) =>
            url.pathname === "/auth/sign-in" &&
            url.searchParams.get("redirect") === inviteUrl,
         { timeout: 15_000 },
      );

      await inviteePage
         .getByRole("link", { name: /Continuar com link mágico/i })
         .click();
      await inviteePage.waitForURL(
         (url) =>
            url.pathname === "/auth/magic-link" &&
            url.searchParams.get("redirect") === inviteUrl,
         { timeout: 10_000 },
      );

      await signInViaMagicLink(
         inviteePage,
         context,
         INVITEE_EMAIL,
         `${baseURL}${inviteUrl}`,
      );

      await inviteePage.waitForURL(
         (url) =>
            /^\/[^/]+\/[^/]+\//.test(url.pathname) &&
            !url.pathname.startsWith("/auth/") &&
            !url.pathname.startsWith("/callback/"),
         { timeout: 30_000 },
      );

      await expect
         .poll(
            async () =>
               (await findInvitationByEmail(INVITEE_EMAIL))?.status ??
               "pending",
            { timeout: 10_000 },
         )
         .toBe("accepted");

      await inviteePage.goto(
         `/${e2eSession.orgSlug}/${e2eSession.teamSlug}/settings/organization/members`,
      );
      await expect(
         inviteePage.getByRole("cell", { name: INVITEE_EMAIL }).first(),
      ).toBeVisible({ timeout: 15_000 });
   } finally {
      await Promise.allSettled([context?.close(), browser?.close()]);
   }
});

test("invite + magic link: usuário com conta loga e aceita", async ({
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
   const inviteUrl = `/callback/organization/invitation/${invite!.id}`;

   let browser: Browser | null = null;
   let context: BrowserContext | null = null;
   try {
      const isolated = await openIsolatedContext(baseURL);
      browser = isolated.browser;
      context = isolated.context;
      const inviteePage = isolated.page;
      const status = await signUpViaApi(context.request, {
         email: INVITEE_EMAIL,
         password: "Test12345!",
         name: "Invitee ML",
         workspace: "Invitee Workspace",
      });
      expect(status).toBe("created");
      await context.clearCookies();
      await inviteePage.goto(inviteUrl);

      await inviteePage.waitForURL((url) => url.pathname === "/auth/sign-in", {
         timeout: 15_000,
      });

      await inviteePage
         .getByRole("link", { name: /Continuar com link mágico/i })
         .click();
      await signInViaMagicLink(
         inviteePage,
         context,
         INVITEE_EMAIL,
         `${baseURL}${inviteUrl}`,
      );

      await inviteePage.waitForURL(
         (url) =>
            /^\/[^/]+\/[^/]+\//.test(url.pathname) &&
            !url.pathname.startsWith("/auth/") &&
            !url.pathname.startsWith("/callback/"),
         { timeout: 30_000 },
      );

      await expect
         .poll(
            async () =>
               (await findInvitationByEmail(INVITEE_EMAIL))?.status ??
               "pending",
            { timeout: 10_000 },
         )
         .toBe("accepted");
   } finally {
      await Promise.allSettled([context?.close(), browser?.close()]);
   }
});

test("invite: usuário com conta já logado aceita direto pelo URL", async ({
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
   const inviteUrl = `/callback/organization/invitation/${invite!.id}`;

   let browser: Browser | null = null;
   let context: BrowserContext | null = null;
   try {
      const isolated = await openIsolatedContext(baseURL);
      browser = isolated.browser;
      context = isolated.context;
      const inviteePage = isolated.page;
      const status = await signUpViaApi(context.request, {
         email: INVITEE_EMAIL,
         password: "Test12345!",
         name: "Invitee Direct",
         workspace: "Invitee Workspace",
      });
      expect(status).toBe("created");
      await context.request.post("/api/auth/sign-in/email", {
         data: { email: INVITEE_EMAIL, password: "Test12345!" },
      });

      await inviteePage.goto(inviteUrl);
      await inviteePage.waitForURL(
         (url) =>
            /^\/[^/]+\/[^/]+\//.test(url.pathname) &&
            !url.pathname.startsWith("/auth/") &&
            !url.pathname.startsWith("/callback/"),
         { timeout: 20_000 },
      );

      await expect
         .poll(
            async () =>
               (await findInvitationByEmail(INVITEE_EMAIL))?.status ??
               "pending",
            { timeout: 10_000 },
         )
         .toBe("accepted");
   } finally {
      await Promise.allSettled([context?.close(), browser?.close()]);
   }
});

test("invite: logado com email errado é redirecionado e convite continua pendente", async ({
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
   const inviteUrl = `/callback/organization/invitation/${invite!.id}`;

   let browser: Browser | null = null;
   let context: BrowserContext | null = null;
   try {
      const isolated = await openIsolatedContext(baseURL);
      browser = isolated.browser;
      context = isolated.context;
      const otherPage = isolated.page;
      await signUpViaApi(context.request, {
         email: OTHER_USER_EMAIL,
         password: OTHER_USER_PASSWORD,
         name: "Other User",
         workspace: "Other Workspace",
      });
      await context.request.post("/api/auth/sign-in/email", {
         data: { email: OTHER_USER_EMAIL, password: OTHER_USER_PASSWORD },
      });

      await otherPage.goto(inviteUrl);
      await otherPage.waitForURL(
         (url) => !url.pathname.startsWith("/callback/"),
         {
            timeout: 20_000,
         },
      );

      expect(
         (await findInvitationByEmail(INVITEE_EMAIL))?.status ?? "pending",
      ).toBe("pending");
   } finally {
      await Promise.allSettled([context?.close(), browser?.close()]);
   }
});

test("invite inválido: ID inexistente redireciona sem quebrar", async ({
   baseURL,
}) => {
   test.setTimeout(60_000);

   let browser: Browser | null = null;
   let context: BrowserContext | null = null;
   try {
      const isolated = await openIsolatedContext(baseURL);
      browser = isolated.browser;
      context = isolated.context;
      const otherPage = isolated.page;
      await signUpViaApi(context.request, {
         email: OTHER_USER_EMAIL,
         password: OTHER_USER_PASSWORD,
         name: "Other User",
         workspace: "Other Workspace",
      });
      await context.request.post("/api/auth/sign-in/email", {
         data: { email: OTHER_USER_EMAIL, password: OTHER_USER_PASSWORD },
      });

      await otherPage.goto("/callback/organization/invitation/nonexistent-id");
      await otherPage.waitForURL(
         (url) =>
            !url.pathname.startsWith("/callback/organization/invitation/"),
         { timeout: 15_000 },
      );
   } finally {
      await Promise.allSettled([context?.close(), browser?.close()]);
   }
});
