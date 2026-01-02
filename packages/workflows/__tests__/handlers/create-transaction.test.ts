import { describe, expect, it, mock } from "bun:test";
import { createTransactionHandler } from "../../src/actions/handlers/create-transaction";
import { createCreateTransactionConsequence, createTestConsequence } from "../helpers/fixtures";
import { createMockContext, type MockContextOverrides } from "../helpers/mock-context";

function createMockDbForTransaction(overrides: {
   insertResult?: Record<string, unknown>[];
   shouldThrow?: boolean;
   errorMessage?: string;
} = {}) {
   const { insertResult = [{ id: "new-tx-123" }], shouldThrow = false, errorMessage = "DB Error" } = overrides;

   if (shouldThrow) {
      return {
         insert: mock(() => ({
            values: mock(() => ({
               returning: mock(() => Promise.reject(new Error(errorMessage))),
            })),
         })),
      };
   }

   return {
      insert: mock(() => ({
         values: mock(() => ({
            returning: mock(() => Promise.resolve(insertResult)),
         })),
      })),
   };
}

function createTransactionContext(
   dbOverrides: Parameters<typeof createMockDbForTransaction>[0] = {},
   contextOverrides: Omit<MockContextOverrides, "db"> = {},
) {
   const db = createMockDbForTransaction(dbOverrides);
   return createMockContext({ db: db as unknown as MockContextOverrides["db"], ...contextOverrides });
}

