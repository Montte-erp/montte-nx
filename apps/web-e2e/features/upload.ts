import { expect, type Page } from "@playwright/test";

export async function uploadOrganizationLogo(
   page: Page,
   filePath: string,
): Promise<{ status: number }> {
   await expect(
      page.getByRole("heading", { name: "Logo", exact: true }),
   ).toBeVisible();

   const fileChooserPromise = page.waitForEvent("filechooser");
   await page.getByText("Clique ou arraste para enviar").click();
   const chooser = await fileChooserPromise;
   await chooser.setFiles(filePath);

   const uploadResponse = page.waitForResponse(
      (r) => r.url().endsWith("/api/upload") && r.request().method() === "POST",
   );
   await page.getByRole("button", { name: "Salvar logo" }).click();
   const res = await uploadResponse;
   return { status: res.status() };
}

export async function uploadUserAvatar(
   page: Page,
   filePath: string,
): Promise<{ status: number }> {
   await expect(
      page.getByRole("heading", { name: "Foto de perfil", exact: true }),
   ).toBeVisible();

   const fileChooserPromise = page.waitForEvent("filechooser");
   await page.getByText("Clique ou arraste para enviar").click();
   const chooser = await fileChooserPromise;
   await chooser.setFiles(filePath);

   const uploadResponse = page.waitForResponse(
      (r) => r.url().endsWith("/api/upload") && r.request().method() === "POST",
   );
   await page.getByRole("button", { name: "Salvar foto" }).click();
   const res = await uploadResponse;
   return { status: res.status() };
}
