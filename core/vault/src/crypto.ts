import { webcrypto } from "node:crypto";
import {
   Result,
   TaggedError,
   type Result as BetterResult,
} from "better-result";
import { defineErrorCatalog } from "evlog";

const vaultErrors = defineErrorCatalog("core.vault", {
   CONFIG_MISSING: {
      status: 500,
      message: "Chave do vault não configurada.",
      tags: ["vault"],
   },
   CONFIG_INVALID: {
      status: 500,
      message: "Chave do vault inválida.",
      tags: ["vault"],
   },
   ENCRYPT_FAILED: {
      status: 500,
      message: "Falha ao proteger segredo.",
      tags: ["vault"],
   },
   DECRYPT_FAILED: {
      status: 500,
      message: "Falha ao abrir segredo.",
      tags: ["vault"],
   },
});

declare module "evlog" {
   interface RegisteredErrorCatalogs {
      "core.vault": typeof vaultErrors;
   }
}

type VaultCatalogError =
   | ReturnType<typeof vaultErrors.CONFIG_MISSING>
   | ReturnType<typeof vaultErrors.CONFIG_INVALID>
   | ReturnType<typeof vaultErrors.ENCRYPT_FAILED>
   | ReturnType<typeof vaultErrors.DECRYPT_FAILED>;

export class VaultError extends TaggedError("VaultError")<{
   error: VaultCatalogError;
   message: string;
}>() {}

export type VaultMasterKey = {
   value: string | undefined;
   envName?: string;
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function keyName(key: VaultMasterKey) {
   return key.envName ?? "VAULT_ENCRYPTION_KEY";
}

function decodeMasterKey(key: VaultMasterKey) {
   if (!key.value) {
      return Result.err(
         new VaultError({
            error: vaultErrors.CONFIG_MISSING(),
            message: `Configure ${keyName(key)} antes de salvar segredos.`,
         }),
      );
   }

   const decoded = Buffer.from(key.value, "base64");
   if (decoded.byteLength !== 32) {
      return Result.err(
         new VaultError({
            error: vaultErrors.CONFIG_INVALID(),
            message: `${keyName(key)} deve ser base64 de 32 bytes.`,
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

export async function encryptSecret(
   masterKey: VaultMasterKey,
   plaintext: string,
): Promise<BetterResult<string, VaultError>> {
   const decodedKey = decodeMasterKey(masterKey);
   if (Result.isError(decodedKey)) return decodedKey;

   const result = await Result.tryPromise({
      try: async () => {
         const key = await importAesKey(decodedKey.value);
         const iv = webcrypto.getRandomValues(new Uint8Array(12));
         const encrypted = await webcrypto.subtle.encrypt(
            { name: "AES-GCM", iv },
            key,
            textEncoder.encode(plaintext),
         );

         return `v1:${Buffer.from(iv).toString("base64")}:${Buffer.from(encrypted).toString("base64")}`;
      },
      catch: () =>
         new VaultError({
            error: vaultErrors.ENCRYPT_FAILED(),
            message: "Falha ao criptografar segredo.",
         }),
   });

   return result;
}

export async function decryptSecret(
   masterKey: VaultMasterKey,
   ciphertext: string,
): Promise<BetterResult<string, VaultError>> {
   const decodedKey = decodeMasterKey(masterKey);
   if (Result.isError(decodedKey)) return decodedKey;

   const result = await Result.tryPromise({
      try: async () => {
         const [version, ivText, encryptedText] = ciphertext.split(":");
         if (version !== "v1" || !ivText || !encryptedText) {
            throw new Error("invalid vault ciphertext format");
         }

         const key = await importAesKey(decodedKey.value);
         const decrypted = await webcrypto.subtle.decrypt(
            { name: "AES-GCM", iv: Buffer.from(ivText, "base64") },
            key,
            Buffer.from(encryptedText, "base64"),
         );

         return textDecoder.decode(decrypted);
      },
      catch: () =>
         new VaultError({
            error: vaultErrors.DECRYPT_FAILED(),
            message: "Falha ao descriptografar segredo.",
         }),
   });

   return result;
}
