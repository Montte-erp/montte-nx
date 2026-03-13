import { call } from "@orpc/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@core/database/client", async () => {
   const { setupIntegrationDb } =
      await import("../../../helpers/setup-integration-test");
   return { db: await setupIntegrationDb(), createDb: () => {} };
});
vi.mock("@core/posthog/server", () => ({
   captureError: vi.fn(),
   captureServerEvent: vi.fn(),
   identifyUser: vi.fn(),
   setGroup: vi.fn(),
   posthog: {
      capture: vi.fn(),
      identify: vi.fn(),
      groupIdentify: vi.fn(),
      shutdown: vi.fn(),
   },
}));
vi.mock("@core/files/client", () => ({
   generatePresignedPutUrl: vi
      .fn()
      .mockResolvedValue("https://mock-url.com/presigned"),
}));
vi.mock("@core/logging/root", () => ({
   getLogger: () => ({
      child: () => ({
         info: vi.fn(),
         error: vi.fn(),
         warn: vi.fn(),
      }),
   }),
}));

import {
   cleanupIntegrationTest,
   setupIntegrationTest,
} from "../../../helpers/setup-integration-test";
import type { ORPCContextWithAuth } from "@/integrations/orpc/server";
import * as accountRouter from "@/integrations/orpc/router/account";

let ctx: ORPCContextWithAuth;

beforeAll(async () => {
   const { createAuthenticatedContext } = await setupIntegrationTest();
   ctx = await createAuthenticatedContext({
      organizationId: "auto",
      teamId: "auto",
   });
});

afterAll(async () => {
   await cleanupIntegrationTest();
});

describe("verifyPassword", () => {
   it("returns { valid: true } when password is correct", async () => {
      const result = await call(
         accountRouter.verifyPassword,
         { password: "test-password-123" },
         { context: ctx },
      );

      expect(result).toEqual({ valid: true });
   });

   it("returns { valid: false } when password is wrong", async () => {
      const result = await call(
         accountRouter.verifyPassword,
         { password: "wrong-password" },
         { context: ctx },
      );

      expect(result).toEqual({ valid: false });
   });
});

describe("hasPassword", () => {
   it("returns { hasPassword: true } for email+password user", async () => {
      const result = await call(accountRouter.hasPassword, undefined, {
         context: ctx,
      });

      expect(result).toEqual({ hasPassword: true });
   });
});

describe("getLinkedAccounts", () => {
   it("returns credential account", async () => {
      const result = await call(accountRouter.getLinkedAccounts, undefined, {
         context: ctx,
      });

      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.some((a: any) => a.providerId === "credential")).toBe(true);
      for (const account of result) {
         expect(account).toHaveProperty("providerId");
         expect(account).toHaveProperty("accountId");
         expect(account).toHaveProperty("createdAt");
      }
   });
});

describe("setPassword", () => {
   it("throws when user already has a password", async () => {
      await expect(
         call(
            accountRouter.setPassword,
            { newPassword: "another-password-123" },
            { context: ctx },
         ),
      ).rejects.toThrow();
   });
});

describe("generateAvatarUploadUrl", () => {
   it("returns presigned URL and file info", async () => {
      const result = await call(
         accountRouter.generateAvatarUploadUrl,
         { fileExtension: "png" },
         { context: ctx },
      );

      expect(result.presignedUrl).toBe("https://mock-url.com/presigned");
      expect(result.fileName).toMatch(/^avatar-.*\.png$/);
      expect(result.publicUrl).toMatch(/^\/api\/files\/user-avatars\/avatar-/);
   });
});
