import path from "node:path";
import { expect, test } from "../fixtures";
import { uploadOrganizationLogo } from "../features/upload";
import { clearOrganizationLogoForEmail } from "../helpers/db";

const FIXTURE = path.join(import.meta.dirname, "fixtures", "logo.png");
const LOGO_URL_RX =
   /\/api\/files\/organization-logos\/.+\.(png|jpg|jpeg|webp|gif)$/i;

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ e2eSession }) => {
   await clearOrganizationLogoForEmail(e2eSession.email);
});

test("upload organization logo refletido em LogoSection e sidebar", async ({
   page,
   e2eSession,
}) => {
   await page.goto(
      `/${e2eSession.orgSlug}/${e2eSession.teamSlug}/settings/organization/general`,
   );

   const { status } = await uploadOrganizationLogo(page, FIXTURE);
   expect(status, `upload route status ${status}`).toBe(200);

   await expect(page.getByText("Logo atualizado com sucesso!")).toBeVisible();

   const logoImages = page.locator(
      `img[src*="/api/files/organization-logos/"]`,
   );
   await expect(logoImages).toHaveCount(2);
   for (let i = 0; i < 2; i++) {
      await expect(logoImages.nth(i)).toHaveAttribute("src", LOGO_URL_RX);
   }
});
