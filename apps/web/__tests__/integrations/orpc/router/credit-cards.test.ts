import { call } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
   TEST_TEAM_ID,
   createTestContext,
} from "../../../helpers/create-test-context";

vi.mock("@core/database/client", () => ({ db: {} }));
vi.mock("@core/database/repositories/credit-cards-repository");
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
   createCreditCard,
   deleteCreditCard,
   ensureCreditCardOwnership,
   listCreditCards,
   updateCreditCard,
} from "@core/database/repositories/credit-cards-repository";
import { AppError } from "@core/logging/errors";
import * as creditCardsRouter from "@/integrations/orpc/router/credit-cards";

const CARD_ID = "a0000000-0000-4000-8000-000000000020";
const BANK_ACCOUNT_ID = "a0000000-0000-4000-8000-000000000030";

const mockCard = {
   id: CARD_ID,
   teamId: TEST_TEAM_ID,
   name: "Nubank Platinum",
   color: "#6366f1",
   iconUrl: null,
   creditLimit: "5000.00",
   closingDay: 10,
   dueDay: 17,
   bankAccountId: BANK_ACCOUNT_ID,
   status: "active" as const,
   brand: "mastercard" as const,
   createdAt: new Date(),
   updatedAt: new Date(),
};

beforeEach(() => {
   vi.clearAllMocks();
});

describe("create", () => {
   it("creates a credit card", async () => {
      vi.mocked(createCreditCard).mockResolvedValueOnce(mockCard);

      const result = await call(
         creditCardsRouter.create,
         {
            name: "Nubank Platinum",
            color: "#6366f1",
            creditLimit: "5000.00",
            closingDay: 10,
            dueDay: 17,
            bankAccountId: BANK_ACCOUNT_ID,
            brand: "mastercard",
         },
         { context: createTestContext() },
      );

      expect(result).toEqual(mockCard);
      expect(createCreditCard).toHaveBeenCalledWith(
         TEST_TEAM_ID,
         expect.objectContaining({ name: "Nubank Platinum" }),
      );
   });
});

describe("getAll", () => {
   it("lists credit cards", async () => {
      const cards = [mockCard];
      vi.mocked(listCreditCards).mockResolvedValueOnce(cards);

      const result = await call(creditCardsRouter.getAll, undefined, {
         context: createTestContext(),
      });

      expect(result).toEqual(cards);
      expect(listCreditCards).toHaveBeenCalledWith(TEST_TEAM_ID);
   });
});

describe("getById", () => {
   it("returns card after ownership check", async () => {
      vi.mocked(ensureCreditCardOwnership).mockResolvedValueOnce(mockCard);

      const result = await call(
         creditCardsRouter.getById,
         { id: CARD_ID },
         { context: createTestContext() },
      );

      expect(result).toEqual(mockCard);
      expect(ensureCreditCardOwnership).toHaveBeenCalledWith(
         CARD_ID,
         TEST_TEAM_ID,
      );
   });

   it("propagates NOT_FOUND from repository", async () => {
      vi.mocked(ensureCreditCardOwnership).mockRejectedValueOnce(
         AppError.notFound("Cartão de crédito não encontrado."),
      );

      await expect(
         call(
            creditCardsRouter.getById,
            { id: CARD_ID },
            {
               context: createTestContext(),
            },
         ),
      ).rejects.toThrow("Cartão de crédito não encontrado.");
   });
});

describe("update", () => {
   it("updates card after ownership check", async () => {
      vi.mocked(ensureCreditCardOwnership).mockResolvedValueOnce(mockCard);
      const updated = { ...mockCard, name: "Nubank Black" };
      vi.mocked(updateCreditCard).mockResolvedValueOnce(updated);

      const result = await call(
         creditCardsRouter.update,
         { id: CARD_ID, name: "Nubank Black" },
         { context: createTestContext() },
      );

      expect(result.name).toBe("Nubank Black");
      expect(updateCreditCard).toHaveBeenCalledWith(CARD_ID, {
         name: "Nubank Black",
      });
   });
});

describe("remove", () => {
   it("deletes card after ownership check", async () => {
      vi.mocked(ensureCreditCardOwnership).mockResolvedValueOnce(mockCard);
      vi.mocked(deleteCreditCard).mockResolvedValueOnce(undefined);

      const result = await call(
         creditCardsRouter.remove,
         { id: CARD_ID },
         { context: createTestContext() },
      );

      expect(result).toEqual({ success: true });
      expect(deleteCreditCard).toHaveBeenCalledWith(CARD_ID);
   });

   it("propagates CONFLICT when card has open statements", async () => {
      vi.mocked(ensureCreditCardOwnership).mockResolvedValueOnce(mockCard);
      vi.mocked(deleteCreditCard).mockRejectedValueOnce(
         AppError.conflict("Cartão com faturas abertas não pode ser excluído."),
      );

      await expect(
         call(
            creditCardsRouter.remove,
            { id: CARD_ID },
            {
               context: createTestContext(),
            },
         ),
      ).rejects.toThrow("Cartão com faturas abertas não pode ser excluído.");
   });
});
