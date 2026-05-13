import { chromium, type Browser, type BrowserContext } from "@playwright/test";
import { expect, test } from "../fixtures";
import { completeOnboarding, signUpViaApi } from "../features/auth";
import {
   deleteInvitationsByEmail,
   deleteUserByEmail,
   findFirstOrgByUserEmail,
   findPendingInvitationByEmail,
   findTeamByOrgAndSlug,
   findTeamMembership,
   findUserByEmail,
} from "../helpers/db";

const RUN_ID = Date.now();
const INVITEE_EMAIL = `space-access-invitee-${RUN_ID}@e2e.test.local`;
const OUTSIDER_EMAIL = `space-access-outsider-${RUN_ID}@e2e.test.local`;

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
   await deleteInvitationsByEmail(INVITEE_EMAIL);
   await deleteUserByEmail(INVITEE_EMAIL);
   await deleteUserByEmail(OUTSIDER_EMAIL);
});

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

test("acesso a espaço exige team_member; admin gerencia membership explícito", async ({
   page,
   e2eSession,
   baseURL,
}) => {
   const orgA = await findFirstOrgByUserEmail(e2eSession.email);
   expect(orgA, "fixture user must have an organization").toBeTruthy();

   await page.goto(`/${e2eSession.orgSlug}/${e2eSession.teamSlug}/inbox`);

   const spaceName = `Espaço Compartilhado ${RUN_ID}`;
   const spaceSlug = `espaco-compartilhado-${RUN_ID}`;
   const createResp = await page.request.post(
      "/api/auth/organization/create-team",
      {
         data: {
            name: spaceName,
            slug: spaceSlug,
            organizationId: orgA!.id,
         },
      },
   );
   expect(
      createResp.ok(),
      `create-team failed ${createResp.status()}: ${await createResp.text()}`,
   ).toBeTruthy();

   const newTeam = await findTeamByOrgAndSlug(e2eSession.orgSlug, spaceSlug);
   expect(newTeam).toBeTruthy();

   const userA = await findUserByEmail(e2eSession.email);
   expect(userA).toBeTruthy();
   const creatorMembership = await findTeamMembership(newTeam!.id, userA!.id);
   expect(
      creatorMembership,
      "criador deve ser adicionado como team_member pelo hook afterCreateTeam",
   ).toBeTruthy();

   const switchAsCreator = await page.request.post(
      "/api/auth/organization/set-active-team",
      { data: { teamId: newTeam!.id } },
   );
   expect(
      switchAsCreator.ok(),
      `criador deve trocar para o espaço recém-criado: ${switchAsCreator.status()} ${await switchAsCreator.text()}`,
   ).toBeTruthy();

   await page.goto(
      `/${e2eSession.orgSlug}/${e2eSession.teamSlug}/settings/organization/members`,
   );
   await page.getByRole("button", { name: "Convidar membro" }).click();
   await expect(
      page.getByRole("heading", { name: "Convidar para o workspace" }),
   ).toBeVisible();
   await page
      .getByRole("textbox", { name: "E-mail", exact: true })
      .fill(INVITEE_EMAIL);
   await page.getByRole("button", { name: "Enviar convites" }).click();
   await expect(page.getByText(/[Cc]onvite enviado/).first()).toBeVisible();

   await expect
      .poll(() => findPendingInvitationByEmail(INVITEE_EMAIL), {
         timeout: 5_000,
      })
      .toBeTruthy();
   const invite = await findPendingInvitationByEmail(INVITEE_EMAIL);
   expect(invite).toBeTruthy();

   let inviteeBrowser: Browser | null = null;
   let inviteeContext: BrowserContext | null = null;
   let outsiderBrowser: Browser | null = null;
   let outsiderContext: BrowserContext | null = null;
   try {
      const inviteeIsolated = await openIsolatedContext(baseURL);
      inviteeBrowser = inviteeIsolated.browser;
      inviteeContext = inviteeIsolated.context;
      const inviteePage = inviteeIsolated.page;

      await inviteePage.goto(`/callback/organization/invitation/${invite!.id}`);
      await inviteePage.waitForURL(/\/auth\/sign-in/, { timeout: 15_000 });

      const status = await signUpViaApi(inviteePage.request, {
         email: INVITEE_EMAIL,
         password: "Test12345!",
         name: "Invitee Space Access",
         workspace: "Invitee Space Access Workspace",
      });
      expect(status).toBe("created");

      await inviteePage.goto(`/callback/organization/invitation/${invite!.id}`);
      await inviteePage.waitForURL(
         (url) =>
            !url.pathname.startsWith("/callback/organization/invitation/"),
         { timeout: 20_000 },
      );

      const inviteeUser = await findUserByEmail(INVITEE_EMAIL);
      expect(inviteeUser).toBeTruthy();

      const inviteeBeforeAdd = await findTeamMembership(
         newTeam!.id,
         inviteeUser!.id,
      );
      expect(
         inviteeBeforeAdd,
         "novo membro da org NÃO deve virar team_member do espaço automaticamente",
      ).toBeUndefined();

      const switchBeforeAdd = await inviteePage.request.post(
         "/api/auth/organization/set-active-team",
         { data: { teamId: newTeam!.id } },
      );
      expect(
         switchBeforeAdd.status(),
         `B sem team_member deve ser bloqueado em setActiveTeam: ${await switchBeforeAdd.text()}`,
      ).toBe(403);

      const addResp = await page.request.post(
         "/api/auth/organization/add-team-member",
         {
            data: {
               teamId: newTeam!.id,
               userId: inviteeUser!.id,
               organizationId: orgA!.id,
            },
         },
      );
      expect(
         addResp.ok(),
         `admin add-team-member falhou ${addResp.status()}: ${await addResp.text()}`,
      ).toBeTruthy();

      const inviteeAfterAdd = await findTeamMembership(
         newTeam!.id,
         inviteeUser!.id,
      );
      expect(inviteeAfterAdd).toBeTruthy();

      const switchAfterAdd = await inviteePage.request.post(
         "/api/auth/organization/set-active-team",
         { data: { teamId: newTeam!.id } },
      );
      expect(
         switchAfterAdd.ok(),
         `B com team_member deve trocar: ${switchAfterAdd.status()} ${await switchAfterAdd.text()}`,
      ).toBeTruthy();

      const outsiderIsolated = await openIsolatedContext(baseURL);
      outsiderBrowser = outsiderIsolated.browser;
      outsiderContext = outsiderIsolated.context;
      const outsiderPage = outsiderIsolated.page;

      const outStatus = await signUpViaApi(outsiderPage.request, {
         email: OUTSIDER_EMAIL,
         password: "Test12345!",
         name: "Outsider Tester",
         workspace: `Outsider Workspace ${RUN_ID}`,
      });
      expect(outStatus).toBe("created");

      const outsiderSlugs = await completeOnboarding(
         outsiderPage,
         `Outsider Workspace ${RUN_ID}`,
      );
      expect(outsiderSlugs.orgSlug).not.toBe(e2eSession.orgSlug);

      const outsiderSwitch = await outsiderPage.request.post(
         "/api/auth/organization/set-active-team",
         { data: { teamId: newTeam!.id } },
      );
      expect(
         outsiderSwitch.ok(),
         "outsider de outra org não pode trocar para espaço externo",
      ).toBeFalsy();

      await outsiderPage.goto(`/${e2eSession.orgSlug}/${newTeam!.slug}/inbox`);
      await outsiderPage.waitForURL(
         (url) =>
            !url.pathname.startsWith(
               `/${e2eSession.orgSlug}/${newTeam!.slug}/`,
            ),
         { timeout: 15_000 },
      );
      expect(outsiderPage.url()).not.toContain(
         `/${e2eSession.orgSlug}/${newTeam!.slug}/`,
      );
   } finally {
      await Promise.allSettled([
         inviteeContext?.close(),
         inviteeBrowser?.close(),
         outsiderContext?.close(),
         outsiderBrowser?.close(),
      ]);
   }
});
