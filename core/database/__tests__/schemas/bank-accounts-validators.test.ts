import { describe, expect, it } from "vitest";
import {
   createBankAccountSchema,
   updateBankAccountSchema,
} from "@core/database/schemas/bank-accounts";

// =============================================================================
// Helpers
// =============================================================================

function expectPass(input: unknown) {
   const result = createBankAccountSchema.safeParse(input);
   expect(result.success).toBe(true);
   return result;
}

function expectFail(input: unknown, path?: string) {
   const result = createBankAccountSchema.safeParse(input);
   expect(result.success).toBe(false);
   if (path && !result.success) {
      expect(result.error.issues.some((i) => i.path.includes(path))).toBe(true);
   }
}

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
      expectPass(validChecking);
   });

   it("accepts valid cash account without bank details", () => {
      expectPass({ name: "Caixa Físico", type: "cash" });
   });

   it.each([
      ["bankCode", { name: "Caixa", type: "cash", bankCode: "001" }],
      ["branch", { name: "Caixa", type: "cash", branch: "1234" }],
      [
         "accountNumber",
         { name: "Caixa", type: "cash", accountNumber: "12345" },
      ],
   ])("rejects cash account with %s", (field, input) => {
      expectFail(input, field);
   });

   it.each(["checking", "savings", "investment", "payment"])(
      "rejects %s account without bankCode",
      (type) => {
         expectFail({ name: "Test", type }, "bankCode");
      },
   );

   it.each(["checking", "savings", "investment", "payment"])(
      "accepts %s account with bankCode",
      (type) => {
         expectPass({ name: "Test Account", type, bankCode: "001" });
      },
   );

   it("rejects name shorter than 2 characters", () => {
      expectFail({ ...validChecking, name: "A" });
   });

   it("rejects name longer than 80 characters", () => {
      expectFail({ ...validChecking, name: "A".repeat(81) });
   });

   it("rejects invalid color format", () => {
      expectFail({ ...validChecking, color: "red" });
   });

   it("accepts valid hex color", () => {
      expectPass({ ...validChecking, color: "#FF5733" });
   });

   it("rejects non-numeric initialBalance", () => {
      expectFail({ ...validChecking, initialBalance: "abc" });
   });

   it("accepts negative initialBalance", () => {
      expectPass({ ...validChecking, initialBalance: "-500.00" });
   });

   it("applies correct defaults", () => {
      const result = createBankAccountSchema.safeParse(validChecking);
      expect(result.success).toBe(true);
      if (result.success) {
         expect(result.data.color).toBe("#6366f1");
         expect(result.data.initialBalance).toBe("0");
      }
   });

   it("accepts valid ISO date string for initialBalanceDate", () => {
      expectPass({ ...validChecking, initialBalanceDate: "2024-01-15" });
   });

   it("rejects invalid date format for initialBalanceDate", () => {
      expectFail({ ...validChecking, initialBalanceDate: "15/01/2024" });
   });
});

// =============================================================================
// updateBankAccountSchema
// =============================================================================

describe("updateBankAccountSchema", () => {
   const parse = (input: unknown) => updateBankAccountSchema.safeParse(input);

   it("accepts empty object (all fields optional)", () => {
      expect(parse({}).success).toBe(true);
   });

   it("accepts partial update with only name", () => {
      expect(parse({ name: "Novo Nome" }).success).toBe(true);
   });

   it("rejects invalid color on update", () => {
      expect(parse({ color: "invalid" }).success).toBe(false);
   });

   it("rejects name shorter than 2 chars on update", () => {
      expect(parse({ name: "A" }).success).toBe(false);
   });

   it("accepts valid color on update", () => {
      expect(parse({ color: "#AABBCC" }).success).toBe(true);
   });
});
