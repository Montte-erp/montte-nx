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

import { member } from "@core/database/schemas/auth";
import {
   cleanupIntegrationTest,
   setupIntegrationTest,
} from "../../../helpers/setup-integration-test";
import type { ORPCContextWithAuth } from "@/integrations/orpc/server";
import * as teamRouter from "@/integrations/orpc/router/team";

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

function getTeamId(c: ORPCContextWithAuth) {
   return c.session!.session.activeTeamId!;
}

function getOrgId(c: ORPCContextWithAuth) {
   return c.session!.session.activeOrganizationId!;
}

function getUserId(c: ORPCContextWithAuth) {
   return c.session!.user.id;
}

describe("team router", () => {
   describe("get", () => {
      it("returns team by id", async () => {
         const result = await call(
            teamRouter.get,
            { teamId: getTeamId(ctx) },
            { context: ctx },
         );

         expect(result).toMatchObject({
            id: getTeamId(ctx),
            name: expect.any(String),
         });
         expect(result.createdAt).toBeInstanceOf(Date);
      });

      it("rejects wrong org", async () => {
         await expect(
            call(teamRouter.get, { teamId: getTeamId(ctx2) }, { context: ctx }),
         ).rejects.toThrow("Team not found");
      });
   });

   describe("updateAllowedDomains", () => {
      it("updates and returns new domains", async () => {
         const domains = ["example.com", "*.test.org"];

         const result = await call(
            teamRouter.updateAllowedDomains,
            { teamId: getTeamId(ctx), allowedDomains: domains },
            { context: ctx },
         );

         expect(result.allowedDomains).toEqual(domains);
      });
   });

   describe("addMember", () => {
      it("adds org member to team", async () => {
         const secondUserId = getUserId(ctx2);
         const orgId = getOrgId(ctx);
         const teamId = getTeamId(ctx);

         await ctx.db.insert(member).values({
            organizationId: orgId,
            userId: secondUserId,
            role: "member",
            createdAt: new Date(),
         });

         const result = await call(
            teamRouter.addMember,
            { teamId, userId: secondUserId },
            { context: ctx },
         );

         expect(result).toMatchObject({
            teamId,
            userId: secondUserId,
         });
      });

      it("rejects non-org member", async () => {
         const nonMemberUserId = getUserId(ctx2);

         await expect(
            call(
               teamRouter.addMember,
               { teamId: getTeamId(ctx), userId: nonMemberUserId },
               { context: ctx2 },
            ),
         ).rejects.toThrow();
      });
   });

   describe("removeMember", () => {
      it("removes from team", async () => {
         const secondUserId = getUserId(ctx2);
         const teamId = getTeamId(ctx);

         const result = await call(
            teamRouter.removeMember,
            { teamId, userId: secondUserId },
            { context: ctx },
         );

         expect(result).toEqual({ success: true });
      });
   });

   describe("getMembers", () => {
      it("returns array of team members with correct shape", async () => {
         const teamId = getTeamId(ctx);
         const secondUserId = getUserId(ctx2);

         await call(
            teamRouter.addMember,
            { teamId, userId: secondUserId },
            { context: ctx },
         );

         const result = await call(
            teamRouter.getMembers,
            { teamId },
            { context: ctx },
         );

         expect(Array.isArray(result)).toBe(true);

         for (const m of result) {
            expect(m).toMatchObject({
               id: expect.any(String),
               email: expect.any(String),
               role: expect.any(String),
            });
         }
      });

      it("rejects wrong org team", async () => {
         await expect(
            call(
               teamRouter.getMembers,
               { teamId: getTeamId(ctx2) },
               { context: ctx },
            ),
         ).rejects.toThrow("Team not found");
      });
   });
});
