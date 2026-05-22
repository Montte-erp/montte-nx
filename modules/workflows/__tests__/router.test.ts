import { call } from "@orpc/server";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { setupTestDb } from "@core/database/testing/setup-test-db";
import { seedTeam, seedUser } from "@core/database/testing/factories";
import { createTestContext } from "@core/orpc/testing/create-test-context";
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

type WorkflowSeedInput = {
   templateId: string;
   name: string;
   cron: string;
};

async function createWorkflows(
   ctx: ReturnType<typeof createTestContext>,
   entries: WorkflowSeedInput[],
) {
   return Promise.all(
      entries.map((entry) =>
         call(
            workflowsRouter.createFromTemplate,
            {
               templateId: entry.templateId,
               name: entry.name,
               schedule: {
                  cron: entry.cron,
                  timezone: "America/Sao_Paulo",
               },
            },
            { context: ctx },
         ),
      ),
   );
}

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

   it("createFromTemplate cria workflow vazio pausado com defaults seguros", async () => {
      const { teamId, organizationId } = await seedTeam(testDb.db);
      const userId = await seedUser(testDb.db);
      const ctx = createTestContext(testDb.db, {
         teamId,
         organizationId,
         userId,
      });

      const result = await call(
         workflowsRouter.createFromTemplate,
         { templateId: "blank" },
         { context: ctx },
      );

      expect(result.templateId).toBe("blank");
      expect(result.name).toBe("Automação em branco");
      expect(result.status).toBe("paused");
      expect(result.nextRunAt).toBeNull();
      expect(result.graph.nodes[0].data.cron).toBe("0 9 1 * *");
      expect(result.graph.nodes[1].data.reportType).toBe("dre");
      expect(result.graph.nodes[1].data.period.kind).toBe("previous-month");
   });

   it("bloqueia ativação de workflow vazio ainda não configurado", async () => {
      const { teamId, organizationId } = await seedTeam(testDb.db);
      const userId = await seedUser(testDb.db);
      const ctx = createTestContext(testDb.db, {
         teamId,
         organizationId,
         userId,
      });
      const created = await call(
         workflowsRouter.createFromTemplate,
         { templateId: "blank" },
         { context: ctx },
      );

      await expect(
         call(workflowsRouter.activate, { id: created.id }, { context: ctx }),
      ).rejects.toThrow("Configure esta automação antes de ativar.");
      await expect(
         call(
            workflowsRouter.bulkActivate,
            { ids: [created.id] },
            { context: ctx },
         ),
      ).rejects.toThrow("Configure esta automação antes de ativar.");
      await expect(
         call(workflowsRouter.runNow, { id: created.id }, { context: ctx }),
      ).rejects.toThrow("Configure esta automação antes de executar.");
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

   it("rejeita cron inválido ao criar workflow", async () => {
      const { teamId, organizationId } = await seedTeam(testDb.db);
      const userId = await seedUser(testDb.db);
      const ctx = createTestContext(testDb.db, {
         teamId,
         organizationId,
         userId,
      });

      await expect(
         call(
            workflowsRouter.createFromTemplate,
            {
               templateId: "dre-monthly",
               schedule: {
                  cron: "cron inválido",
                  timezone: "America/Sao_Paulo",
               },
            },
            { context: ctx },
         ),
      ).rejects.toThrow();
   });

   it("rejeita timezone inválido ao atualizar graph", async () => {
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
      const invalidGraph = JSON.parse(JSON.stringify(created.graph));
      invalidGraph.nodes[0].data.timezone = "Foo/Bar";

      await expect(
         call(
            workflowsRouter.update,
            {
               id: created.id,
               graph: invalidGraph,
            },
            { context: ctx },
         ),
      ).rejects.toThrow();
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

   it("bulkPause pausa múltiplos workflows em lote", async () => {
      const { teamId, organizationId } = await seedTeam(testDb.db);
      const userId = await seedUser(testDb.db);
      const ctx = createTestContext(testDb.db, {
         teamId,
         organizationId,
         userId,
      });
      const [first, second, third] = await createWorkflows(ctx, [
         {
            templateId: "dre-monthly",
            name: "Workflow 1",
            cron: "0 9 1 * *",
         },
         {
            templateId: "cash-flow-weekly",
            name: "Workflow 2",
            cron: "0 9 * * 1",
         },
         {
            templateId: "categories-monthly",
            name: "Workflow 3",
            cron: "0 9 1 * *",
         },
      ]);

      const result = await call(
         workflowsRouter.bulkPause,
         { ids: [first.id, second.id] },
         { context: ctx },
      );
      expect(result.updated).toBe(2);

      const pausedRowsList = await testDb.db
         .select()
         .from(workflows)
         .where(inArray(workflows.id, [first.id, second.id]));
      const pausedRows = new Map(pausedRowsList.map((row) => [row.id, row]));
      expect(pausedRows.get(first.id)?.status).toBe("paused");
      expect(pausedRows.get(second.id)?.status).toBe("paused");
      expect(pausedRows.get(first.id)?.nextRunAt).toBeNull();
      expect(pausedRows.get(second.id)?.nextRunAt).toBeNull();

      const [activeThird] = await testDb.db
         .select()
         .from(workflows)
         .where(eq(workflows.id, third.id));
      expect(activeThird?.status).toBe("active");
   });

   it("bulkActivate reativa workflows em lote", async () => {
      const { teamId, organizationId } = await seedTeam(testDb.db);
      const userId = await seedUser(testDb.db);
      const ctx = createTestContext(testDb.db, {
         teamId,
         organizationId,
         userId,
      });
      const [first, second] = await createWorkflows(ctx, [
         {
            templateId: "dre-monthly",
            name: "Workflow pausado 1",
            cron: "0 9 1 * *",
         },
         {
            templateId: "cash-flow-weekly",
            name: "Workflow pausado 2",
            cron: "0 9 * * 1",
         },
      ]);
      await call(
         workflowsRouter.bulkPause,
         { ids: [first.id, second.id] },
         { context: ctx },
      );

      const result = await call(
         workflowsRouter.bulkActivate,
         { ids: [first.id, second.id] },
         { context: ctx },
      );
      expect(result.updated).toBe(2);

      const activatedRows = await testDb.db
         .select()
         .from(workflows)
         .where(inArray(workflows.id, [first.id, second.id]));
      const activatedRowsById = new Map(
         activatedRows.map((row) => [row.id, row]),
      );
      expect(activatedRowsById.get(first.id)?.status).toBe("active");
      expect(activatedRowsById.get(second.id)?.status).toBe("active");
      expect(activatedRowsById.get(first.id)?.nextRunAt).not.toBeNull();
      expect(activatedRowsById.get(second.id)?.nextRunAt).not.toBeNull();
   });

   it("bulkRemove remove workflows em lote", async () => {
      const { teamId, organizationId } = await seedTeam(testDb.db);
      const userId = await seedUser(testDb.db);
      const ctx = createTestContext(testDb.db, {
         teamId,
         organizationId,
         userId,
      });
      const [first, second, third] = await createWorkflows(ctx, [
         {
            templateId: "dre-monthly",
            name: "Workflow remover 1",
            cron: "0 9 1 * *",
         },
         {
            templateId: "cash-flow-weekly",
            name: "Workflow remover 2",
            cron: "0 9 * * 1",
         },
         {
            templateId: "categories-monthly",
            name: "Workflow manter",
            cron: "0 9 1 * *",
         },
      ]);

      const result = await call(
         workflowsRouter.bulkRemove,
         { ids: [first.id, second.id] },
         { context: ctx },
      );
      expect(result.deleted).toBe(2);

      const removed = await testDb.db
         .select()
         .from(workflows)
         .where(inArray(workflows.id, [first.id, second.id]));
      expect(removed).toHaveLength(0);

      const [remaining] = await testDb.db
         .select()
         .from(workflows)
         .where(eq(workflows.id, third.id));
      expect(remaining?.id).toBe(third.id);
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

   it("runNow marca execução como falha quando enqueue falha", async () => {
      const { teamId, organizationId } = await seedTeam(testDb.db);
      const userId = await seedUser(testDb.db);
      const workflowClient = {
         enqueue: vi.fn().mockRejectedValue(new Error("Queue indisponível")),
      };
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

      await expect(
         call(workflowsRouter.runNow, { id: created.id }, { context: ctx }),
      ).rejects.toThrow("Falha ao enfileirar execução da automação.");

      const [persisted] = await testDb.db
         .select()
         .from(workflowRuns)
         .where(eq(workflowRuns.workflowId, created.id));
      expect(persisted?.status).toBe("failed");
      expect(persisted?.error).toBe(
         "Falha ao enfileirar execução da automação.",
      );
      expect(persisted?.endedAt).not.toBeNull();
   });

   it("templates.list retorna templates incluindo o rascunho vazio", async () => {
      const { teamId, organizationId } = await seedTeam(testDb.db);
      const ctx = createTestContext(testDb.db, { teamId, organizationId });

      const result = await call(workflowsRouter.templates.list, undefined, {
         context: ctx,
      });
      expect(result).toHaveLength(6);
      expect(result[0]?.id).toBe("blank");
      expect(result[0]?.category).toBe("blank");
      expect(
         result.every(
            (template) =>
               template.id === "blank" || template.category === "reports",
         ),
      ).toBe(true);
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
