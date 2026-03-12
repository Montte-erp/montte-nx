import { call } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
   TEST_TEAM_ID,
   createTestContext,
} from "../../../helpers/create-test-context";

vi.mock("@core/database/client", () => ({ db: {} }));
vi.mock("@core/database/repositories/bills-repository");
vi.mock("@core/database/repositories/bank-accounts-repository");
vi.mock("@core/database/repositories/categories-repository");
vi.mock("@core/database/repositories/contacts-repository");
vi.mock("@core/database/repositories/transactions-repository");
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
   createBill,
   createBillsBatch,
   createRecurrenceSetting,
   deleteBill,
   ensureBillOwnership,
   listBills,
   updateBill,
   validateBillReferences,
} from "@core/database/repositories/bills-repository";
import { ensureBankAccountOwnership } from "@core/database/repositories/bank-accounts-repository";
import {
   createTransaction,
   deleteTransaction,
} from "@core/database/repositories/transactions-repository";
import { AppError } from "@core/logging/errors";
import * as billsRouter from "@/integrations/orpc/router/bills";

const BILL_ID = "a0000000-0000-4000-8000-000000000020";
const BANK_ACCOUNT_ID = "a0000000-0000-4000-8000-000000000030";
const CATEGORY_ID = "a0000000-0000-4000-8000-000000000040";
const TRANSACTION_ID = "a0000000-0000-4000-8000-000000000050";

const mockBill = {
   id: BILL_ID,
   teamId: TEST_TEAM_ID,
   name: "Aluguel",
   description: null,
   type: "payable" as const,
   status: "pending" as const,
   amount: "1500.00",
   dueDate: "2026-04-01",
   paidAt: null,
   bankAccountId: BANK_ACCOUNT_ID,
   categoryId: CATEGORY_ID,
   contactId: null,
   attachmentUrl: null,
   installmentGroupId: null,
   installmentIndex: null,
   installmentTotal: null,
   recurrenceGroupId: null,
   transactionId: null,
   subscriptionId: null,
   createdAt: new Date(),
   updatedAt: new Date(),
};

const billInput = {
   name: "Aluguel",
   type: "payable" as const,
   amount: "1500.00",
   dueDate: "2026-04-01",
};

beforeEach(() => {
   vi.clearAllMocks();
   vi.mocked(validateBillReferences).mockResolvedValue(undefined);
});

describe("getAll", () => {
   it("lists bills for team", async () => {
      const response = { items: [mockBill], total: 1, page: 1, pageSize: 20 };
      vi.mocked(listBills).mockResolvedValueOnce(response);

      const result = await call(billsRouter.getAll, undefined, {
         context: createTestContext(),
      });

      expect(result).toEqual(response);
      expect(listBills).toHaveBeenCalledWith(
         expect.objectContaining({ teamId: TEST_TEAM_ID }),
      );
   });
});

describe("create", () => {
   it("creates a single bill", async () => {
      vi.mocked(createBill).mockResolvedValueOnce(mockBill);

      const result = await call(
         billsRouter.create,
         { bill: billInput },
         { context: createTestContext() },
      );

      expect(result).toEqual(mockBill);
      expect(validateBillReferences).toHaveBeenCalledWith(
         TEST_TEAM_ID,
         expect.objectContaining({ bankAccountId: undefined }),
      );
      expect(createBill).toHaveBeenCalledWith(TEST_TEAM_ID, billInput);
   });

   it("creates installment bills", async () => {
      vi.mocked(createBillsBatch).mockResolvedValueOnce([mockBill, mockBill]);

      const result = await call(
         billsRouter.create,
         {
            bill: billInput,
            installment: { mode: "equal", count: 2 },
         },
         { context: createTestContext() },
      );

      expect(result).toHaveLength(2);
      expect(createBillsBatch).toHaveBeenCalled();
   });

   it("propagates validation error for bad refs", async () => {
      vi.mocked(validateBillReferences).mockRejectedValueOnce(
         AppError.validation("Conta bancária inválida."),
      );

      await expect(
         call(
            billsRouter.create,
            { bill: { ...billInput, bankAccountId: BANK_ACCOUNT_ID } },
            { context: createTestContext() },
         ),
      ).rejects.toThrow("Conta bancária inválida.");
   });
});

