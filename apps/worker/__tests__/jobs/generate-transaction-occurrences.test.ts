import { describe, it, expect, vi, beforeEach } from "vitest";
import dayjs from "dayjs";

const { mockDbSelect, mockDb } = vi.hoisted(() => {
   const mockDbSelect = vi.fn();
   const mockDb = { select: mockDbSelect };
   return { mockDbSelect, mockDb };
});

vi.mock("../../src/singletons", () => ({
   db: mockDb,
   redis: {},
}));

vi.mock(
   "../../../../core/database/src/repositories/recurring-transactions-repository",
   () => ({
      getActiveRecurringTransactions: vi.fn(),
      getLastGeneratedTransactionForRule: vi.fn(),
   }),
);

vi.mock(
   "../../../../core/database/src/repositories/transactions-repository",
   () => ({
      createTransaction: vi.fn(),
   }),
);

vi.mock("../../../../core/database/src/schemas/auth", () => ({
   team: { id: "team_id_col", organizationId: "org_id_col" },
}));

vi.mock("../../../../packages/events/src/finance", () => ({
   emitFinanceRecurringProcessed: vi.fn(),
}));

vi.mock("../../../../packages/events/src/emit", () => ({
   emitEvent: vi.fn(),
}));

vi.mock("../../../../core/logging/src/root", () => ({
   getLogger: vi.fn(() => ({
      child: vi.fn(() => ({
         info: vi.fn(),
         error: vi.fn(),
      })),
   })),
}));

import {
   getActiveRecurringTransactions,
   getLastGeneratedTransactionForRule,
} from "../../../../core/database/src/repositories/recurring-transactions-repository";
import { createTransaction } from "../../../../core/database/src/repositories/transactions-repository";
import { generateTransactionOccurrences } from "../../src/jobs/generate-transaction-occurrences";

const mockGetActiveRecurringTransactions = vi.mocked(
   getActiveRecurringTransactions,
);
const mockGetLastGeneratedTransactionForRule = vi.mocked(
   getLastGeneratedTransactionForRule,
);
const mockCreateTransaction = vi.mocked(createTransaction);

function makeRule(
   overrides: Partial<{
      id: string;
      teamId: string;
      name: string | null;
      description: string | null;
      type: "income" | "expense" | "transfer";
      amount: string;
      frequency: "daily" | "weekly" | "monthly";
      startDate: string;
      endsAt: string | null;
      windowMonths: number;
      bankAccountId: string | null;
      destinationBankAccountId: string | null;
      creditCardId: string | null;
      categoryId: string | null;
      contactId: string | null;
      paymentMethod: string | null;
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date;
   }> = {},
) {
   return {
      id: "rule-1",
      teamId: "team-1",
      name: "Salário",
      description: null,
      type: "income" as const,
      amount: "5000.00",
      frequency: "monthly" as const,
      startDate: dayjs().subtract(1, "month").format("YYYY-MM-DD"),
      endsAt: null,
      windowMonths: 3,
      bankAccountId: "bank-1",
      destinationBankAccountId: null,
      creditCardId: null,
      categoryId: null,
      contactId: null,
      paymentMethod: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
   };
}

function makeLastTx(date: string, ruleId = "rule-1") {
   return {
      id: "tx-last",
      teamId: "team-1",
      name: "Salário",
      description: null,
      type: "income" as const,
      amount: "5000.00",
      date,
      bankAccountId: "bank-1",
      destinationBankAccountId: null,
      creditCardId: null,
      categoryId: null,
      contactId: null,
      paymentMethod: null,
      recurringTransactionId: ruleId,
      status: "pending" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
   };
}

beforeEach(() => {
   vi.clearAllMocks();

   mockGetActiveRecurringTransactions.mockResolvedValue([]);
   mockGetLastGeneratedTransactionForRule.mockResolvedValue(null);

   mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
         where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ organizationId: "org-1" }]),
         }),
      }),
   });

   mockCreateTransaction.mockResolvedValue({
      id: "tx-new",
      teamId: "team-1",
      name: null,
      description: null,
      type: "income",
      amount: "5000.00",
      date: dayjs().format("YYYY-MM-DD"),
      bankAccountId: null,
      destinationBankAccountId: null,
      creditCardId: null,
      categoryId: null,
      contactId: null,
      paymentMethod: null,
      recurringTransactionId: "rule-1",
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
   });
});

describe("generateTransactionOccurrences", () => {
   it("does nothing when no active rules exist", async () => {
      mockGetActiveRecurringTransactions.mockResolvedValue([]);

      await generateTransactionOccurrences();

      expect(mockCreateTransaction).not.toHaveBeenCalled();
   });

   it("generates correct number of monthly occurrences within 3-month window", async () => {
      const startDate = dayjs().subtract(1, "month").format("YYYY-MM-DD");
      const rule = makeRule({ startDate, windowMonths: 3 });

      mockGetActiveRecurringTransactions.mockResolvedValue([rule]);
      mockGetLastGeneratedTransactionForRule.mockResolvedValue(null);

      await generateTransactionOccurrences();

      expect(mockCreateTransaction.mock.calls.length).toBeGreaterThanOrEqual(1);
      expect(mockCreateTransaction.mock.calls.length).toBeLessThanOrEqual(4);

      for (const call of mockCreateTransaction.mock.calls) {
         const [, teamId] = call;
         expect(teamId).toBe(rule.teamId);
      }
   });

   it("continues from last generated date when lastTx exists", async () => {
      const lastDate = dayjs().add(1, "month").format("YYYY-MM-DD");
      const rule = makeRule({
         startDate: dayjs().subtract(3, "month").format("YYYY-MM-DD"),
         windowMonths: 3,
      });

      mockGetActiveRecurringTransactions.mockResolvedValue([rule]);
      mockGetLastGeneratedTransactionForRule.mockResolvedValue(
         makeLastTx(lastDate),
      );

      await generateTransactionOccurrences();

      for (const call of mockCreateTransaction.mock.calls) {
         const [, , txData] = call;
         expect(dayjs(txData.date).isAfter(dayjs(lastDate))).toBe(true);
      }
   });

   it("skips if no occurrences within window", async () => {
      const nearWindowEnd = dayjs()
         .add(3, "month")
         .subtract(5, "day")
         .format("YYYY-MM-DD");
      const rule = makeRule({ windowMonths: 3 });

      mockGetActiveRecurringTransactions.mockResolvedValue([rule]);
      mockGetLastGeneratedTransactionForRule.mockResolvedValue(
         makeLastTx(nearWindowEnd),
      );

      await generateTransactionOccurrences();

      expect(mockCreateTransaction).not.toHaveBeenCalled();
   });

   it("respects endsAt boundary — stops before that date", async () => {
      const endsAt = dayjs()
         .add(1, "month")
         .add(15, "day")
         .format("YYYY-MM-DD");
      const startDate = dayjs().subtract(1, "month").format("YYYY-MM-DD");
      const rule = makeRule({ startDate, endsAt, windowMonths: 3 });

      mockGetActiveRecurringTransactions.mockResolvedValue([rule]);
      mockGetLastGeneratedTransactionForRule.mockResolvedValue(null);

      await generateTransactionOccurrences();

      for (const call of mockCreateTransaction.mock.calls) {
         const [, , txData] = call;
         expect(dayjs(txData.date).isAfter(dayjs(endsAt))).toBe(false);
      }
   });
});
