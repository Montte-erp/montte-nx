import { webcrypto } from "node:crypto";
import { eq } from "drizzle-orm";
import {
   Result,
   TaggedError,
   type Result as BetterResult,
} from "better-result";
import { defineErrorCatalog } from "evlog";
import { fiscalProviderSecrets } from "@core/database/schemas/fiscal";
import type { ORPCContextWithOrganization } from "@core/orpc/context";

const fiscalVaultErrors = defineErrorCatalog("fiscal.vault", {
   CONFIG_MISSING: {
      status: 500,
      message: "Chave do vault fiscal não configurada.",
      tags: ["fiscal", "vault"],
   },
   CONFIG_INVALID: {
      status: 500,
      message: "Chave do vault fiscal inválida.",
      tags: ["fiscal", "vault"],
   },
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
   | ReturnType<typeof fiscalVaultErrors.CONFIG_MISSING>
   | ReturnType<typeof fiscalVaultErrors.CONFIG_INVALID>
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

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function decodeVaultKey(key: FiscalVaultKey) {
   if (!key.value) {
      return Result.err(
         new FiscalVaultError({
            error: fiscalVaultErrors.CONFIG_MISSING(),
            message:
               "Configure FISCAL_VAULT_ENCRYPTION_KEY antes de salvar credenciais fiscais.",
         }),
      );
   }

   const decoded = Buffer.from(key.value, "base64");
   if (decoded.byteLength !== 32) {
      return Result.err(
         new FiscalVaultError({
            error: fiscalVaultErrors.CONFIG_INVALID(),
            message: "FISCAL_VAULT_ENCRYPTION_KEY deve ser base64 de 32 bytes.",
         }),
      );
   }

   return Result.ok(decoded);
}

async function importAesKey(key: Buffer) {
   return webcrypto.subtle.importKey("raw", key, "AES-GCM", false, [
      "encrypt",
      "decrypt",
   ]);
}

async function encryptValue(value: string, vaultKey: CryptoKey) {
   const iv = webcrypto.getRandomValues(new Uint8Array(12));
   const encrypted = await webcrypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      vaultKey,
      textEncoder.encode(value),
   );

   return `${Buffer.from(iv).toString("base64")}.${Buffer.from(encrypted).toString("base64")}`;
}

async function decryptValue(value: string, vaultKey: CryptoKey) {
   const [ivText, encryptedText] = value.split(".");
   if (!ivText || !encryptedText) {
      throw new Error("invalid fiscal secret format");
   }

   const decrypted = await webcrypto.subtle.decrypt(
      { name: "AES-GCM", iv: Buffer.from(ivText, "base64") },
      vaultKey,
      Buffer.from(encryptedText, "base64"),
   );

   return textDecoder.decode(decrypted);
}

export async function saveJacobinaSaatriSecret(
   db: DbClient,
   vaultKey: FiscalVaultKey,
   input: JacobinaSaatriSecretInput,
): Promise<BetterResult<{ configured: true }, FiscalVaultError>> {
   const keyResult = decodeVaultKey(vaultKey);
   if (Result.isError(keyResult)) return keyResult;

   const encryptedResult = await Result.tryPromise({
      try: async () => {
         const key = await importAesKey(keyResult.value);
         const usernameCiphertext = await encryptValue(input.username, key);
         const passwordCiphertext = await encryptValue(input.password, key);
         return { usernameCiphertext, passwordCiphertext };
      },
      catch: () =>
         new FiscalVaultError({
            error: fiscalVaultErrors.CRYPTO_FAILED(),
            message: "Falha ao criptografar credenciais do SAATRI Jacobina.",
         }),
   });
   if (Result.isError(encryptedResult))
      return Result.err(encryptedResult.error);

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
                     usernameCiphertext:
                        encryptedResult.value.usernameCiphertext,
                     passwordCiphertext:
                        encryptedResult.value.passwordCiphertext,
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
                  usernameCiphertext: encryptedResult.value.usernameCiphertext,
                  passwordCiphertext: encryptedResult.value.passwordCiphertext,
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
   const keyResult = decodeVaultKey(vaultKey);
   if (Result.isError(keyResult)) return keyResult;

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
   const decryptedResult = await Result.tryPromise({
      try: async () => {
         const key = await importAesKey(keyResult.value);
         const username = await decryptValue(row.usernameCiphertext, key);
         const password = await decryptValue(row.passwordCiphertext, key);
         return { username, password };
      },
      catch: () =>
         new FiscalVaultError({
            error: fiscalVaultErrors.CRYPTO_FAILED(),
            message: "Falha ao descriptografar credenciais fiscais.",
         }),
   });
   if (Result.isError(decryptedResult))
      return Result.err(decryptedResult.error);

   return Result.ok({
      issuerTaxId: row.issuerTaxId,
      municipalRegistration: row.municipalRegistration,
      username: decryptedResult.value.username,
      password: decryptedResult.value.password,
   });
}
