import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("@core/arcjet/protect", () => ({
   protectWithRateLimit: vi.fn().mockResolvedValue({ isDenied: () => false }),
   isArcjetRateLimitDecision: vi.fn().mockReturnValue(false),
}));
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

import {
   cleanupIntegrationTest,
   setupIntegrationTest,
} from "./setup-integration-test";

afterAll(async () => {
   await cleanupIntegrationTest();
});

describe("setupIntegrationTest", () => {
   it("creates a working database with schema", async () => {
      const { db } = await setupIntegrationTest();
      const result = await db.query.bankAccounts.findMany();
      expect(result).toEqual([]);
   });

   it("creates an authenticated context without org", async () => {
      const { createAuthenticatedContext } = await setupIntegrationTest();
      const ctx = await createAuthenticatedContext();
      expect(ctx.session).toBeDefined();
      expect(ctx.db).toBeDefined();
   });

   it("creates an authenticated context with org and team", async () => {
      const { createAuthenticatedContext } = await setupIntegrationTest();
      const ctx = await createAuthenticatedContext({
         organizationId: "auto",
         teamId: "auto",
      });
      expect(ctx.session.session.activeOrganizationId).toBeDefined();
      expect(ctx.session.session.activeTeamId).toBeDefined();
   });
});
