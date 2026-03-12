import { call } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
   TEST_TEAM_ID,
   createTestContext,
} from "../../../helpers/create-test-context";

vi.mock("@core/database/client", () => ({ db: {} }));
vi.mock("@core/database/repositories/bank-accounts-repository");
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
   computeBankAccountBalance,
   createBankAccount,
   deleteBankAccount,
   ensureBankAccountOwnership,
   listBankAccountsWithBalance,
   updateBankAccount,
} from "@core/database/repositories/bank-accounts-repository";
import { AppError } from "@core/logging/errors";
import * as bankAccountsRouter from "@/integrations/orpc/router/bank-accounts";

const ACCOUNT_ID = "a0000000-0000-4000-8000-000000000010";

const mockAccount = {
   id: ACCOUNT_ID,
   teamId: TEST_TEAM_ID,
   name: "Nubank",
   type: "checking" as const,
   status: "active" as const,
   color: "#6366f1",
   iconUrl: null,
   bankCode: "260",
   bankName: "Nu Pagamentos",
   branch: null,
   accountNumber: null,
   initialBalance: "1000.00",
   initialBalanceDate: null,
   notes: null,
   createdAt: new Date(),
   updatedAt: new Date(),
};

beforeEach(() => {
   vi.clearAllMocks();
});

describe("create", () => {
   it("creates a bank account", async () => {
      vi.mocked(createBankAccount).mockResolvedValueOnce(mockAccount);

      const result = await call(
         bankAccountsRouter.create,
         {
            name: "Nubank",
            type: "checking",
            color: "#6366f1",
            bankCode: "260",
            initialBalance: "1000.00",
         },
         { context: createTestContext() },
      );

      expect(result).toEqual(mockAccount);
      expect(createBankAccount).toHaveBeenCalledWith(
         TEST_TEAM_ID,
         expect.objectContaining({ name: "Nubank" }),
      );
   });
});

describe("getAll", () => {
   it("lists accounts with balance", async () => {
      const accounts = [
         {
            ...mockAccount,
            currentBalance: "1500.00",
            projectedBalance: "1200.00",
         },
      ];
      vi.mocked(listBankAccountsWithBalance).mockResolvedValueOnce(accounts);

      const result = await call(bankAccountsRouter.getAll, undefined, {
         context: createTestContext(),
      });

      expect(result).toEqual(accounts);
      expect(listBankAccountsWithBalance).toHaveBeenCalledWith(TEST_TEAM_ID);
   });
});

describe("getById", () => {
   it("returns account with balance", async () => {
      vi.mocked(ensureBankAccountOwnership).mockResolvedValueOnce(mockAccount);
      vi.mocked(computeBankAccountBalance).mockResolvedValueOnce({
         currentBalance: "1500.00",
         projectedBalance: "1200.00",
      });

      const result = await call(
         bankAccountsRouter.getById,
         { id: ACCOUNT_ID },
         { context: createTestContext() },
      );

      expect(result.currentBalance).toBe("1500.00");
      expect(result.projectedBalance).toBe("1200.00");
      expect(ensureBankAccountOwnership).toHaveBeenCalledWith(
         ACCOUNT_ID,
         TEST_TEAM_ID,
      );
   });

   it("propagates NOT_FOUND from repository", async () => {
      vi.mocked(ensureBankAccountOwnership).mockRejectedValueOnce(
         AppError.notFound("Conta bancária não encontrada."),
      );

      await expect(
         call(
            bankAccountsRouter.getById,
            { id: ACCOUNT_ID },
            {
               context: createTestContext(),
            },
         ),
      ).rejects.toThrow("Conta bancária não encontrada.");
   });
});

describe("update", () => {
   it("updates account after ownership check", async () => {
      vi.mocked(ensureBankAccountOwnership).mockResolvedValueOnce(mockAccount);
      const updated = { ...mockAccount, name: "Nubank PJ" };
      vi.mocked(updateBankAccount).mockResolvedValueOnce(updated);

      const result = await call(
         bankAccountsRouter.update,
         { id: ACCOUNT_ID, name: "Nubank PJ" },
         { context: createTestContext() },
      );

      expect(result.name).toBe("Nubank PJ");
      expect(updateBankAccount).toHaveBeenCalledWith(ACCOUNT_ID, {
         name: "Nubank PJ",
      });
   });
});

describe("remove", () => {
   it("deletes account after ownership check", async () => {
      vi.mocked(ensureBankAccountOwnership).mockResolvedValueOnce(mockAccount);
      vi.mocked(deleteBankAccount).mockResolvedValueOnce(undefined);

      const result = await call(
         bankAccountsRouter.remove,
         { id: ACCOUNT_ID },
         { context: createTestContext() },
      );

      expect(result).toEqual({ success: true });
      expect(deleteBankAccount).toHaveBeenCalledWith(ACCOUNT_ID);
   });

   it("propagates CONFLICT when account has transactions", async () => {
      vi.mocked(ensureBankAccountOwnership).mockResolvedValueOnce(mockAccount);
      vi.mocked(deleteBankAccount).mockRejectedValueOnce(
         AppError.conflict(
            "Conta com lançamentos não pode ser excluída. Use arquivamento.",
         ),
      );

      await expect(
         call(
            bankAccountsRouter.remove,
            { id: ACCOUNT_ID },
            {
               context: createTestContext(),
            },
         ),
      ).rejects.toThrow("Conta com lançamentos não pode ser excluída.");
   });
});
