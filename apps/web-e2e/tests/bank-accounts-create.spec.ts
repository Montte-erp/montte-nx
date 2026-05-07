import { expect, test } from "../fixtures";
import { deleteBankAccountByName, findTeamByOrgAndSlug } from "../helpers/db";

const stamp = () => `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
const created: string[] = [];

async function gotoBankAccounts(
   page: Parameters<Parameters<typeof test>[1]>[0]["page"],
   session: { orgSlug: string; teamSlug: string },
) {
   await page.goto(`/${session.orgSlug}/${session.teamSlug}/bank-accounts`);
   await expect(
      page.getByRole("heading", { name: "Contas Bancárias" }),
   ).toBeVisible();
}

test.afterEach(async ({ e2eSession }) => {
   const team = await findTeamByOrgAndSlug(
      e2eSession.orgSlug,
      e2eSession.teamSlug,
   );
   if (!team) return;
   for (const name of created.splice(0)) {
      await deleteBankAccountByName(team.id, name);
   }
});

test("cria conta bancária com validações, máscaras e autocomplete", async ({
   page,
   e2eSession,
}) => {
   const name = `Itaú E2E ${stamp()}`;
   created.push(name);

   await gotoBankAccounts(page, e2eSession);
   await page.getByRole("button", { name: "Nova Conta" }).click();

   const sheet = page.getByRole("dialog");
   const submit = sheet.getByRole("button", { name: "Criar conta" });

   // submit desabilitado ao abrir (form inválido)
   await expect(submit).toBeDisabled();

   // erro de nome no blur
   await sheet.getByLabel("Nome").fill("a");
   await sheet.getByLabel("Nome").blur();
   await expect(
      sheet.getByText("Nome deve ter no mínimo 2 caracteres."),
   ).toBeVisible();

   await sheet.getByLabel("Nome").fill(name);

   // detalhes bancários visíveis para tipo bancário (default checking)
   await expect(sheet.getByText("Detalhes bancários")).toBeVisible();

   // bankCode hard limit 3 dígitos
   const code = sheet.getByLabel("Código do banco");
   await code.fill("123456789");
   await expect(code).toHaveValue("123");

   // autocomplete preenche bankName + bankCode
   const autocomplete = sheet.getByPlaceholder("Digite o nome ou código");
   await autocomplete.click();
   await autocomplete.fill("itau");
   await page.getByRole("option").first().click();
   await expect(code).toHaveValue(/^\d{1,3}$/);

   // máscara agência: limita a 4-1
   const branch = sheet.getByLabel("Agência");
   await branch.fill("12345-67");
   await expect(branch).toHaveValue("1234-5");

   // máscara conta: aceita 12 dígitos + dígito verificador
   await sheet.getByLabel("Conta").fill("56789-0");

   // submit habilitado e cria
   await expect(submit).toBeEnabled();
   await submit.click();
   await expect(page.getByText("Conta criada com sucesso.")).toBeVisible();
   await expect(page.getByRole("cell", { name })).toBeVisible();

   // inline edit do nome (única coluna editável inline)
   const renamed = `${name} renomeado`;
   created.push(renamed);
   await page.getByRole("cell", { name }).click();
   const inlineInput = page.getByRole("textbox").first();
   await inlineInput.fill(renamed);
   await inlineInput.press("Enter");
   await expect(page.getByRole("cell", { name: renamed })).toBeVisible();
});

test("toggle de tipo + caixa físico (sem detalhes bancários)", async ({
   page,
   e2eSession,
}) => {
   const name = `Caixa E2E ${stamp()}`;
   created.push(name);

   await gotoBankAccounts(page, e2eSession);
   await page.getByRole("button", { name: "Nova Conta" }).click();
   const sheet = page.getByRole("dialog");

   await sheet.getByLabel("Nome").fill(name);

   // checking default → bloco visível
   await expect(sheet.getByText("Detalhes bancários")).toBeVisible();

   // → cash → some
   await sheet.getByLabel("Tipo").click();
   await page.getByRole("option", { name: "Caixa Físico" }).click();
   await expect(sheet.getByText("Detalhes bancários")).not.toBeVisible();

   // → savings → volta
   await sheet.getByLabel("Tipo").click();
   await page.getByRole("option", { name: "Conta Poupança" }).click();
   await expect(sheet.getByText("Detalhes bancários")).toBeVisible();

   // volta para cash e cria sem detalhes
   await sheet.getByLabel("Tipo").click();
   await page.getByRole("option", { name: "Caixa Físico" }).click();
   await sheet.getByRole("button", { name: "Criar conta" }).click();

   await expect(page.getByText("Conta criada com sucesso.")).toBeVisible();
   await expect(page.getByRole("cell", { name })).toBeVisible();
});

test("cancelar fecha sheet sem criar", async ({ page, e2eSession }) => {
   await gotoBankAccounts(page, e2eSession);
   await page.getByRole("button", { name: "Nova Conta" }).click();
   const sheet = page.getByRole("dialog");

   await sheet.getByLabel("Nome").fill("Não deve criar");
   await sheet.getByRole("button", { name: "Cancelar" }).click();

   await expect(sheet).not.toBeVisible();
   await expect(
      page.getByRole("cell", { name: "Não deve criar" }),
   ).not.toBeVisible();
});

test("filtra por tipo e exclui via alert dialog", async ({
   page,
   e2eSession,
}) => {
   const checkingName = `Checking E2E ${stamp()}`;
   const cashName = `Caixa E2E ${stamp()}`;
   created.push(checkingName, cashName);

   await gotoBankAccounts(page, e2eSession);

   // criar checking
   await page.getByRole("button", { name: "Nova Conta" }).click();
   await page.getByLabel("Nome").fill(checkingName);
   await page.getByPlaceholder("Digite o nome ou código").fill("itau");
   await page.getByRole("option").first().click();
   await page.getByRole("button", { name: "Criar conta" }).click();
   await expect(page.getByRole("cell", { name: checkingName })).toBeVisible();

   // criar caixa
   await page.getByRole("button", { name: "Nova Conta" }).click();
   await page.getByLabel("Nome").fill(cashName);
   await page.getByLabel("Tipo").click();
   await page.getByRole("option", { name: "Caixa Físico" }).click();
   await page.getByRole("button", { name: "Criar conta" }).click();
   await expect(page.getByRole("cell", { name: cashName })).toBeVisible();

   // filtrar Caixa Físico
   await page.getByRole("button", { name: "Caixa Físico" }).first().click();
   await expect(page.getByRole("cell", { name: cashName })).toBeVisible();
   await expect(
      page.getByRole("cell", { name: checkingName }),
   ).not.toBeVisible();

   // excluir caixa via alert dialog
   const row = page.getByRole("row", { name: new RegExp(cashName) });
   await row.getByRole("button", { name: "Excluir" }).click();
   const alert = page.getByRole("alertdialog");
   await expect(alert).toBeVisible();
   await alert.getByRole("button", { name: "Excluir" }).click();

   await expect(page.getByText("Conta excluída com sucesso.")).toBeVisible();
   await expect(page.getByRole("cell", { name: cashName })).not.toBeVisible();
});

test("busca server-side por nome e exclusão em massa", async ({
   page,
   e2eSession,
}) => {
   const a = `Bulk-A E2E ${stamp()}`;
   const b = `Bulk-B E2E ${stamp()}`;
   created.push(a, b);

   await gotoBankAccounts(page, e2eSession);

   for (const name of [a, b]) {
      await page.getByRole("button", { name: "Nova Conta" }).click();
      await page.getByLabel("Nome").fill(name);
      await page.getByLabel("Tipo").click();
      await page.getByRole("option", { name: "Caixa Físico" }).click();
      await page.getByRole("button", { name: "Criar conta" }).click();
      await expect(page.getByRole("cell", { name })).toBeVisible();
   }

   // server-side search filtra a lista
   await page.getByPlaceholder("Buscar conta por nome...").fill("Bulk-A");
   await expect(page.getByRole("cell", { name: a })).toBeVisible();
   await expect(page.getByRole("cell", { name: b })).not.toBeVisible();
   await page.getByPlaceholder("Buscar conta por nome...").fill("");

   // selecionar ambos e bulk delete
   await page.getByRole("checkbox", { name: /selecionar todas/i }).check();
   await page.getByRole("button", { name: /^Excluir/ }).click();
   const alert = page.getByRole("alertdialog");
   await alert.getByRole("button", { name: "Excluir" }).click();
   await expect(page.getByText(/contas? exclu[ií]da/)).toBeVisible();
});

test("empty state aparece quando não há contas", async ({
   page,
   e2eSession,
}) => {
   await gotoBankAccounts(page, e2eSession);

   const hasRows = await page
      .getByRole("cell")
      .first()
      .isVisible()
      .catch(() => false);
   if (hasRows) test.skip(true, "team já tem contas; pular empty state");

   await expect(page.getByText("Nenhuma conta bancária")).toBeVisible();
   await expect(
      page.getByText(
         "Adicione uma conta para começar a gerenciar suas finanças.",
      ),
   ).toBeVisible();
});
