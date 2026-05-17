import { describe, expect, it } from "vitest";
import { Result } from "better-result";
import {
   decryptSecret,
   encryptSecret,
   fingerprintSecret,
   maskSecret,
   type VaultSecretContext,
} from "../src/secrets";

const masterKey = "local-dev-vault-master-key-32!!!";

const context: VaultSecretContext = {
   teamId: "team_123",
   provider: "abacate-pay",
   purpose: "api-key",
   secretId: "secret_123",
   keyVersion: "v1",
};

describe("vault secrets", () => {
   it("encrypts and decrypts a secret with AES-256-GCM metadata", () => {
      const encrypted = encryptSecret({
         plaintext: "abacate_live_secret_123",
         masterKey,
         context,
      });

      expect(Result.isOk(encrypted)).toBe(true);
      if (Result.isError(encrypted)) return;

      expect(encrypted.value.algorithm).toBe("AES-256-GCM");
      expect(encrypted.value.keyVersion).toBe("v1");
      expect(encrypted.value.authTag).toBeTruthy();
      expect(encrypted.value.iv).toBeTruthy();
      expect(encrypted.value.ciphertext).toBeTruthy();
      expect(encrypted.value.masked).toBe("********_123");
      expect(encrypted.value.fingerprint).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(JSON.stringify(encrypted.value)).not.toContain(
         "abacate_live_secret_123",
      );

      const decrypted = decryptSecret({
         encryptedSecret: encrypted.value,
         masterKey,
         context,
      });

      expect(Result.isOk(decrypted)).toBe(true);
      if (Result.isError(decrypted)) return;

      expect(decrypted.value).toBe("abacate_live_secret_123");
   });

   it("generates different ciphertext for equal secrets because each IV is random", () => {
      const first = encryptSecret({
         plaintext: "abacate_live_secret_123",
         masterKey,
         context,
      });
      const second = encryptSecret({
         plaintext: "abacate_live_secret_123",
         masterKey,
         context,
      });

      expect(Result.isOk(first)).toBe(true);
      expect(Result.isOk(second)).toBe(true);
      if (Result.isError(first) || Result.isError(second)) return;

      expect(first.value.iv).not.toBe(second.value.iv);
      expect(first.value.ciphertext).not.toBe(second.value.ciphertext);
      expect(first.value.fingerprint).toBe(second.value.fingerprint);
   });

   it("does not decrypt when AAD belongs to another context", () => {
      const encrypted = encryptSecret({
         plaintext: "abacate_live_secret_123",
         masterKey,
         context,
      });

      expect(Result.isOk(encrypted)).toBe(true);
      if (Result.isError(encrypted)) return;

      const decrypted = decryptSecret({
         encryptedSecret: encrypted.value,
         masterKey,
         context: {
            ...context,
            teamId: "team_other",
         },
      });

      expect(Result.isError(decrypted)).toBe(true);
      if (Result.isOk(decrypted)) return;

      expect(decrypted.error._tag).toBe("VaultCryptoError");
   });

   it("masks secrets without returning plaintext", () => {
      expect(maskSecret("abacate_live_secret_123")).toBe("********_123");
      expect(maskSecret("123")).toBe("********123");
      expect(maskSecret("")).toBe("");
   });

   it("creates deterministic keyed fingerprints", () => {
      const first = fingerprintSecret({
         plaintext: "abacate_live_secret_123",
         masterKey,
      });
      const second = fingerprintSecret({
         plaintext: "abacate_live_secret_123",
         masterKey,
      });
      const other = fingerprintSecret({
         plaintext: "abacate_live_secret_456",
         masterKey,
      });

      expect(Result.isOk(first)).toBe(true);
      expect(Result.isOk(second)).toBe(true);
      expect(Result.isOk(other)).toBe(true);
      if (
         Result.isError(first) ||
         Result.isError(second) ||
         Result.isError(other)
      ) {
         return;
      }

      expect(first.value).toBe(second.value);
      expect(first.value).not.toBe(other.value);
      expect(first.value).toMatch(/^sha256:[a-f0-9]{64}$/);
   });
});
