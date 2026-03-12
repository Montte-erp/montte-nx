import { describe, it, expect } from "vitest";
import {
   BankAccountSchema,
   CreateBankAccountSchema,
   TransactionSchema,
   CreateTransactionSchema,
   ListTransactionsFilterSchema,
   TransactionSummarySchema,
   CategorySchema,
   CreateCategorySchema,
   BudgetGoalSchema,
   CreateBudgetGoalSchema,
} from "../../src/contract/schemas";

const uuid = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const now = "2026-01-15T00:00:00Z";

describe("BankAccountSchema", () => {
   it("parses a valid bank account", () => {
      const result = BankAccountSchema.parse({
         id: uuid,
         name: "Nubank",
         type: "checking",
         status: "active",
         color: "#6366f1",
         iconUrl: null,
         bankCode: null,
         bankName: null,
         branch: null,
         accountNumber: null,
         initialBalance: "0",
         initialBalanceDate: null,
         notes: null,
         currentBalance: "1000.50",
         projectedBalance: "1000.50",
         createdAt: now,
         updatedAt: now,
      });
      expect(result.id).toBe(uuid);
   });

   it("rejects invalid type", () => {
      expect(() =>
         BankAccountSchema.parse({
            id: uuid,
            name: "Test",
            type: "bitcoin",
            status: "active",
            color: "#fff",
            iconUrl: null,
            bankCode: null,
            bankName: null,
            branch: null,
            accountNumber: null,
            initialBalance: "0",
            initialBalanceDate: null,
            notes: null,
            currentBalance: "0",
            projectedBalance: "0",
            createdAt: now,
            updatedAt: now,
         }),
      ).toThrow();
   });
});

describe("CreateBankAccountSchema", () => {
   it("applies defaults", () => {
      const result = CreateBankAccountSchema.parse({ name: "Nubank" });
      expect(result.type).toBe("checking");
      expect(result.color).toBe("#6366f1");
      expect(result.initialBalance).toBe("0");
   });

   it("rejects empty name", () => {
      expect(() => CreateBankAccountSchema.parse({ name: "" })).toThrow();
   });
});

describe("TransactionSchema", () => {
   it("parses a valid transaction", () => {
      const result = TransactionSchema.parse({
         id: uuid,
         name: "Salary",
         type: "income",
         amount: "5000.00",
         description: null,
         date: "2026-01-15",
         bankAccountId: null,
         destinationBankAccountId: null,
         creditCardId: null,
         categoryId: null,
         contactId: null,
         paymentMethod: null,
         attachmentUrl: null,
         createdAt: now,
         updatedAt: now,
      });
      expect(result.type).toBe("income");
   });
});

describe("CreateTransactionSchema", () => {
   it("accepts minimal valid input", () => {
      const result = CreateTransactionSchema.parse({
         type: "expense",
         amount: "49.90",
         date: "2026-01-15",
      });
      expect(result.type).toBe("expense");
   });

   it("rejects invalid amount", () => {
      expect(() =>
         CreateTransactionSchema.parse({
            type: "expense",
            amount: "abc",
            date: "2026-01-15",
         }),
      ).toThrow();
   });

   it("rejects invalid date format", () => {
      expect(() =>
         CreateTransactionSchema.parse({
            type: "expense",
            amount: "10.00",
            date: "15/01/2026",
         }),
      ).toThrow();
   });
});

describe("ListTransactionsFilterSchema", () => {
   it("applies defaults", () => {
      const result = ListTransactionsFilterSchema.parse({});
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(25);
   });

   it("rejects pageSize > 100", () => {
      expect(() =>
         ListTransactionsFilterSchema.parse({ pageSize: 101 }),
      ).toThrow();
   });
});

describe("TransactionSummarySchema", () => {
   it("parses a valid summary", () => {
      const result = TransactionSummarySchema.parse({
         totalCount: 42,
         incomeTotal: "10000.00",
         expenseTotal: "7500.00",
         balance: "2500.00",
      });
      expect(result.totalCount).toBe(42);
   });
});

describe("CategorySchema", () => {
   it("parses a valid category", () => {
      const result = CategorySchema.parse({
         id: uuid,
         parentId: null,
         name: "Food",
         type: "expense",
         level: 0,
         description: null,
         isDefault: false,
         color: null,
         icon: null,
         isArchived: false,
         keywords: null,
         notes: null,
         createdAt: now,
         updatedAt: now,
      });
      expect(result.name).toBe("Food");
   });
});

describe("CreateCategorySchema", () => {
   it("accepts minimal input", () => {
      const result = CreateCategorySchema.parse({
         name: "Food",
         type: "expense",
      });
      expect(result.name).toBe("Food");
   });

   it("rejects invalid type", () => {
      expect(() =>
         CreateCategorySchema.parse({ name: "Food", type: "transfer" }),
      ).toThrow();
   });
});

describe("BudgetGoalSchema", () => {
   it("parses a valid budget goal", () => {
      const result = BudgetGoalSchema.parse({
         id: uuid,
         categoryId: uuid,
         month: 3,
         year: 2026,
         limitAmount: "1000.00",
         alertThreshold: 80,
         currentSpent: "500.00",
         percentUsed: 50,
         createdAt: now,
         updatedAt: now,
      });
      expect(result.month).toBe(3);
   });
});

describe("CreateBudgetGoalSchema", () => {
   it("accepts valid input", () => {
      const result = CreateBudgetGoalSchema.parse({
         categoryId: uuid,
         month: 6,
         year: 2026,
         limitAmount: "500.00",
      });
      expect(result.month).toBe(6);
   });

   it("rejects month > 12", () => {
      expect(() =>
         CreateBudgetGoalSchema.parse({
            categoryId: uuid,
            month: 13,
            year: 2026,
            limitAmount: "500.00",
         }),
      ).toThrow();
   });

   it("rejects alertThreshold > 100", () => {
      expect(() =>
         CreateBudgetGoalSchema.parse({
            categoryId: uuid,
            month: 1,
            year: 2026,
            limitAmount: "500.00",
            alertThreshold: 101,
         }),
      ).toThrow();
   });
});
