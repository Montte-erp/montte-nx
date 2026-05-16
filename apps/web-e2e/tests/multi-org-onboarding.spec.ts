import { test, expect } from "../fixtures";
import { createAdditionalOrganization } from "../features/auth";
import { findFirstOrgByUserEmail, findTeamByOrgAndSlug } from "../helpers/db";

test("cria nova organização pelo onboarding sem exigir CNPJ", async ({
   page,
   e2eSession,
}) => {
   const firstOrg = await findFirstOrgByUserEmail(e2eSession.email);
   expect(firstOrg?.onboardingCompleted).toBeTruthy();

   const workspace = `E2E Multi Org ${Date.now()}`;
   const second = await createAdditionalOrganization(page, workspace);

   expect(second.orgSlug).not.toBe(e2eSession.orgSlug);
   expect(second.teamSlug).toBe("principal");

   const team = await findTeamByOrgAndSlug(second.orgSlug, second.teamSlug);
   expect(team?.onboardingCompleted).toBeTruthy();
   expect(team?.onboardingProducts).toEqual(["finance"]);
});
