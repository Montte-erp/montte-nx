import { describe, expect, it } from "vitest";
import {
   createBankAccountSchema,
   updateBankAccountSchema,
} from "../../src/schemas/bank-accounts.validators";

// =============================================================================
// createBankAccountSchema
// =============================================================================

describe("createBankAccountSchema", () => {
   const validChecking = {
      name: "Conta Corrente",
      type: "checking" as const,
      bankCode: "001",
      bankName: "Banco do Brasil",
   };

   it("accepts valid checking account", () => {
      const result = createBankAccountSchema.safeParse(validChecking);
      expect(result.success).toBe(true);
   });

   it("accepts valid cash account without bank details", () => {
      const result = createBankAccountSchema.safeParse({
         name: "Caixa Físico",
         type: "cash",
      });
      expect(result.success).toBe(true);
   });

   it("rejects cash account with bankCode", () => {
      const result = createBankAccountSchema.safeParse({
         name: "Caixa",
         type: "cash",
         bankCode: "001",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
         expect(
            result.error.issues.some((i) => i.path.includes("bankCode")),
         ).toBe(true);
      }
   });

   it("rejects cash account with branch", () => {
      const result = createBankAccountSchema.safeParse({
         name: "Caixa",
         type: "cash",
         branch: "1234",
      });
      expect(result.success).toBe(false);
   });

   it("rejects cash account with accountNumber", () => {
      const result = createBankAccountSchema.safeParse({
         name: "Caixa",
         type: "cash",
         accountNumber: "12345",
      });
      expect(result.success).toBe(false);
   });

   it("rejects checking account without bankCode", () => {
      const result = createBankAccountSchema.safeParse({
         name: "Conta Corrente",
         type: "checking",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
         expect(
            result.error.issues.some((i) => i.path.includes("bankCode")),
         ).toBe(true);
      }
   });

   it("rejects savings account without bankCode", () => {
      const result = createBankAccountSchema.safeParse({
         name: "Poupança",
         type: "savings",
      });
      expect(result.success).toBe(false);
   });

   it("rejects investment account without bankCode", () => {
      const result = createBankAccountSchema.safeParse({
         name: "Investimento",
         type: "investment",
      });
      expect(result.success).toBe(false);
   });

   it("rejects payment account without bankCode", () => {
      const result = createBankAccountSchema.safeParse({
         name: "Conta Pagamento",
         type: "payment",
      });
      expect(result.success).toBe(false);
   });

   it("rejects name shorter than 2 characters", () => {
      const result = createBankAccountSchema.safeParse({
         ...validChecking,
         name: "A",
      });
      expect(result.success).toBe(false);
   });

   it("rejects name longer than 80 characters", () => {
      const result = createBankAccountSchema.safeParse({
         ...validChecking,
         name: "A".repeat(81),
      });
      expect(result.success).toBe(false);
   });

   it("rejects invalid color format", () => {
      const result = createBankAccountSchema.safeParse({
         ...validChecking,
         color: "red",
      });
      expect(result.success).toBe(false);
   });

   it("accepts valid hex color", () => {
      const result = createBankAccountSchema.safeParse({
         ...validChecking,
         color: "#FF5733",
      });
      expect(result.success).toBe(true);
   });

   it("rejects non-numeric initialBalance", () => {
      const result = createBankAccountSchema.safeParse({
         ...validChecking,
         initialBalance: "abc",
      });
      expect(result.success).toBe(false);
   });

   it("accepts negative initialBalance", () => {
      const result = createBankAccountSchema.safeParse({
         ...validChecking,
         initialBalance: "-500.00",
      });
      expect(result.success).toBe(true);
   });

   it("defaults color to #6366f1", () => {
      const result = createBankAccountSchema.safeParse(validChecking);
      expect(result.success).toBe(true);
      if (result.success) {
         expect(result.data.color).toBe("#6366f1");
      }
   });

   it("defaults initialBalance to 0", () => {
      const result = createBankAccountSchema.safeParse(validChecking);
      expect(result.success).toBe(true);
      if (result.success) {
         expect(result.data.initialBalance).toBe("0");
      }
   });

   it("accepts all bank-type accounts with bankCode", () => {
      for (const type of ["checking", "savings", "investment", "payment"]) {
         const result = createBankAccountSchema.safeParse({
            name: "Test Account",
            type,
            bankCode: "001",
         });
         expect(result.success).toBe(true);
      }
   });
});

// =============================================================================
// updateBankAccountSchema
// =============================================================================

describe("updateBankAccountSchema", () => {
   it("accepts empty object (all fields optional)", () => {
      const result = updateBankAccountSchema.safeParse({});
      expect(result.success).toBe(true);
   });

   it("accepts partial update with only name", () => {
      const result = updateBankAccountSchema.safeParse({
         name: "Novo Nome",
      });
      expect(result.success).toBe(true);
   });

   it("rejects invalid color on update", () => {
      const result = updateBankAccountSchema.safeParse({
         color: "invalid",
      });
      expect(result.success).toBe(false);
   });

   it("rejects name shorter than 2 chars on update", () => {
      const result = updateBankAccountSchema.safeParse({
         name: "A",
      });
      expect(result.success).toBe(false);
   });

   it("accepts valid color on update", () => {
      const result = updateBankAccountSchema.safeParse({
         color: "#AABBCC",
      });
      expect(result.success).toBe(true);
   });
});
