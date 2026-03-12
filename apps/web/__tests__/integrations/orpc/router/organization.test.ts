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
   generatePresignedPutUrl: vi
      .fn()
      .mockResolvedValue("https://minio.test/presigned-url"),
}));

import { organization, teamMember } from "@core/database/schemas/auth";
import { eq } from "drizzle-orm";
import {
   cleanupIntegrationTest,
   setupIntegrationTest,
} from "../../../helpers/setup-integration-test";
import type { ORPCContextWithAuth } from "@/integrations/orpc/server";
import * as orgRouter from "@/integrations/orpc/router/organization";

let ctx: ORPCContextWithAuth;
let ctx2: ORPCContextWithAuth;

beforeAll(async () => {
   const { createAuthenticatedContext } = await setupIntegrationTest();
   ctx = await createAuthenticatedContext({
      organizationId: "auto",
      teamId: "auto",
   });
   ctx2 = await createAuthenticatedContext({
      organizationId: "auto",
      teamId: "auto",
   });
});

afterAll(async () => {
   await cleanupIntegrationTest();
});

describe("getOrganizations", () => {
   it("returns the user's organization memberships", async () => {
      const result = await call(orgRouter.getOrganizations, undefined, {
         context: ctx,
      });

      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe(ctx.session.session.activeOrganizationId);
      expect(result[0]!.role).toBe("owner");
      expect(result[0]!.name).toBeDefined();
      expect(result[0]!.slug).toBeDefined();
   });

   it("does not return orgs from another user", async () => {
      const result = await call(orgRouter.getOrganizations, undefined, {
         context: ctx,
      });

      const result2 = await call(orgRouter.getOrganizations, undefined, {
         context: ctx2,
      });

      const orgIds1 = result.map((o: any) => o.id);
      const orgIds2 = result2.map((o: any) => o.id);

      for (const id of orgIds1) {
         expect(orgIds2).not.toContain(id);
      }
   });
});

describe("getActiveOrganization", () => {
   it("returns active org with project count and limit", async () => {
      const ctxWithSubs = {
         ...ctx,
         auth: {
            ...ctx.auth,
            api: {
               ...ctx.auth.api,
               listActiveSubscriptions: vi.fn().mockResolvedValue([]),
            },
         },
      };

      const result = await call(orgRouter.getActiveOrganization, undefined, {
         context: ctxWithSubs,
      });

      expect(result).not.toBeNull();
      expect(result!.id).toBe(ctx.session.session.activeOrganizationId);
      expect(result!.projectCount).toBeGreaterThanOrEqual(1);
      expect(result!.projectLimit).toBe(1);
      expect(result!.activeSubscription).toBeNull();
   });

   it("returns activeSubscription when one is active", async () => {
      const activeSub = { id: "sub_1", status: "active", plan: "boost" };
      const ctxWithSubs = {
         ...ctx,
         auth: {
            ...ctx.auth,
            api: {
               ...ctx.auth.api,
               listActiveSubscriptions: vi.fn().mockResolvedValue([activeSub]),
            },
         },
      };

      const result = await call(orgRouter.getActiveOrganization, undefined, {
         context: ctxWithSubs,
      });

      expect(result!.activeSubscription).toEqual(activeSub);
   });
});

describe("getOrganizationTeams", () => {
   it("returns teams for the active organization", async () => {
      const result = await call(orgRouter.getOrganizationTeams, undefined, {
         context: ctx,
      });

      expect(result.length).toBeGreaterThanOrEqual(1);
      const team = result.find(
         (t: any) => t.id === ctx.session.session.activeTeamId,
      );
      expect(team).toBeDefined();
      expect(team!.slug).toBeDefined();
   });
});

describe("getMembers", () => {
   it("returns organization members with user details", async () => {
      const result = await call(orgRouter.getMembers, undefined, {
         context: ctx,
      });

      expect(result).toHaveLength(1);
      expect(result[0]!.userId).toBe(ctx.session.user.id);
      expect(result[0]!.role).toBe("owner");
      expect(result[0]!.email).toBeDefined();
      expect(result[0]!.name).toBeDefined();
   });
});

describe("getMemberTeams", () => {
   it("returns teams that the specified user belongs to", async () => {
      const teamId = ctx.session.session.activeTeamId!;
      const userId = ctx.session.user.id;

      const existing = await ctx.db.query.teamMember.findFirst({
         where: { teamId, userId },
      });
      if (!existing) {
         await ctx.db.insert(teamMember).values({
            teamId,
            userId,
            createdAt: new Date(),
         });
      }

      const result = await call(
         orgRouter.getMemberTeams,
         { userId },
         { context: ctx },
      );

      expect(result.length).toBeGreaterThanOrEqual(1);
      const team = result.find((t: any) => t.id === teamId);
      expect(team).toBeDefined();
   });

   it("returns empty for user not in any team", async () => {
      const result = await call(
         orgRouter.getMemberTeams,
         { userId: "00000000-0000-4000-a000-000000000000" },
         { context: ctx },
      );

      expect(result).toEqual([]);
   });
});

describe("generateLogoUploadUrl", () => {
   it("returns presigned URL and file metadata", async () => {
      const result = await call(
         orgRouter.generateLogoUploadUrl,
         { fileExtension: "png", contentType: "image/png" },
         { context: ctx },
      );

      expect(result.presignedUrl).toBe("https://minio.test/presigned-url");
      expect(result.fileName).toContain(".png");
      expect(result.publicUrl).toContain("organization-logos");
   });
});

describe("updateLogo", () => {
   it("updates the organization logo URL", async () => {
      const logoUrl = "/api/files/organization-logos/test-logo.png";

      const result = await call(
         orgRouter.updateLogo,
         { logoUrl },
         { context: ctx },
      );

      expect(result).toEqual({ success: true });

      const orgId = ctx.session.session.activeOrganizationId!;
      const org = await ctx.db.query.organization.findFirst({
         where: { id: orgId },
      });
      expect(org!.logo).toBe(logoUrl);
   });
});