describe("update", () => {
   it("updates bill after ownership check", async () => {
      vi.mocked(ensureBillOwnership).mockResolvedValueOnce(mockBill);
      const updated = { ...mockBill, name: "Aluguel Atualizado" };
      vi.mocked(updateBill).mockResolvedValueOnce(updated);

      const result = await call(
         billsRouter.update,
         { id: BILL_ID, name: "Aluguel Atualizado" },
         { context: createTestContext() },
      );

      expect(result.name).toBe("Aluguel Atualizado");
      expect(ensureBillOwnership).toHaveBeenCalledWith(BILL_ID, TEST_TEAM_ID);
   });

   it("propagates NOT_FOUND from ownership check", async () => {
      vi.mocked(ensureBillOwnership).mockRejectedValueOnce(
         AppError.notFound("Conta a pagar/receber não encontrada."),
      );

      await expect(
         call(
            billsRouter.update,
            { id: BILL_ID, name: "Novo" },
            { context: createTestContext() },
         ),
      ).rejects.toThrow("Conta a pagar/receber não encontrada.");
   });

   it("rejects editing a paid bill", async () => {
      vi.mocked(ensureBillOwnership).mockResolvedValueOnce({
         ...mockBill,
         status: "paid",
      });

      await expect(
         call(
            billsRouter.update,
            { id: BILL_ID, name: "Novo" },
            { context: createTestContext() },
         ),
      ).rejects.toThrow("Não é possível editar uma conta já paga.");
   });
});

describe("pay", () => {
   it("pays a bill and creates transaction", async () => {
      vi.mocked(ensureBillOwnership).mockResolvedValueOnce(mockBill);
      vi.mocked(ensureBankAccountOwnership).mockResolvedValueOnce({} as any);
      vi.mocked(createTransaction).mockResolvedValueOnce({
         id: TRANSACTION_ID,
      } as any);
      const paidBill = {
         ...mockBill,
         status: "paid" as const,
         transactionId: TRANSACTION_ID,
      };
      vi.mocked(updateBill).mockResolvedValueOnce(paidBill);

      const result = await call(
         billsRouter.pay,
         {
            id: BILL_ID,
            amount: "1500.00",
            date: "2026-04-01",
            bankAccountId: BANK_ACCOUNT_ID,
         },
         { context: createTestContext() },
      );

      expect(result.status).toBe("paid");
      expect(createTransaction).toHaveBeenCalled();
   });

   it("propagates NOT_FOUND from ownership check", async () => {
      vi.mocked(ensureBillOwnership).mockRejectedValueOnce(
         AppError.notFound("Conta a pagar/receber não encontrada."),
      );

      await expect(
         call(
            billsRouter.pay,
            { id: BILL_ID, amount: "1500.00", date: "2026-04-01" },
            { context: createTestContext() },
         ),
      ).rejects.toThrow("Conta a pagar/receber não encontrada.");
   });

   it("rejects paying an already paid bill", async () => {
      vi.mocked(ensureBillOwnership).mockResolvedValueOnce({
         ...mockBill,
         status: "paid",
      });

      await expect(
         call(
            billsRouter.pay,
            { id: BILL_ID, amount: "1500.00", date: "2026-04-01" },
            { context: createTestContext() },
         ),
      ).rejects.toThrow("Esta conta já foi paga.");
   });
});

