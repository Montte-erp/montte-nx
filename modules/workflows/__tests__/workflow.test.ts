import { call } from "@orpc/server";
import { eq } from "drizzle-orm";
import {
   afterAll,
   beforeAll,
   beforeEach,
   describe,
   expect,
   it,
   vi,
} from "vitest";

const dbosMocks = vi.hoisted(async () => {
   const mod = await import("@core/dbos/testing/mock-dbos");
   return mod.createDbosMocks();
});

vi.mock("@dbos-inc/dbos-sdk", async () => {
   const mod = await import("@core/dbos/testing/mock-dbos");
   return mod.dbosSdkMockFactory(await dbosMocks);
});

vi.mock("@dbos-inc/drizzle-datasource", async () => {
   const mod = await import("@core/dbos/testing/mock-dbos");
   return mod.drizzleDataSourceMockFactory(await dbosMocks);
});

vi.mock("@core/orpc/server", async () =>
   (await import("@core/orpc/testing/mock-server")).createMockServerModule(),
);

import { setupTestDb } from "@core/database/testing/setup-test-db";
import { seedTeam, seedUser } from "@core/database/testing/factories";
import { createTestContext } from "@core/orpc/testing/create-test-context";
import { reports } from "@core/database/schemas/reports";
import { workflowRuns } from "@core/database/schemas/workflows";
import * as workflowsRouter from "../src/router";
import { executeWorkflowWorkflow } from "../src/workflows/execute-workflow.workflow";

let testDb: Awaited<ReturnType<typeof setupTestDb>>;

beforeAll(async () => {
   testDb = await setupTestDb();
   const mocks = await dbosMocks;
   mocks.setActiveDb(testDb.db);
}, 30_000);

afterAll(async () => {
   await testDb.cleanup();
});

beforeEach(async () => {
   vi.clearAllMocks();
   const mocks = await dbosMocks;
   mocks.setActiveDb(testDb.db);
});

describe("executeWorkflowWorkflow", () => {
   it("gera relatório com source workflow e finaliza execução", async () => {
      const { teamId, organizationId } = await seedTeam(testDb.db);
      const userId = await seedUser(testDb.db);
      const ctx = createTestContext(testDb.db, {
         teamId,
         organizationId,
         userId,
      });
      const created = await call(
         workflowsRouter.createFromTemplate,
         {
            templateId: "dre-monthly",
            schedule: { cron: "0 9 1 * *", timezone: "America/Sao_Paulo" },
         },
         { context: ctx },
      );
      const scheduledFor = new Date("2026-06-01T09:00:00.000Z");
      const [run] = await testDb.db
         .insert(workflowRuns)
         .values({
            workflowId: created.id,
            status: "pending",
            scheduledFor,
            idempotencyKey: `${created.id}-${scheduledFor.toISOString()}`,
            triggeredBy: "schedule",
         })
         .returning();

      await executeWorkflowWorkflow({
         workflowId: created.id,
         runId: run.id,
         scheduledFor,
         triggeredBy: "schedule",
      });

      const [updatedRun] = await testDb.db
         .select()
         .from(workflowRuns)
         .where(eq(workflowRuns.id, run.id));
      const [report] = await testDb.db
         .select()
         .from(reports)
         .where(eq(reports.id, updatedRun.reportId ?? ""));

      expect(updatedRun.status).toBe("succeeded");
      expect(report?.source).toBe("workflow");
      if (!report) throw new Error("Relatório do workflow não encontrado.");

      await testDb.db.delete(reports).where(eq(reports.id, report.id));

      const [runAfterReportDelete] = await testDb.db
         .select()
         .from(workflowRuns)
         .where(eq(workflowRuns.id, run.id));
      expect(runAfterReportDelete.reportId).toBeNull();
   });

   it("rejeita run que não pertence ao workflow informado", async () => {
      const { teamId, organizationId } = await seedTeam(testDb.db);
      const userId = await seedUser(testDb.db);
      const ctx = createTestContext(testDb.db, {
         teamId,
         organizationId,
         userId,
      });
      const firstWorkflow = await call(
         workflowsRouter.createFromTemplate,
         {
            templateId: "dre-monthly",
            schedule: { cron: "0 9 1 * *", timezone: "America/Sao_Paulo" },
         },
         { context: ctx },
      );
      const secondWorkflow = await call(
         workflowsRouter.createFromTemplate,
         {
            templateId: "cash-flow-weekly",
            schedule: { cron: "0 9 * * 1", timezone: "America/Sao_Paulo" },
         },
         { context: ctx },
      );
      const scheduledFor = new Date("2026-06-01T09:00:00.000Z");
      const [run] = await testDb.db
         .insert(workflowRuns)
         .values({
            workflowId: secondWorkflow.id,
            status: "pending",
            scheduledFor,
            idempotencyKey: `${secondWorkflow.id}-${scheduledFor.toISOString()}`,
            triggeredBy: "schedule",
         })
         .returning();

      await expect(
         executeWorkflowWorkflow({
            workflowId: firstWorkflow.id,
            runId: run.id,
            scheduledFor,
            triggeredBy: "schedule",
         }),
      ).rejects.toThrow("Execução do workflow não encontrada");

      const [persistedRun] = await testDb.db
         .select()
         .from(workflowRuns)
         .where(eq(workflowRuns.id, run.id));
      expect(persistedRun.status).toBe("pending");
      expect(persistedRun.reportId).toBeNull();
   });
});
