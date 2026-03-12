import { call } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
   TEST_TEAM_ID,
   createTestContext,
} from "../../../helpers/create-test-context";

vi.mock("@core/database/client", () => ({ db: {} }));
vi.mock("@core/database/repositories/transactions-repository");
vi.mock("@core/database/repositories/bank-accounts-repository");
vi.mock("@core/database/repositories/categories-repository");
vi.mock("@core/database/repositories/contacts-repository");
vi.mock("@core/database/repositories/tags-repository");
vi.mock("@core/arcjet/protect", () => ({
   protectWithRateLimit: vi.fn().mockResolvedValue({ isDenied: () => false }),
   isArcjetRateLimitDecision: vi.fn().mockReturnValue(false),
}));
vi.mock("@core/posthog/server", () => ({
   captureError: vi.fn(),
   captureServerEvent: vi.fn(),
   identifyUser: vi.fn(),
   setGroup: vi.fn(),
}));

import {
   createTransaction,
   createTransactionItems,
   deleteTransaction,
   ensureTransactionOwnership,
   getTransactionsSummary,
   getTransactionWithTags,
   listTransactions,
   replaceTransactionItems,
   updateTransaction,
   validateTransactionReferences,
} from "@core/database/repositories/transactions-repository";
import { AppError } from "@core/logging/errors";
import * as transactionsRouter from "@/integrations/orpc/router/transactions";

const TX_ID = "a0000000-0000-4000-8000-000000000020";
const BANK_ID = "a0000000-0000-4000-8000-000000000030";
const CATEGORY_ID = "a0000000-0000-4000-8000-000000000040";

const mockTransaction = {
   id: TX_ID,
   teamId: TEST_TEAM_ID,
   name: "Pagamento fornecedor",
   type: "expense" as const,
   amount: "150.00",
   description: null,
   date: "2026-01-15",
   bankAccountId: BANK_ID,
   destinationBankAccountId: null,
   creditCardId: null,
   categoryId: CATEGORY_ID,
   attachmentUrl: null,
   paymentMethod: "pix" as const,
   isInstallment: false,
   installmentCount: null,
   installmentNumber: null,
   installmentGroupId: null,
   statementPeriod: null,
   contactId: null,
   createdAt: new Date(),
   updatedAt: new Date(),
};

beforeEach(() => {
   vi.clearAllMocks();
   vi.mocked(validateTransactionReferences).mockResolvedValue(undefined);
});

describe("create", () => {
   it("creates a transaction", async () => {
      vi.mocked(createTransaction).mockResolvedValueOnce(mockTransaction);

      const result = await call(
         transactionsRouter.create,
         {
            type: "expense",
            amount: "150.00",
            date: "2026-01-15",
            bankAccountId: BANK_ID,
            categoryId: CATEGORY_ID,
            paymentMethod: "pix",
         },
         { context: createTestContext() },
      );

      expect(result).toEqual(mockTransaction);
      expect(validateTransactionReferences).toHaveBeenCalledWith(
         TEST_TEAM_ID,
         expect.objectContaining({ bankAccountId: BANK_ID }),
      );
      expect(createTransaction).toHaveBeenCalledWith(
         TEST_TEAM_ID,
         expect.objectContaining({ amount: "150.00" }),
         [],
      );
   });

   it("propagates validation error from references", async () => {
      vi.mocked(validateTransactionReferences).mockRejectedValueOnce(
         AppError.validation("Conta bancária inválida."),
      );

      await expect(
         call(
            transactionsRouter.create,
            {
               type: "expense",
               amount: "150.00",
               date: "2026-01-15",
               bankAccountId: BANK_ID,
               categoryId: CATEGORY_ID,
            },
            { context: createTestContext() },
         ),
      ).rejects.toThrow("Conta bancária inválida.");
   });
});

describe("getAll", () => {
   it("lists transactions", async () => {
      const list = { data: [mockTransaction], total: 1 };
      vi.mocked(listTransactions).mockResolvedValueOnce(list);

      const result = await call(transactionsRouter.getAll, undefined, {
         context: createTestContext(),
      });

      expect(result).toEqual(list);
      expect(listTransactions).toHaveBeenCalledWith(
         expect.objectContaining({ teamId: TEST_TEAM_ID }),
      );
   });
});

describe("getSummary", () => {
   it("returns summary", async () => {
      const summary = {
         totalCount: 5,
         incomeTotal: "1000.00",
         expenseTotal: "500.00",
         balance: "500.00",
      };
      vi.mocked(getTransactionsSummary).mockResolvedValueOnce(summary);

      const result = await call(transactionsRouter.getSummary, undefined, {
         context: createTestContext(),
      });

      expect(result).toEqual(summary);
      expect(getTransactionsSummary).toHaveBeenCalledWith(
         expect.objectContaining({ teamId: TEST_TEAM_ID }),
      );
   });
});