describe("createTransactionHandler", () => {
   describe("execute", () => {
      it("should create expense transaction with fixed amount", async () => {
         const consequence = createCreateTransactionConsequence({
            type: "expense",
            description: "Test expense",
            bankAccountId: "bank-123",
            amountFixed: 100,
         });
         const context = createTransactionContext();

         const result = await createTransactionHandler.execute(consequence, context);

         expect(result.success).toBe(true);
         expect(result.type).toBe("create_transaction");
         expect((result.result as { createdTransaction: Record<string, unknown> }).createdTransaction).toBeDefined();
      });

      it("should create income transaction", async () => {
         const consequence = createCreateTransactionConsequence({
            type: "income",
            description: "Test income",
            bankAccountId: "bank-123",
            amountFixed: 500,
         });
         const context = createTransactionContext();

         const result = await createTransactionHandler.execute(consequence, context);

         expect(result.success).toBe(true);
      });

      it("should create transaction with amount from event field", async () => {
         const consequence = createCreateTransactionConsequence({
            type: "expense",
            description: "Amount from field",
            bankAccountId: "bank-123",
            amountField: "amount",
         });
         const context = createTransactionContext({}, {
            eventData: { id: "tx-123", amount: 250 },
         });

         const result = await createTransactionHandler.execute(consequence, context);

         expect(result.success).toBe(true);
      });

      it("should create transaction with nested amount field", async () => {
         const consequence = createCreateTransactionConsequence({
            type: "expense",
            description: "Nested amount",
            bankAccountId: "bank-123",
            amountField: "payload.amount",
         });
         const context = createTransactionContext({}, {
            eventData: { id: "tx-123", payload: { amount: 300 } },
         });

         const result = await createTransactionHandler.execute(consequence, context);

         expect(result.success).toBe(true);
      });

      it("should process template variables in description", async () => {
         const consequence = createCreateTransactionConsequence({
            type: "expense",
            description: "Based on: {{description}}",
            bankAccountId: "bank-123",
            amountFixed: 100,
         });
         const context = createTransactionContext();

         const result = await createTransactionHandler.execute(consequence, context);

         expect(result.success).toBe(true);
      });

      it("should use date from event field", async () => {
         const consequence = createCreateTransactionConsequence({
            type: "expense",
            description: "Test",
            bankAccountId: "bank-123",
            amountFixed: 100,
            dateField: "customDate",
         });
         const context = createTransactionContext({}, {
            eventData: { id: "tx-123", customDate: "2024-06-15T10:00:00Z" },
         });

         const result = await createTransactionHandler.execute(consequence, context);

         expect(result.success).toBe(true);
      });

      it("should return dry run result without database changes", async () => {
         const consequence = createCreateTransactionConsequence({
            type: "expense",
            description: "Dry run test",
            bankAccountId: "bank-123",
            amountFixed: 100,
         });
         const context = createTransactionContext({}, { dryRun: true });

         const result = await createTransactionHandler.execute(consequence, context);

         expect(result.success).toBe(true);
         expect((result.result as { dryRun: boolean }).dryRun).toBe(true);
         expect((result.result as { type: string }).type).toBe("expense");
         expect((result.result as { amount: number }).amount).toBe(100);
         expect((result.result as { bankAccountId: string }).bankAccountId).toBe("bank-123");
      });

      it("should skip when type is invalid", async () => {
         const consequence = createTestConsequence({
            type: "create_transaction",
            payload: {
               // biome-ignore lint/suspicious/noExplicitAny: Testing invalid input type
               type: "transfer" as any,
               description: "Test",
               bankAccountId: "bank-123",
               amountFixed: 100,
            },
         });
         const context = createTransactionContext();

         const result = await createTransactionHandler.execute(consequence, context);

         expect(result.success).toBe(true);
         expect(result.skipped).toBe(true);
         expect(result.skipReason).toContain("income");
      });

      it("should skip when description is missing", async () => {
         const consequence = createTestConsequence({
            type: "create_transaction",
            payload: {
               type: "expense",
               bankAccountId: "bank-123",
               amountFixed: 100,
            },
         });
         const context = createTransactionContext();

         const result = await createTransactionHandler.execute(consequence, context);

         expect(result.success).toBe(true);
         expect(result.skipped).toBe(true);
         expect(result.skipReason).toContain("Description");
      });

      it("should skip when bankAccountId is missing", async () => {
         const consequence = createTestConsequence({
            type: "create_transaction",
            payload: {
               type: "expense",
               description: "Test",
               amountFixed: 100,
            },
         });
         const context = createTransactionContext();

         const result = await createTransactionHandler.execute(consequence, context);

         expect(result.success).toBe(true);
         expect(result.skipped).toBe(true);
         expect(result.skipReason).toContain("Bank account");
      });

      it("should skip when no amount source provided", async () => {
         const consequence = createTestConsequence({
            type: "create_transaction",
            payload: {
               type: "expense",
               description: "Test",
               bankAccountId: "bank-123",
            },
         });
         const context = createTransactionContext();

         const result = await createTransactionHandler.execute(consequence, context);

         expect(result.success).toBe(true);
         expect(result.skipped).toBe(true);
         expect(result.skipReason).toContain("amount source");
      });

      it("should fail when amount field is not a number", async () => {
         const consequence = createTestConsequence({
            type: "create_transaction",
            payload: {
               type: "expense",
               description: "Test",
               bankAccountId: "bank-123",
               amountField: "description", // description is a string, not a number
            },
         });
         const context = createTransactionContext();

         const result = await createTransactionHandler.execute(consequence, context);

         expect(result.success).toBe(false);
         expect(result.error).toContain("not a number");
      });

      it("should handle database errors gracefully", async () => {
         const consequence = createCreateTransactionConsequence({
            type: "expense",
            description: "Test",
            bankAccountId: "bank-123",
            amountFixed: 100,
         });
         const context = createTransactionContext({ shouldThrow: true, errorMessage: "Connection failed" });

         const result = await createTransactionHandler.execute(consequence, context);

         expect(result.success).toBe(false);
         expect(result.error).toBe("Connection failed");
      });
   });

   describe("validate", () => {
      it("should return valid for complete config with fixed amount", () => {
         const result = createTransactionHandler.validate?.({
            type: "expense",
            description: "Test",
            bankAccountId: "bank-123",
            amountFixed: 100,
         });

         expect(result?.valid).toBe(true);
         expect(result?.errors).toEqual([]);
      });

      it("should return valid for complete config with amount field", () => {
         const result = createTransactionHandler.validate?.({
            type: "income",
            description: "Test",
            bankAccountId: "bank-123",
            amountField: "amount",
         });

         expect(result?.valid).toBe(true);
      });

      it("should return invalid when type is missing", () => {
         const result = createTransactionHandler.validate?.({
            description: "Test",
            bankAccountId: "bank-123",
            amountFixed: 100,
         });

         expect(result?.valid).toBe(false);
         expect(result?.errors).toContain("Valid transaction type (income or expense) is required");
      });

      it("should return invalid for invalid type", () => {
         const result = createTransactionHandler.validate?.({
            // biome-ignore lint/suspicious/noExplicitAny: Testing invalid input type
            type: "transfer" as any,
            description: "Test",
            bankAccountId: "bank-123",
            amountFixed: 100,
         });

         expect(result?.valid).toBe(false);
      });

      it("should return invalid when description is missing", () => {
         const result = createTransactionHandler.validate?.({
            type: "expense",
            bankAccountId: "bank-123",
            amountFixed: 100,
         });

         expect(result?.valid).toBe(false);
         expect(result?.errors).toContain("Description is required");
      });

      it("should return invalid when bankAccountId is missing", () => {
         const result = createTransactionHandler.validate?.({
            type: "expense",
            description: "Test",
            amountFixed: 100,
         });

         expect(result?.valid).toBe(false);
         expect(result?.errors).toContain("Bank account ID is required");
      });

      it("should return invalid when no amount is provided", () => {
         const result = createTransactionHandler.validate?.({
            type: "expense",
            description: "Test",
            bankAccountId: "bank-123",
         });

         expect(result?.valid).toBe(false);
         expect(result?.errors).toContain("Either fixed amount or amount field is required");
      });

      it("should return multiple errors for multiple issues", () => {
         const result = createTransactionHandler.validate?.({});

         expect(result?.valid).toBe(false);
         expect(result?.errors.length).toBeGreaterThan(1);
      });
   });
});
