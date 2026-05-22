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

import { eq } from "drizzle-orm";
import { setupTestDb } from "@core/database/testing/setup-test-db";
import { seedTeam, seedUser } from "@core/database/testing/factories";
import { workflows } from "@core/database/schemas/workflows";
import { workflowTemplates } from "../src/templates";
import { pollDueWorkflowsOnce } from "../src/scheduler";
import { createWorkflowGraphFromTemplate } from "../src/templates";

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

describe("pollDueWorkflowsOnce", () => {
   it("cria execução para workflow devido e enfileira workflow DBOS", async () => {
      const { teamId } = await seedTeam(testDb.db);
      const userId = await seedUser(testDb.db);
      const template = workflowTemplates.find(
         (current) => current.id === "dre-monthly",
      );
      if (!template) {
         throw new Error("Template esperado 'dre-monthly' não encontrado.");
      }
      const graph = createWorkflowGraphFromTemplate(template, {
         cron: template.defaultCron,
         humanLabel: "Todo dia 1 às 09:00",
      });
      const [workflow] = await testDb.db
         .insert(workflows)
         .values({
            teamId,
            templateId: template.id,
            name: template.name,
            status: "active",
            graph,
            nextRunAt: new Date("2026-05-20T09:00:00.000Z"),
            createdBy: userId,
         })
         .returning();

      await pollDueWorkflowsOnce();

      const [persisted] = await testDb.db
         .select()
         .from(workflows)
         .where(eq(workflows.id, workflow.id));
      expect(persisted?.nextRunAt).not.toBeNull();

      const mocks = await dbosMocks;
      expect(mocks.startWorkflowSpy).toHaveBeenCalled();
   });
});
