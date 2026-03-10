import { describe, expect, it } from "vitest";
import {
   createCreditCardSchema,
   updateCreditCardSchema,
} from "@core/database/schemas/credit-cards";

// =============================================================================
// Helpers
// =============================================================================

function expectPass(input: unknown) {
   const result = createCreditCardSchema.safeParse(input);
   expect(result.success).toBe(true);
   return result;
}

function expectFail(input: unknown, path?: string) {
   const result = createCreditCardSchema.safeParse(input);
   expect(result.success).toBe(false);
   if (path && !result.success) {
      expect(result.error.issues.some((i) => i.path.includes(path))).toBe(true);
   }
}

// =============================================================================
// createCreditCardSchema
// =============================================================================

describe("createCreditCardSchema", () => {
   const validCard = {
      name: "Nubank Visa",
      creditLimit: "5000.00",
      closingDay: 15,
      dueDay: 25,
      bankAccountId: "550e8400-e29b-41d4-a716-446655440000",
   };

   it("accepts valid credit card", () => {
      expectPass(validCard);
   });

   it("accepts card with brand", () => {
      expectPass({ ...validCard, brand: "visa" });
   });

   it("accepts card without brand (nullable)", () => {
      expectPass({ ...validCard, brand: null });
   });

   it("rejects name shorter than 2 characters", () => {
      expectFail({ ...validCard, name: "A" }, "name");
   });

   it("rejects name longer than 80 characters", () => {
      expectFail({ ...validCard, name: "A".repeat(81) }, "name");
   });

   it("rejects negative credit limit", () => {
      expectFail({ ...validCard, creditLimit: "-100" }, "creditLimit");
   });

   it("rejects non-numeric credit limit", () => {
      expectFail({ ...validCard, creditLimit: "abc" }, "creditLimit");
   });

   it("accepts zero credit limit", () => {
      expectPass({ ...validCard, creditLimit: "0" });
   });

   it.each([0, 32, -1, 100])("rejects closingDay = %i", (day) => {
      expectFail({ ...validCard, closingDay: day }, "closingDay");
   });

   it.each([1, 15, 28, 31])("accepts closingDay = %i", (day) => {
      expectPass({ ...validCard, closingDay: day });
   });

   it.each([0, 32, -1, 100])("rejects dueDay = %i", (day) => {
      expectFail({ ...validCard, dueDay: day }, "dueDay");
   });

   it.each([1, 15, 28, 31])("accepts dueDay = %i", (day) => {
      expectPass({ ...validCard, dueDay: day });
   });

   it("rejects invalid color format", () => {
      expectFail({ ...validCard, color: "red" }, "color");
   });

   it("accepts valid hex color", () => {
      expectPass({ ...validCard, color: "#FF5733" });
   });

   it("rejects invalid bankAccountId", () => {
      expectFail(
         { ...validCard, bankAccountId: "not-a-uuid" },
         "bankAccountId",
      );
   });

   it("rejects invalid brand value", () => {
      expectFail({ ...validCard, brand: "diners" }, "brand");
   });

   it("applies correct defaults", () => {
      const { creditLimit: _, ...withoutLimit } = validCard;
      const result = createCreditCardSchema.safeParse(withoutLimit);
      expect(result.success).toBe(true);
      if (result.success) {
         expect(result.data.color).toBe("#6366f1");
         expect(result.data.creditLimit).toBe("0");
      }
   });

   it("uses provided credit limit over default", () => {
      const result = createCreditCardSchema.safeParse(validCard);
      expect(result.success).toBe(true);
      if (result.success) {
         expect(result.data.creditLimit).toBe("5000.00");
      }
   });
});

// =============================================================================
// updateCreditCardSchema
// =============================================================================

describe("updateCreditCardSchema", () => {
   const parse = (input: unknown) => updateCreditCardSchema.safeParse(input);

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

   it("accepts valid brand on update", () => {
      expect(parse({ brand: "mastercard" }).success).toBe(true);
   });

   it("rejects closingDay out of range on update", () => {
      expect(parse({ closingDay: 0 }).success).toBe(false);
      expect(parse({ closingDay: 32 }).success).toBe(false);
   });
});
