import path from "node:path";
import { expect, test } from "../fixtures";
import { uploadOrganizationLogo } from "../features/upload";

const FIXTURE = path.join(import.meta.dirname, "fixtures", "logo.png");

test("upload organization logo", async ({ page, e2eSession }) => {
   await page.goto(
      `/${e2eSession.orgSlug}/${e2eSession.teamSlug}/settings/organization/general`,
   );

   const { status } = await uploadOrganizationLogo(page, FIXTURE);
   expect(status, `upload route status ${status}`).toBe(200);

   await expect(page.getByText("Logo atualizado com sucesso!")).toBeVisible();
});
