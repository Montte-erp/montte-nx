import {
   createCipheriv,
   createDecipheriv,
   createHmac,
   randomBytes,
} from "node:crypto";
import { Result, TaggedError, type Result as ResultType } from "better-result";

export const VAULT_SECRET_ALGORITHM = "AES-256-GCM";

const IV_BYTE_LENGTH = 12;
const MASTER_KEY_BYTE_LENGTH = 32;
const AUTH_TAG_BYTE_LENGTH = 16;
const MASK_VISIBLE_SUFFIX_LENGTH = 4;

export type VaultSecretAlgorithm = typeof VAULT_SECRET_ALGORITHM;

export type VaultSecretContext = {
   teamId: string;
   provider: string;
   purpose: string;
   secretId: string;
   keyVersion: string;
};

export type EncryptedSecret = {
   algorithm: VaultSecretAlgorithm;
   keyVersion: string;
   iv: string;
   ciphertext: string;
   authTag: string;
   fingerprint: string;
   masked: string;
};

export type EncryptSecretInput = {
   plaintext: string;
   masterKey: string;
   context: VaultSecretContext;
};

export type DecryptSecretInput = {
   encryptedSecret: Pick<
      EncryptedSecret,
      "algorithm" | "authTag" | "ciphertext" | "iv" | "keyVersion"
   >;
   masterKey: string;
   context: VaultSecretContext;
};

export type FingerprintSecretInput = {
   plaintext: string;
   masterKey: string;
};

export class VaultMasterKeyError extends TaggedError("VaultMasterKeyError")<{
   message: string;
}>() {}

export class VaultEncryptedPayloadError extends TaggedError(
   "VaultEncryptedPayloadError",
)<{
   message: string;
}>() {}

export class VaultCryptoError extends TaggedError("VaultCryptoError")<{
   operation: "encrypt" | "decrypt" | "fingerprint";
   message: string;
   cause: unknown;
}>() {}

export type VaultSecretError =
   | VaultMasterKeyError
   | VaultEncryptedPayloadError
   | VaultCryptoError;

const base64Pattern =
   /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const base64UrlPattern = /^[A-Za-z0-9_-]+={0,2}$/;
const hexPattern = /^[\da-fA-F]+$/;

function parseMasterKey(
   masterKey: string,
): ResultType<Buffer, VaultMasterKeyError> {
   const trimmed = masterKey.trim();
   if (!trimmed) {
      return Result.err(
         new VaultMasterKeyError({
            message: "Chave mestra do Vault não configurada.",
         }),
      );
   }

   if (hexPattern.test(trimmed) && trimmed.length === 64) {
      const key = Buffer.from(trimmed, "hex");
      if (key.length === MASTER_KEY_BYTE_LENGTH) return Result.ok(key);
   }

   if (base64Pattern.test(trimmed) || base64UrlPattern.test(trimmed)) {
      const normalized = trimmed.replaceAll("-", "+").replaceAll("_", "/");
      const key = Buffer.from(normalized, "base64");
      if (key.length === MASTER_KEY_BYTE_LENGTH) return Result.ok(key);
   }

   if (Buffer.byteLength(trimmed, "utf8") === MASTER_KEY_BYTE_LENGTH) {
      return Result.ok(Buffer.from(trimmed, "utf8"));
   }

   return Result.err(
      new VaultMasterKeyError({
         message:
            "Chave mestra do Vault deve ter 32 bytes em UTF-8, hex ou base64.",
      }),
   );
}

function createAad(context: VaultSecretContext) {
   return Buffer.from(
      JSON.stringify({
         teamId: context.teamId,
         provider: context.provider,
         purpose: context.purpose,
         secretId: context.secretId,
         keyVersion: context.keyVersion,
      }),
      "utf8",
   );
}

function decodeVaultField(
   value: string,
   name: "authTag" | "ciphertext" | "iv",
): ResultType<Buffer, VaultEncryptedPayloadError> {
   const decoded = Buffer.from(value, "base64url");
   if (name === "iv" && decoded.length !== IV_BYTE_LENGTH) {
      return Result.err(
         new VaultEncryptedPayloadError({
            message: "IV criptográfico inválido.",
         }),
      );
   }
   if (name === "authTag" && decoded.length !== AUTH_TAG_BYTE_LENGTH) {
      return Result.err(
         new VaultEncryptedPayloadError({
            message: "Auth tag criptográfica inválida.",
         }),
      );
   }
   if (name === "ciphertext" && decoded.length === 0) {
      return Result.err(
         new VaultEncryptedPayloadError({
            message: "Ciphertext criptográfico inválido.",
         }),
      );
   }
   return Result.ok(decoded);
}

