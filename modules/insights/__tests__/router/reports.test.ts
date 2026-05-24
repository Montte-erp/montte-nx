import { call } from "@orpc/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { setupTestDb } from "@core/database/testing/setup-test-db";
import { seedTeam } from "@core/database/testing/factories";
import { transactions } from "@core/database/schemas/transactions";
import { createTestContext } from "@core/orpc/testing/create-test-context";
import { createMockServerModule } from "@core/orpc/testing/mock-server";

vi.mock("@core/orpc/server", () => createMockServerModule());

import { aging } from "../../src/router/reports";

let testDb: Awaited<ReturnType<typeof setupTestDb>>;

beforeAll(async () => {
   testDb = await setupTestDb();
}, 30_000);

afterAll(async () => {
   await testDb.cleanup();
});

describe("reports router", () => {
   it("aging inclui contas a pagar e a receber pendentes pelo vencimento no período", async () => {
      const { teamId, organizationId } = await seedTeam(testDb.db);
      const ctx = createTestContext(testDb.db, { teamId, organizationId });

      await testDb.db.insert(transactions).values([
         {
            teamId,
            type: "expense",
            name: "Conta a pagar",
            amount: "120.00",
            date: "2026-04-10",
            dueDate: "2026-05-29",
            status: "pending",
            ignored: false,
         },
         {
            teamId,
            type: "income",
            name: "Conta a receber",
            amount: "250.00",
            date: "2026-04-12",
            dueDate: "2026-05-30",
            status: "pending",
            ignored: false,
         },
         {
            teamId,
            type: "transfer",
            name: "Transferência pendente",
            amount: "90.00",
            date: "2026-04-15",
            dueDate: "2026-05-30",
            status: "pending",
            ignored: false,
         },
      ]);

      const report = await call(
         aging,
         {
            type: "all",
            dateFrom: "2026-05-01",
            dateTo: "2026-05-31",
            status: "open",
         },
         { context: ctx },
      );

      expect(report.rows.map((row) => row.name)).toEqual([
         "Conta a pagar",
         "Conta a receber",
      ]);
      expect(report.rows.map((row) => row.type)).toEqual(["expense", "income"]);
   });
});
