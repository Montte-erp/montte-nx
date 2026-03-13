import { call } from "@orpc/server";
import {
   afterAll,
   beforeAll,
   beforeEach,
   describe,
   expect,
   it,
   vi,
} from "vitest";

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
vi.mock("@packages/events/dashboard");
vi.mock("@packages/events/emit");
vi.mock("@core/redis/connection", () => ({
   createRedis: vi.fn(),
}));

import { sql } from "drizzle-orm";
import {
   cleanupIntegrationTest,
   setupIntegrationTest,
} from "../../../helpers/setup-integration-test";
import type { ORPCContextWithAuth } from "@/integrations/orpc/server";
import * as dashboardsRouter from "@/integrations/orpc/router/dashboards";

let ctxTeamA: ORPCContextWithAuth;
let ctxTeamB: ORPCContextWithAuth;

beforeAll(async () => {
   const { createAuthenticatedContext } = await setupIntegrationTest();
   ctxTeamA = await createAuthenticatedContext({
      organizationId: "auto",
      teamId: "auto",
   });
   ctxTeamB = await createAuthenticatedContext({
      organizationId: "auto",
      teamId: "auto",
   });
});

afterAll(async () => {
   await cleanupIntegrationTest();
});

beforeEach(async () => {
   await ctxTeamA.db.execute(sql`DELETE FROM dashboards`);
});

describe("Dashboards Team Scoping", () => {
   it("creates dashboard scoped to active team", async () => {
      const created = await call(
         dashboardsRouter.create,
         { name: "Team A Dashboard", description: "Test" },
         { context: ctxTeamA },
      );

      expect(created.teamId).toBe(ctxTeamA.session!.session.activeTeamId);
      expect(created.organizationId).toBe(
         ctxTeamA.session!.session.activeOrganizationId,
      );
   });

   it("only lists dashboards from active team", async () => {
      await call(
         dashboardsRouter.create,
         { name: "Team A Dashboard" },
         { context: ctxTeamA },
      );
      await call(
         dashboardsRouter.create,
         { name: "Team B Dashboard" },
         { context: ctxTeamB },
      );

      const teamAResults = await call(dashboardsRouter.list, undefined, {
         context: ctxTeamA,
      });
      const teamBResults = await call(dashboardsRouter.list, undefined, {
         context: ctxTeamB,
      });

      expect(teamAResults).toHaveLength(1);
      expect(teamAResults[0].name).toBe("Team A Dashboard");
      expect(teamBResults).toHaveLength(1);
      expect(teamBResults[0].name).toBe("Team B Dashboard");
   });

   it("does not allow access to dashboard from different team", async () => {
      const created = await call(
         dashboardsRouter.create,
         { name: "Team A Only" },
         { context: ctxTeamA },
      );

      await expect(
         call(
            dashboardsRouter.getById,
            { id: created.id },
            { context: ctxTeamB },
         ),
      ).rejects.toThrow("Dashboard não encontrado.");
   });

   it("does not allow updating dashboard from different team", async () => {
      const created = await call(
         dashboardsRouter.create,
         { name: "Team A Only" },
         { context: ctxTeamA },
      );

      await expect(
         call(
            dashboardsRouter.update,
            { id: created.id, name: "Hacked" },
            { context: ctxTeamB },
         ),
      ).rejects.toThrow("Dashboard não encontrado.");
   });

   it("does not allow deleting dashboard from different team", async () => {
      const created = await call(
         dashboardsRouter.create,
         { name: "Team A Only" },
         { context: ctxTeamA },
      );

      await expect(
         call(
            dashboardsRouter.remove,
            { id: created.id },
            { context: ctxTeamB },
         ),
      ).rejects.toThrow("Dashboard não encontrado.");
   });
});
