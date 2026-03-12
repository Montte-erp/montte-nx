import { call } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestContext } from "../../../helpers/create-test-context";

vi.mock("@core/database/client", () => ({ db: {} }));
vi.mock("@core/arcjet/protect", () => ({
   protect: vi.fn(),
   protectWithRateLimit: vi.fn().mockResolvedValue({ isDenied: () => false }),
}));
vi.mock("@core/posthog/server", () => ({
   posthog: { capture: vi.fn(), identify: vi.fn(), shutdown: vi.fn() },
}));
vi.mock("@core/environment/server", () => ({
   env: {
      MINIO_ENDPOINT: "http://localhost:9000",
      MINIO_ACCESS_KEY: "test",
      MINIO_SECRET_KEY: "test",
   },
}));
vi.mock("@core/files/client", () => ({
   generatePresignedPutUrl: vi.fn(),
}));

const mockAuth = {
   api: {
      verifyPassword: vi.fn(),
      listUserAccounts: vi.fn(),
      setPassword: vi.fn(),
   },
};

import * as accountRouter from "@/integrations/orpc/router/account";
import { generatePresignedPutUrl } from "@core/files/client";

const mockGeneratePresignedPutUrl = generatePresignedPutUrl as ReturnType<
   typeof vi.fn
>;

function createAccountContext(overrides = {}) {
   return createTestContext({
      auth: mockAuth,
      ...overrides,
   });
}

beforeEach(() => {
   vi.clearAllMocks();
});

describe("verifyPassword", () => {
   it("returns { valid: true } when password is correct", async () => {
      mockAuth.api.verifyPassword.mockResolvedValueOnce({});

      const ctx = createAccountContext();
      const result = await call(
         accountRouter.verifyPassword,
         { password: "correct-pass" },
         { context: ctx },
      );

      expect(result).toEqual({ valid: true });
      expect(mockAuth.api.verifyPassword).toHaveBeenCalledWith({
         headers: ctx.headers,
         body: { password: "correct-pass" },
      });
   });

   it("returns { valid: false } when auth throws", async () => {
      mockAuth.api.verifyPassword.mockRejectedValueOnce(
         new Error("Invalid password"),
      );

      const ctx = createAccountContext();
      const result = await call(
         accountRouter.verifyPassword,
         { password: "wrong-pass" },
         { context: ctx },
      );

      expect(result).toEqual({ valid: false });
   });
});

describe("hasPassword", () => {
   it("returns { hasPassword: true } when credential account exists", async () => {
      mockAuth.api.listUserAccounts.mockResolvedValueOnce([
         { providerId: "credential", accountId: "acc-1" },
         { providerId: "google", accountId: "acc-2" },
      ]);

      const ctx = createAccountContext();
      const result = await call(accountRouter.hasPassword, undefined, {
         context: ctx,
      });

      expect(result).toEqual({ hasPassword: true });
      expect(mockAuth.api.listUserAccounts).toHaveBeenCalledWith({
         headers: ctx.headers,
      });
   });

   it("returns { hasPassword: false } when only OAuth accounts", async () => {
      mockAuth.api.listUserAccounts.mockResolvedValueOnce([
         { providerId: "google", accountId: "acc-1" },
         { providerId: "github", accountId: "acc-2" },
      ]);

      const ctx = createAccountContext();
      const result = await call(accountRouter.hasPassword, undefined, {
         context: ctx,
      });

      expect(result).toEqual({ hasPassword: false });
   });

   it("returns { hasPassword: false } when auth throws", async () => {
      mockAuth.api.listUserAccounts.mockRejectedValueOnce(
         new Error("Auth service unavailable"),
      );

      const ctx = createAccountContext();
      const result = await call(accountRouter.hasPassword, undefined, {
         context: ctx,
      });

      expect(result).toEqual({ hasPassword: false });
   });
});

describe("getLinkedAccounts", () => {
   it("returns mapped accounts list", async () => {
      const now = new Date("2026-01-15");
      mockAuth.api.listUserAccounts.mockResolvedValueOnce([
         {
            providerId: "google",
            accountId: "google-123",
            createdAt: now,
            extra: "ignored",
         },
         {
            providerId: "github",
            accountId: "github-456",
            createdAt: now,
            extra: "also-ignored",
         },
      ]);

      const ctx = createAccountContext();
      const result = await call(accountRouter.getLinkedAccounts, undefined, {
         context: ctx,
      });

      expect(result).toEqual([
         { providerId: "google", accountId: "google-123", createdAt: now },
         { providerId: "github", accountId: "github-456", createdAt: now },
      ]);
   });

   it("returns empty array when auth throws", async () => {
      mockAuth.api.listUserAccounts.mockRejectedValueOnce(
         new Error("Auth service unavailable"),
      );

      const ctx = createAccountContext();
      const result = await call(accountRouter.getLinkedAccounts, undefined, {
         context: ctx,
      });

      expect(result).toEqual([]);
   });
});

describe("setPassword", () => {
   it("returns { success: true } on success", async () => {
      mockAuth.api.setPassword.mockResolvedValueOnce({});

      const ctx = createAccountContext();
      const result = await call(
         accountRouter.setPassword,
         { newPassword: "new-secure-pass" },
         { context: ctx },
      );

      expect(result).toEqual({ success: true });
      expect(mockAuth.api.setPassword).toHaveBeenCalledWith({
         headers: ctx.headers,
         body: { newPassword: "new-secure-pass" },
      });
   });

   it("throws BAD_REQUEST when user already has a password", async () => {
      mockAuth.api.setPassword.mockRejectedValueOnce(
         new Error("user already has a password"),
      );

      const ctx = createAccountContext();
      await expect(
         call(
            accountRouter.setPassword,
            { newPassword: "new-secure-pass" },
            { context: ctx },
         ),
      ).rejects.toThrow("Usuário já possui uma senha definida");
   });

   it("throws INTERNAL_SERVER_ERROR on unknown error", async () => {
      mockAuth.api.setPassword.mockRejectedValueOnce(
         new Error("Something went wrong"),
      );

      const ctx = createAccountContext();
      await expect(
         call(
            accountRouter.setPassword,
            { newPassword: "new-secure-pass" },
            { context: ctx },
         ),
      ).rejects.toThrow("Erro ao definir senha");
   });
});

describe("generateAvatarUploadUrl", () => {
   it("returns presigned URL and file info", async () => {
      mockGeneratePresignedPutUrl.mockResolvedValueOnce(
         "https://minio.test/presigned-url",
      );

      const ctx = createAccountContext();
      const result = await call(
         accountRouter.generateAvatarUploadUrl,
         { fileExtension: "png" },
         { context: ctx },
      );

      expect(result.presignedUrl).toBe("https://minio.test/presigned-url");
      expect(result.fileName).toMatch(/^avatar-.*\.png$/);
      expect(result.publicUrl).toMatch(/^\/api\/files\/user-avatars\/avatar-/);
      expect(mockGeneratePresignedPutUrl).toHaveBeenCalledWith(
         expect.stringMatching(/^avatar-.*\.png$/),
         "user-avatars",
         300,
      );
   });

   it("throws INTERNAL_SERVER_ERROR when MinIO fails", async () => {
      mockGeneratePresignedPutUrl.mockRejectedValueOnce(
         new Error("MinIO unavailable"),
      );

      const ctx = createAccountContext();
      await expect(
         call(
            accountRouter.generateAvatarUploadUrl,
            { fileExtension: "jpg" },
            { context: ctx },
         ),
      ).rejects.toThrow("Erro ao gerar URL de upload");
   });
});
