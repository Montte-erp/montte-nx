import path from "node:path";
import { expect, test } from "../fixtures";
import { uploadUserAvatar } from "../features/upload";
import { clearUserAvatarByEmail, findUserByEmail } from "../helpers/db";

const FIXTURE = path.join(import.meta.dirname, "fixtures", "logo.png");
const AVATAR_URL_RX =
   /\/api\/files\/[^/]+\/user-avatars\/.+\.(png|jpg|jpeg|webp|gif)$/i;
test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ e2eSession }) => {
   await clearUserAvatarByEmail(e2eSession.email);
});

test("upload user avatar via better-upload route", async ({
   page,
   e2eSession,
}) => {
   await page.goto(
      `/${e2eSession.orgSlug}/${e2eSession.teamSlug}/settings/profile`,
   );

   const { status } = await uploadUserAvatar(page, FIXTURE);
   expect(status, `upload route status ${status}`).toBe(200);

   await expect(page.getByText("Foto de perfil atualizada!")).toBeVisible();
   await expect
      .poll(
         async () => (await findUserByEmail(e2eSession.email))?.image ?? "",
         { timeout: 10_000 },
      )
      .toMatch(AVATAR_URL_RX);

   await page.reload();
   await expect(
      page.locator(`img[src*="/api/files/"][src*="/user-avatars/"]`).first(),
   ).toHaveAttribute("src", AVATAR_URL_RX);
});