export function maskSecret(secret: string) {
   if (!secret) return "";

   const suffix = secret.slice(-MASK_VISIBLE_SUFFIX_LENGTH);
   return `********${suffix}`;
}

export function fingerprintSecret(
   input: FingerprintSecretInput,
): ResultType<string, VaultMasterKeyError | VaultCryptoError> {
   const key = parseMasterKey(input.masterKey);
   if (Result.isError(key)) return Result.err(key.error);

   return Result.try({
      try: () =>
         `sha256:${createHmac("sha256", key.value)
            .update(input.plaintext, "utf8")
            .digest("hex")}`,
      catch: (cause) =>
         new VaultCryptoError({
            operation: "fingerprint",
            message: "Falha ao calcular fingerprint do segredo.",
            cause,
         }),
   });
}

export function encryptSecret(
   input: EncryptSecretInput,
): ResultType<EncryptedSecret, VaultSecretError> {
   const key = parseMasterKey(input.masterKey);
   if (Result.isError(key)) return Result.err(key.error);

   const fingerprint = fingerprintSecret({
      plaintext: input.plaintext,
      masterKey: input.masterKey,
   });
   if (Result.isError(fingerprint)) return Result.err(fingerprint.error);

   const encrypted = Result.try({
      try: () => {
         const iv = randomBytes(IV_BYTE_LENGTH);
         const cipher = createCipheriv("aes-256-gcm", key.value, iv);
         cipher.setAAD(createAad(input.context));

         const ciphertext = Buffer.concat([
            cipher.update(input.plaintext, "utf8"),
            cipher.final(),
         ]);
         const authTag = cipher.getAuthTag();

         const value: EncryptedSecret = {
            algorithm: VAULT_SECRET_ALGORITHM,
            keyVersion: input.context.keyVersion,
            iv: iv.toString("base64url"),
            ciphertext: ciphertext.toString("base64url"),
            authTag: authTag.toString("base64url"),
            fingerprint: fingerprint.value,
            masked: maskSecret(input.plaintext),
         };

         return value;
      },
      catch: (cause) =>
         new VaultCryptoError({
            operation: "encrypt",
            message: "Falha ao criptografar segredo.",
            cause,
         }),
   });
   if (Result.isError(encrypted)) return Result.err(encrypted.error);

   return Result.ok(encrypted.value);
}

export function decryptSecret(
   input: DecryptSecretInput,
): ResultType<string, VaultSecretError> {
   const key = parseMasterKey(input.masterKey);
   if (Result.isError(key)) return Result.err(key.error);

   if (input.encryptedSecret.algorithm !== VAULT_SECRET_ALGORITHM) {
      return Result.err(
         new VaultEncryptedPayloadError({
            message: "Algoritmo de criptografia não suportado.",
         }),
      );
   }

   if (input.encryptedSecret.keyVersion !== input.context.keyVersion) {
      return Result.err(
         new VaultEncryptedPayloadError({
            message: "Versão da chave não corresponde ao contexto do segredo.",
         }),
      );
   }

   const iv = decodeVaultField(input.encryptedSecret.iv, "iv");
   if (Result.isError(iv)) return Result.err(iv.error);

   const authTag = decodeVaultField(input.encryptedSecret.authTag, "authTag");
   if (Result.isError(authTag)) return Result.err(authTag.error);

   const ciphertext = decodeVaultField(
      input.encryptedSecret.ciphertext,
      "ciphertext",
   );
   if (Result.isError(ciphertext)) return Result.err(ciphertext.error);

   return Result.try({
      try: () => {
         const decipher = createDecipheriv("aes-256-gcm", key.value, iv.value);
         decipher.setAAD(createAad(input.context));
         decipher.setAuthTag(authTag.value);

         return Buffer.concat([
            decipher.update(ciphertext.value),
            decipher.final(),
         ]).toString("utf8");
      },
      catch: (cause) =>
         new VaultCryptoError({
            operation: "decrypt",
            message: "Falha ao descriptografar segredo.",
            cause,
         }),
   });
}
