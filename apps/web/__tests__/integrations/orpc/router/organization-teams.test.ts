import { call } from "@orpc/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@core/database/client", async () => {
   const { setupIntegrationDb } =
      await import("../../../helpers/setup-integration-test");
   return { db: await setupIntegrationDb(), createDb: () => {} };
});
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
vi.mock("@core/files/client", () => ({
   generatePresignedPutUrl: vi.fn(),
}));

import {
   cleanupIntegrationTest,
   setupIntegrationTest,
} from "../../../helpers/setup-integration-test";
import type { ORPCContextWithAuth } from "@/integrations/orpc/server";
import { getOrganizationTeams } from "@/integrations/orpc/router/organization";

let ctx: ORPCContextWithAuth;

beforeAll(async () => {
   const { createAuthenticatedContext, auth } = await setupIntegrationTest();
   ctx = await createAuthenticatedContext({
      organizationId: "auto",
      teamId: "auto",
   });

   await auth.api.createTeam({
      body: {
         name: "Second Team",
         organizationId: ctx.session!.session.activeOrganizationId!,
         slug: `second-team-${Date.now()}`,
      },
      headers: ctx.headers,
   });
});

afterAll(async () => {
   await cleanupIntegrationTest();
});

describe("getOrganizationTeams", () => {
   it("returns all teams for the organization", async () => {
      const result = await call(getOrganizationTeams, undefined, {
         context: ctx,
      });

      expect(result.length).toBeGreaterThanOrEqual(2);
      for (const team of result) {
         expect(team.id).toBeDefined();
         expect(team.name).toBeDefined();
         expect(team.slug).toBeDefined();
      }
   });

   it("includes slug field from additional fields", async () => {
      const result = await call(getOrganizationTeams, undefined, {
         context: ctx,
      });

      const secondTeam = result.find((t: any) => t.name === "Second Team");
      expect(secondTeam).toBeDefined();
      expect(secondTeam!.slug).toContain("second-team");
   });
});
