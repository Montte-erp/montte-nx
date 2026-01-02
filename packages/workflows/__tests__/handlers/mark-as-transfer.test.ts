import { describe, expect, it, mock, beforeEach } from "bun:test";
import { createTestConsequence } from "../helpers/fixtures";
import { createMockContext, type MockContextOverrides } from "../helpers/mock-context";

// Mock the repository functions
const mockUpdateTransaction = mock(() => Promise.resolve({ id: "tx-123" }));
const mockFindMatchingTransfer = mock(() => Promise.resolve(null));
const mockCreateTransaction = mock(() => Promise.resolve({ id: "new-tx-456" }));
const mockCreateTransferLog = mock(() => Promise.resolve({ id: "log-789" }));

// Mock crypto.randomUUID
const originalRandomUUID = crypto.randomUUID;
beforeEach(() => {
   // Reset mocks
   mockUpdateTransaction.mockReset();
   mockFindMatchingTransfer.mockReset();
   mockCreateTransaction.mockReset();
   mockCreateTransferLog.mockReset();

   mockUpdateTransaction.mockImplementation(() => Promise.resolve({ id: "tx-123" }));
   mockFindMatchingTransfer.mockImplementation(() => Promise.resolve(null));
   mockCreateTransaction.mockImplementation(() => Promise.resolve({ id: "new-tx-456" }));
   mockCreateTransferLog.mockImplementation(() => Promise.resolve({ id: "log-789" }));
});

// We need to dynamically import the handler after setting up mocks
// Since Bun doesn't have jest.mock, we'll test validation and skipped cases directly
// and use integration-style tests for the execute path

import { markAsTransferHandler } from "../../src/actions/handlers/mark-as-transfer";

function createTransferConsequence(toBankAccountId = "bank-dest-123") {
   return createTestConsequence({
      type: "mark_as_transfer",
      payload: { toBankAccountId },
   });
}

describe("markAsTransferHandler", () => {
   describe("execute - validation cases", () => {
      it("should skip when toBankAccountId is missing", async () => {
         const consequence = createTestConsequence({
            type: "mark_as_transfer",
            payload: {},
         });
         const context = createMockContext();

         const result = await markAsTransferHandler.execute(consequence, context);

         expect(result.success).toBe(true);
         expect(result.skipped).toBe(true);
         expect(result.skipReason).toContain("Destination bank account ID");
      });

      it("should skip when transaction ID is missing", async () => {
         const consequence = createTransferConsequence();
         const context = createMockContext({
            eventData: { amount: 100, date: new Date(), bankAccountId: "bank-123" },
         });

         const result = await markAsTransferHandler.execute(consequence, context);

         expect(result.success).toBe(true);
         expect(result.skipped).toBe(true);
         expect(result.skipReason).toContain("Transaction ID");
      });

      it("should skip when amount is missing", async () => {
         const consequence = createTransferConsequence();
         const context = createMockContext({
            eventData: { id: "tx-123", date: new Date(), bankAccountId: "bank-123" },
         });

         const result = await markAsTransferHandler.execute(consequence, context);

         expect(result.success).toBe(true);
         expect(result.skipped).toBe(true);
         expect(result.skipReason).toContain("amount");
      });

      it("should skip when date is missing", async () => {
         const consequence = createTransferConsequence();
         const context = createMockContext({
            eventData: { id: "tx-123", amount: 100, bankAccountId: "bank-123" },
         });

         const result = await markAsTransferHandler.execute(consequence, context);

         expect(result.success).toBe(true);
         expect(result.skipped).toBe(true);
         expect(result.skipReason).toContain("date");
      });

      it("should skip when bankAccountId is missing", async () => {
         const consequence = createTransferConsequence();
         const context = createMockContext({
            eventData: { id: "tx-123", amount: 100, date: new Date() },
         });

         const result = await markAsTransferHandler.execute(consequence, context);

         expect(result.success).toBe(true);
         expect(result.skipped).toBe(true);
         expect(result.skipReason).toContain("bank account ID");
      });

      it("should skip when source and destination accounts are the same", async () => {
         const consequence = createTransferConsequence("bank-123");
         const context = createMockContext({
            eventData: {
               id: "tx-123",
               amount: 100,
               date: new Date(),
               bankAccountId: "bank-123",
            },
         });

         const result = await markAsTransferHandler.execute(consequence, context);

         expect(result.success).toBe(true);
         expect(result.skipped).toBe(true);
         expect(result.skipReason).toContain("same");
      });

      it("should return dry run result", async () => {
         const consequence = createTransferConsequence();
         const context = createMockContext({
            eventData: {
               id: "tx-123",
               amount: -100,
               date: "2024-01-15T10:00:00Z",
               bankAccountId: "bank-source-123",
               description: "Transfer out",
            },
            dryRun: true,
         });

         const result = await markAsTransferHandler.execute(consequence, context);

         expect(result.success).toBe(true);
         expect((result.result as { dryRun: boolean }).dryRun).toBe(true);
         expect((result.result as { isOutgoing: boolean }).isOutgoing).toBe(true);
         expect((result.result as { counterpartAmount: number }).counterpartAmount).toBe(100);
      });

      it("should identify outgoing transfer (negative amount)", async () => {
         const consequence = createTransferConsequence();
         const context = createMockContext({
            eventData: {
               id: "tx-123",
               amount: -100,
               date: "2024-01-15T10:00:00Z",
               bankAccountId: "bank-source-123",
            },
            dryRun: true,
         });

         const result = await markAsTransferHandler.execute(consequence, context);

         expect((result.result as { isOutgoing: boolean }).isOutgoing).toBe(true);
         expect((result.result as { fromBankAccountId: string }).fromBankAccountId).toBe("bank-source-123");
         expect((result.result as { toBankAccountId: string }).toBankAccountId).toBe("bank-dest-123");
      });

      it("should identify incoming transfer (positive amount)", async () => {
         const consequence = createTransferConsequence();
         const context = createMockContext({
            eventData: {
               id: "tx-123",
               amount: 100,
               date: "2024-01-15T10:00:00Z",
               bankAccountId: "bank-source-123",
            },
            dryRun: true,
         });

         const result = await markAsTransferHandler.execute(consequence, context);

         expect((result.result as { isOutgoing: boolean }).isOutgoing).toBe(false);
         // For incoming, the roles are swapped
         expect((result.result as { fromBankAccountId: string }).fromBankAccountId).toBe("bank-dest-123");
         expect((result.result as { toBankAccountId: string }).toBankAccountId).toBe("bank-source-123");
      });
   });

   describe("validate", () => {
      it("should return valid when toBankAccountId is provided", () => {
         const result = markAsTransferHandler.validate?.({ toBankAccountId: "bank-123" });

         expect(result?.valid).toBe(true);
         expect(result?.errors).toEqual([]);
      });

      it("should return invalid when toBankAccountId is missing", () => {
         const result = markAsTransferHandler.validate?.({});

         expect(result?.valid).toBe(false);
         expect(result?.errors).toContain("Destination bank account ID is required");
      });

      it("should return invalid when toBankAccountId is empty", () => {
         const result = markAsTransferHandler.validate?.({ toBankAccountId: "" });

         expect(result?.valid).toBe(false);
      });
   });
});
