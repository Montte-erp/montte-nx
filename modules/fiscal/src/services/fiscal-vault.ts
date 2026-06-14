import { eq } from "drizzle-orm";
import {
   Result,
   TaggedError,
   type Result as BetterResult,
} from "better-result";
import { decryptSecret, encryptSecret } from "@core/vault/crypto";
import { defineErrorCatalog } from "evlog";
import { fiscalProviderSecrets } from "@core/database/schemas/fiscal";
import type { ORPCContextWithOrganization } from "@core/orpc/context";

const fiscalVaultErrors = defineErrorCatalog("fiscal.vault", {
   CRYPTO_FAILED: {
      status: 500,
      message: "Falha ao proteger segredo fiscal.",
      tags: ["fiscal", "vault"],
   },
   NOT_FOUND: {
      status: 404,
      message: "Credencial fiscal não configurada.",
      tags: ["fiscal", "vault"],
   },
});

declare module "evlog" {
   interface RegisteredErrorCatalogs {
      "fiscal.vault": typeof fiscalVaultErrors;
   }
}

type FiscalVaultCatalogError =
   | ReturnType<typeof fiscalVaultErrors.CRYPTO_FAILED>
   | ReturnType<typeof fiscalVaultErrors.NOT_FOUND>;

export class FiscalVaultError extends TaggedError("FiscalVaultError")<{
   error: FiscalVaultCatalogError;
   message: string;
}>() {}

type DbClient = ORPCContextWithOrganization["db"];

export type FiscalVaultKey = {
   value: string | undefined;
};

export type JacobinaSaatriSecretInput = {
   organizationId: string;
   teamId: string;
   environment: "homologation" | "production";
   issuerTaxId: string;
   municipalRegistration: string;
   username: string;
   password: string;
};

export type JacobinaSaatriSecret = {
   issuerTaxId: string;
   municipalRegistration: string;
   username: string;
   password: string;
};

const fiscalVaultKeyName = "FISCAL_VAULT_ENCRYPTION_KEY";

function mapCryptoError(message: string) {
   return new FiscalVaultError({
      error: fiscalVaultErrors.CRYPTO_FAILED(),
      message,
   });
}
export async function saveJacobinaSaatriSecret(
   db: DbClient,
   vaultKey: FiscalVaultKey,
   input: JacobinaSaatriSecretInput,
): Promise<BetterResult<{ configured: true }, FiscalVaultError>> {
   const usernameResult = await encryptSecret(
      { value: vaultKey.value, envName: fiscalVaultKeyName },
      input.username,
   );
   if (Result.isError(usernameResult)) {
      return Result.err(
         mapCryptoError("Falha ao criptografar usuário do SAATRI Jacobina."),
      );
   }

   const passwordResult = await encryptSecret(
      { value: vaultKey.value, envName: fiscalVaultKeyName },
      input.password,
   );
   if (Result.isError(passwordResult)) {
      return Result.err(
         mapCryptoError("Falha ao criptografar senha do SAATRI Jacobina."),
      );
   }

   const savedResult = await Result.tryPromise({
      try: () =>
         db.transaction(async (tx) => {
            const [existing] = await tx
               .select({ id: fiscalProviderSecrets.id })
               .from(fiscalProviderSecrets)
               .where(eq(fiscalProviderSecrets.teamId, input.teamId))
               .limit(1);

            if (existing) {
               const [updated] = await tx
                  .update(fiscalProviderSecrets)
                  .set({
                     environment: input.environment,
                     issuerTaxId: input.issuerTaxId,
                     municipalRegistration: input.municipalRegistration,
                     usernameCiphertext: usernameResult.value,
                     passwordCiphertext: passwordResult.value,
                  })
                  .where(eq(fiscalProviderSecrets.id, existing.id))
                  .returning();
               return updated;
            }

            const [created] = await tx
               .insert(fiscalProviderSecrets)
               .values({
                  organizationId: input.organizationId,
                  teamId: input.teamId,
                  providerId: "jacobina-saatri",
                  environment: input.environment,
                  issuerTaxId: input.issuerTaxId,
                  municipalRegistration: input.municipalRegistration,
                  usernameCiphertext: usernameResult.value,
                  passwordCiphertext: passwordResult.value,
               })
               .returning();
            return created;
         }),
      catch: () =>
         new FiscalVaultError({
            error: fiscalVaultErrors.CRYPTO_FAILED(),
            message: "Falha ao salvar credenciais fiscais.",
         }),
   });
   if (Result.isError(savedResult)) return Result.err(savedResult.error);

   return Result.ok({ configured: true });
}

export async function loadJacobinaSaatriSecret(
   db: DbClient,
   vaultKey: FiscalVaultKey,
   teamId: string,
): Promise<BetterResult<JacobinaSaatriSecret, FiscalVaultError>> {
   const rowResult = await Result.tryPromise({
      try: () =>
         db.query.fiscalProviderSecrets.findFirst({
            where: (row, { eq }) => eq(row.teamId, teamId),
         }),
      catch: () =>
         new FiscalVaultError({
            error: fiscalVaultErrors.CRYPTO_FAILED(),
            message: "Falha ao carregar credenciais fiscais.",
         }),
   });
   if (Result.isError(rowResult)) return Result.err(rowResult.error);
   if (!rowResult.value) {
      return Result.err(
         new FiscalVaultError({
            error: fiscalVaultErrors.NOT_FOUND(),
            message:
               "Configure email e senha do SAATRI Jacobina antes de emitir.",
         }),
      );
   }

   const row = rowResult.value;
   const usernameResult = await decryptSecret(
      { value: vaultKey.value, envName: fiscalVaultKeyName },
      row.usernameCiphertext,
   );
   if (Result.isError(usernameResult)) {
      return Result.err(
         mapCryptoError("Falha ao descriptografar usuário fiscal."),
      );
   }

   const passwordResult = await decryptSecret(
      { value: vaultKey.value, envName: fiscalVaultKeyName },
      row.passwordCiphertext,
   );
   if (Result.isError(passwordResult)) {
      return Result.err(
         mapCryptoError("Falha ao descriptografar senha fiscal."),
      );
   }

   return Result.ok({
      issuerTaxId: row.issuerTaxId,
      municipalRegistration: row.municipalRegistration,
      username: usernameResult.value,
      password: passwordResult.value,
   });
}