describe("unpay", () => {
   it("reverts a paid bill to pending", async () => {
      vi.mocked(ensureBillOwnership).mockResolvedValueOnce({
         ...mockBill,
         status: "paid",
         transactionId: TRANSACTION_ID,
      });
      vi.mocked(deleteTransaction).mockResolvedValueOnce(undefined);
      vi.mocked(updateBill).mockResolvedValueOnce({
         ...mockBill,
         status: "pending",
      });

      const result = await call(
         billsRouter.unpay,
         { id: BILL_ID },
         { context: createTestContext() },
      );

      expect(result.status).toBe("pending");
      expect(deleteTransaction).toHaveBeenCalledWith(TRANSACTION_ID);
   });

   it("propagates NOT_FOUND from ownership check", async () => {
      vi.mocked(ensureBillOwnership).mockRejectedValueOnce(
         AppError.notFound("Conta a pagar/receber não encontrada."),
      );

      await expect(
         call(
            billsRouter.unpay,
            { id: BILL_ID },
            { context: createTestContext() },
         ),
      ).rejects.toThrow("Conta a pagar/receber não encontrada.");
   });

   it("rejects unpaying a non-paid bill", async () => {
      vi.mocked(ensureBillOwnership).mockResolvedValueOnce(mockBill);

      await expect(
         call(
            billsRouter.unpay,
            { id: BILL_ID },
            { context: createTestContext() },
         ),
      ).rejects.toThrow("Esta conta não está paga.");
   });
});

describe("cancel", () => {
   it("cancels a bill", async () => {
      vi.mocked(ensureBillOwnership).mockResolvedValueOnce(mockBill);
      vi.mocked(updateBill).mockResolvedValueOnce({
         ...mockBill,
         status: "cancelled",
      });

      const result = await call(
         billsRouter.cancel,
         { id: BILL_ID },
         { context: createTestContext() },
      );

      expect(result.status).toBe("cancelled");
   });

   it("propagates NOT_FOUND from ownership check", async () => {
      vi.mocked(ensureBillOwnership).mockRejectedValueOnce(
         AppError.notFound("Conta a pagar/receber não encontrada."),
      );

      await expect(
         call(
            billsRouter.cancel,
            { id: BILL_ID },
            { context: createTestContext() },
         ),
      ).rejects.toThrow("Conta a pagar/receber não encontrada.");
   });
});

describe("remove", () => {
   it("deletes a bill after ownership check", async () => {
      vi.mocked(ensureBillOwnership).mockResolvedValueOnce(mockBill);
      vi.mocked(deleteBill).mockResolvedValueOnce(undefined);

      const result = await call(
         billsRouter.remove,
         { id: BILL_ID },
         { context: createTestContext() },
      );

      expect(result).toEqual({ success: true });
      expect(deleteBill).toHaveBeenCalledWith(BILL_ID);
   });

   it("propagates NOT_FOUND from ownership check", async () => {
      vi.mocked(ensureBillOwnership).mockRejectedValueOnce(
         AppError.notFound("Conta a pagar/receber não encontrada."),
      );

      await expect(
         call(
            billsRouter.remove,
            { id: BILL_ID },
            { context: createTestContext() },
         ),
      ).rejects.toThrow("Conta a pagar/receber não encontrada.");
   });

   it("rejects deleting a paid bill", async () => {
      vi.mocked(ensureBillOwnership).mockResolvedValueOnce({
         ...mockBill,
         status: "paid",
      });

      await expect(
         call(
            billsRouter.remove,
            { id: BILL_ID },
            { context: createTestContext() },
         ),
      ).rejects.toThrow("Não é possível excluir uma conta já paga.");
   });
});

describe("createFromTransaction", () => {
   it("creates a bill from transaction", async () => {
      vi.mocked(createBill).mockResolvedValueOnce(mockBill);

      const result = await call(
         billsRouter.createFromTransaction,
         { transactionId: TRANSACTION_ID, bill: billInput },
         { context: createTestContext() },
      );

      expect(result).toEqual(mockBill);
      expect(validateBillReferences).toHaveBeenCalled();
      expect(createBill).toHaveBeenCalledWith(TEST_TEAM_ID, billInput);
   });

   it("propagates validation error for bad refs", async () => {
      vi.mocked(validateBillReferences).mockRejectedValueOnce(
         AppError.validation("Categoria inválida."),
      );

      await expect(
         call(
            billsRouter.createFromTransaction,
            {
               transactionId: TRANSACTION_ID,
               bill: { ...billInput, categoryId: CATEGORY_ID },
            },
            { context: createTestContext() },
         ),
      ).rejects.toThrow("Categoria inválida.");
   });
});
