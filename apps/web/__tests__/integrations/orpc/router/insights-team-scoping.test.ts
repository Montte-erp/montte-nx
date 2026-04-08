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
vi.mock("@core/logging/root", () => ({
   getLogger: () => ({ child: () => ({ warn: vi.fn(), error: vi.fn() }) }),
}));
vi.mock("@packages/events/emit", () => ({
   createEmitFn: vi.fn().mockReturnValue(vi.fn()),
}));
vi.mock("@packages/events/insight", () => ({
   emitInsightCreated: vi.fn().mockResolvedValue(undefined),
   emitInsightUpdated: vi.fn().mockResolvedValue(undefined),
   emitInsightDeleted: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@packages/analytics/compute-insight", () => ({
   computeInsightData: vi.fn(),
}));

import { sql } from "drizzle-orm";
import {
   cleanupIntegrationTest,
   setupIntegrationTest,
} from "../../../helpers/setup-integration-test";
import type { ORPCContextWithAuth } from "@/integrations/orpc/server";
import * as insightsRouter from "@/integrations/orpc/router/insights";

let ctxTeamA: ORPCContextWithAuth;
let ctxTeamB: ORPCContextWithAuth;

const validConfig = {
   type: "kpi" as const,
   measure: { aggregation: "sum" as const },
   filters: {
      dateRange: { type: "relative" as const, value: "30d" as const },
   },
};

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
   await ctxTeamA.db.execute(sql`DELETE FROM platform.insights`);
});

describe("Insights Team Scoping", () => {
   it("creates insight scoped to active team", async () => {
      const created = await call(
         insightsRouter.create,
         {
            name: "Team A Insight",
            type: "kpi",
            config: validConfig,
         },
         { context: ctxTeamA },
      );

      expect(created!.teamId).toBe(ctxTeamA.session!.session.activeTeamId);
      expect(created!.organizationId).toBe(
         ctxTeamA.session!.session.activeOrganizationId,
      );
   });

   it("isolates insights between teams", async () => {
      await call(
         insightsRouter.create,
         { name: "Team A Only", type: "kpi", config: validConfig },
         { context: ctxTeamA },
      );
      await call(
         insightsRouter.create,
         { name: "Team B Only", type: "kpi", config: validConfig },
         { context: ctxTeamB },
      );

      const teamAResults = await call(insightsRouter.list, undefined, {
         context: ctxTeamA,
      });
      const teamBResults = await call(insightsRouter.list, undefined, {
         context: ctxTeamB,
      });

      expect(teamAResults).toHaveLength(1);
      expect(teamAResults[0]!.name).toBe("Team A Only");

      expect(teamBResults).toHaveLength(1);
      expect(teamBResults[0]!.name).toBe("Team B Only");
   });

   it("does not allow access to insight from different team", async () => {
      const created = await call(
         insightsRouter.create,
         { name: "Private", type: "kpi", config: validConfig },
         { context: ctxTeamA },
      );

      await expect(
         call(
            insightsRouter.getById,
            { id: created.id },
            { context: ctxTeamB },
         ),
      ).rejects.toThrow("Insight não encontrado.");
   });

   it("does not allow updating insight from different team", async () => {
      const created = await call(
         insightsRouter.create,
         { name: "Protected", type: "kpi", config: validConfig },
         { context: ctxTeamA },
      );

      await expect(
         call(
            insightsRouter.update,
            { id: created.id, name: "Hacked" },
            { context: ctxTeamB },
         ),
      ).rejects.toThrow("Insight não encontrado.");

      const fromDb = await ctxTeamA.db.query.insights.findFirst({
         where: (fields, { eq }) => eq(fields.id, created.id),
      });
      expect(fromDb!.name).toBe("Protected");
   });

   it("does not allow deleting insight from different team", async () => {
      const created = await call(
         insightsRouter.create,
         { name: "Undeletable", type: "kpi", config: validConfig },
         { context: ctxTeamA },
      );

      await expect(
         call(insightsRouter.remove, { id: created.id }, { context: ctxTeamB }),
      ).rejects.toThrow("Insight não encontrado.");

      const rows = await ctxTeamA.db.query.insights.findMany();
      expect(rows).toHaveLength(1);
   });

   it("filters by type within active team", async () => {
      await call(
         insightsRouter.create,
         { name: "KPI", type: "kpi", config: validConfig },
         { context: ctxTeamA },
      );
      await call(
         insightsRouter.create,
         {
            name: "Breakdown",
            type: "breakdown",
            config: {
               type: "breakdown" as const,
               measure: { aggregation: "sum" as const },
               filters: {
                  dateRange: {
                     type: "relative" as const,
                     value: "30d" as const,
                  },
               },
               groupBy: "category",
               limit: 10,
            },
         },
         { context: ctxTeamA },
      );

      const kpiResults = await call(
         insightsRouter.list,
         { type: "kpi" },
         { context: ctxTeamA },
      );
      expect(kpiResults).toHaveLength(1);
      expect(kpiResults[0]!.type).toBe("kpi");

      const breakdownResults = await call(
         insightsRouter.list,
         { type: "breakdown" },
         { context: ctxTeamA },
      );
      expect(breakdownResults).toHaveLength(1);
      expect(breakdownResults[0]!.type).toBe("breakdown");
   });
});