describe("getById", () => {
   it("returns transaction with tags", async () => {
      const withTags = { ...mockTransaction, tagIds: [] };
      vi.mocked(ensureTransactionOwnership).mockResolvedValueOnce(
         mockTransaction,
      );
      vi.mocked(getTransactionWithTags).mockResolvedValueOnce(withTags);

      const result = await call(
         transactionsRouter.getById,
         { id: TX_ID },
         { context: createTestContext() },
      );

      expect(result).toEqual(withTags);
      expect(ensureTransactionOwnership).toHaveBeenCalledWith(
         TX_ID,
         TEST_TEAM_ID,
      );
   });

   it("propagates NOT_FOUND from repository", async () => {
      vi.mocked(ensureTransactionOwnership).mockRejectedValueOnce(
         AppError.notFound("Transação não encontrada."),
      );

      await expect(
         call(
            transactionsRouter.getById,
            { id: TX_ID },
            { context: createTestContext() },
         ),
      ).rejects.toThrow("Transação não encontrada.");
   });
});

describe("update", () => {
   it("updates transaction after ownership check", async () => {
      vi.mocked(ensureTransactionOwnership).mockResolvedValueOnce(
         mockTransaction,
      );
      const updated = { ...mockTransaction, name: "Pagamento atualizado" };
      vi.mocked(updateTransaction).mockResolvedValueOnce(updated);

      const result = await call(
         transactionsRouter.update,
         { id: TX_ID, name: "Pagamento atualizado" },
         { context: createTestContext() },
      );

      expect(result.name).toBe("Pagamento atualizado");
      expect(ensureTransactionOwnership).toHaveBeenCalledWith(
         TX_ID,
         TEST_TEAM_ID,
      );
   });

   it("validates references when changing bankAccountId", async () => {
      vi.mocked(ensureTransactionOwnership).mockResolvedValueOnce(
         mockTransaction,
      );
      const newBankId = "a0000000-0000-4000-8000-000000000050";
      vi.mocked(updateTransaction).mockResolvedValueOnce({
         ...mockTransaction,
         bankAccountId: newBankId,
      });

      await call(
         transactionsRouter.update,
         { id: TX_ID, bankAccountId: newBankId },
         { context: createTestContext() },
      );

      expect(validateTransactionReferences).toHaveBeenCalledWith(
         TEST_TEAM_ID,
         expect.objectContaining({ bankAccountId: newBankId }),
      );
   });

   it("propagates NOT_FOUND from ownership check", async () => {
      vi.mocked(ensureTransactionOwnership).mockRejectedValueOnce(
         AppError.notFound("Transação não encontrada."),
      );

      await expect(
         call(
            transactionsRouter.update,
            { id: TX_ID, name: "test" },
            { context: createTestContext() },
         ),
      ).rejects.toThrow("Transação não encontrada.");
   });
});

describe("remove", () => {
   it("deletes transaction after ownership check", async () => {
      vi.mocked(ensureTransactionOwnership).mockResolvedValueOnce(
         mockTransaction,
      );
      vi.mocked(deleteTransaction).mockResolvedValueOnce(undefined);

      const result = await call(
         transactionsRouter.remove,
         { id: TX_ID },
         { context: createTestContext() },
      );

      expect(result).toEqual({ success: true });
      expect(deleteTransaction).toHaveBeenCalledWith(TX_ID);
   });

   it("propagates NOT_FOUND from ownership check", async () => {
      vi.mocked(ensureTransactionOwnership).mockRejectedValueOnce(
         AppError.notFound("Transação não encontrada."),
      );

      await expect(
         call(
            transactionsRouter.remove,
            { id: TX_ID },
            { context: createTestContext() },
         ),
      ).rejects.toThrow("Transação não encontrada.");
   });
});

describe("importBulk", () => {
   it("imports multiple transactions", async () => {
      vi.mocked(createTransaction).mockResolvedValue(mockTransaction);

      const result = await call(
         transactionsRouter.importBulk,
         {
            transactions: [
               {
                  type: "expense",
                  amount: "100.00",
                  date: "2026-01-10",
                  bankAccountId: BANK_ID,
                  categoryId: CATEGORY_ID,
               },
               {
                  type: "income",
                  amount: "200.00",
                  date: "2026-01-11",
                  bankAccountId: BANK_ID,
                  categoryId: CATEGORY_ID,
               },
            ],
         },
         { context: createTestContext() },
      );

      expect(result).toEqual({ imported: 2, skipped: 0 });
      expect(createTransaction).toHaveBeenCalledTimes(2);
      expect(validateTransactionReferences).toHaveBeenCalledTimes(2);
   });

   it("propagates validation error on invalid reference", async () => {
      vi.mocked(validateTransactionReferences).mockRejectedValueOnce(
         AppError.validation("Categoria inválida."),
      );

      await expect(
         call(
            transactionsRouter.importBulk,
            {
               transactions: [
                  {
                     type: "expense",
                     amount: "100.00",
                     date: "2026-01-10",
                     bankAccountId: BANK_ID,
                     categoryId: CATEGORY_ID,
                  },
               ],
            },
            { context: createTestContext() },
         ),
      ).rejects.toThrow("Categoria inválida.");
   });
});
