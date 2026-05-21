import { call } from "@orpc/server";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { setupTestDb } from "@core/database/testing/setup-test-db";
import { seedTeam, seedUser } from "@core/database/testing/factories";
import { createTestContext } from "@core/orpc/testing/create-test-context";
import { createMockServerModule } from "@core/orpc/testing/mock-server";
import { reports } from "@core/database/schemas/reports";
import { workflowRuns, workflows } from "@core/database/schemas/workflows";

vi.mock("@core/orpc/server", async () =>
   (await import("@core/orpc/testing/mock-server")).createMockServerModule(),
);

import * as workflowsRouter from "../src/router";

let testDb: Awaited<ReturnType<typeof setupTestDb>>;

beforeAll(async () => {
   testDb = await setupTestDb();
}, 30_000);

afterAll(async () => {
   await testDb.cleanup();
});

describe("workflows router", () => {
   it("createFromTemplate persiste workflow com graph e nextRunAt", async () => {
      const { teamId, organizationId } = await seedTeam(testDb.db);
      const userId = await seedUser(testDb.db);
      const ctx = createTestContext(testDb.db, {
         teamId,
         organizationId,
         userId,
      });

      const result = await call(
         workflowsRouter.createFromTemplate,
         {
            templateId: "cash-flow-weekly",
            name: "Fluxo automático",
            schedule: {
               cron: "0 9 * * 1",
               timezone: "America/Sao_Paulo",
            },
         },
         { context: ctx },
      );

      expect(result.teamId).toBe(teamId);
      expect(result.name).toBe("Fluxo automático");
      expect(result.graph.nodes[0]?.data.humanLabel).toContain("segunda");
      expect(result.nextRunAt).not.toBeNull();

      const [persisted] = await testDb.db
         .select()
         .from(workflows)
         .where(eq(workflows.id, result.id));
      expect(persisted?.templateId).toBe("cash-flow-weekly");
   });

   it("update altera nome e schedule do graph", async () => {
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
            name: "DRE base",
            schedule: { cron: "0 9 1 * *", timezone: "America/Sao_Paulo" },
         },
         { context: ctx },
      );

      const updated = await call(
         workflowsRouter.update,
         {
            id: created.id,
            name: "DRE revisada",
            graph: {
               ...created.graph,
               nodes: [
                  {
                     ...created.graph.nodes[0],
                     data: {
                        ...created.graph.nodes[0].data,
                        cron: "0 10 1 * *",
                        humanLabel: "Todo dia 1 às 10:00",
                     },
                  },
                  created.graph.nodes[1],
               ],
            },
         },
         { context: ctx },
      );

      expect(updated.name).toBe("DRE revisada");
      expect(updated.graph.nodes[0].data.cron).toBe("0 10 1 * *");
   });

   it("pause e activate alternam status e nextRunAt", async () => {
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
            templateId: "aging-weekly",
            schedule: { cron: "0 9 * * 1", timezone: "America/Sao_Paulo" },
         },
         { context: ctx },
      );

      const paused = await call(
         workflowsRouter.pause,
         { id: created.id },
         { context: ctx },
      );
      expect(paused.status).toBe("paused");
      expect(paused.nextRunAt).toBeNull();

      const activated = await call(
         workflowsRouter.activate,
         { id: created.id },
         { context: ctx },
      );
      expect(activated.status).toBe("active");
      expect(activated.nextRunAt).not.toBeNull();
   });

   it("runNow cria execução manual e enfileira workflow", async () => {
      const { teamId, organizationId } = await seedTeam(testDb.db);
      const userId = await seedUser(testDb.db);
      const workflowClient = { enqueue: vi.fn().mockResolvedValue(undefined) };
      const ctx = createTestContext(testDb.db, {
         teamId,
         organizationId,
         userId,
         extras: { workflowClient },
      });
      const created = await call(
         workflowsRouter.createFromTemplate,
         {
            templateId: "categories-monthly",
            schedule: { cron: "0 9 1 * *", timezone: "America/Sao_Paulo" },
         },
         { context: ctx },
      );

      const run = await call(
         workflowsRouter.runNow,
         { id: created.id },
         { context: ctx },
      );
      expect(run.triggeredBy).toBe("manual");
      expect(workflowClient.enqueue).toHaveBeenCalledTimes(1);

      const [persisted] = await testDb.db
         .select()
         .from(workflowRuns)
         .where(eq(workflowRuns.id, run.id));
      expect(persisted?.workflowId).toBe(created.id);
      expect(persisted?.status).toBe("pending");
   });

   it("templates.list retorna os 6 templates", async () => {
      const { teamId, organizationId } = await seedTeam(testDb.db);
      const ctx = createTestContext(testDb.db, { teamId, organizationId });

      const result = await call(workflowsRouter.templates.list, undefined, {
         context: ctx,
      });
      expect(result).toHaveLength(6);
   });

   it("list retorna workflows do time", async () => {
      const { teamId, organizationId } = await seedTeam(testDb.db);
      const userId = await seedUser(testDb.db);
      const ctx = createTestContext(testDb.db, {
         teamId,
         organizationId,
         userId,
      });
      await call(
         workflowsRouter.createFromTemplate,
         {
            templateId: "dre-monthly",
            schedule: { cron: "0 9 1 * *", timezone: "America/Sao_Paulo" },
         },
         { context: ctx },
      );

      const rows = await call(workflowsRouter.list, undefined, {
         context: ctx,
      });
      expect(rows).toHaveLength(1);
      expect(rows[0]?.latestRun).toBeNull();
   });
});
