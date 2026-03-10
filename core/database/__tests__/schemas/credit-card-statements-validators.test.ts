import { describe, expect, it } from "vitest";
import { createStatementSchema } from "@core/database/schemas/credit-card-statements";

// =============================================================================
// Helpers
// =============================================================================

function expectPass(input: unknown) {
   const result = createStatementSchema.safeParse(input);
   expect(result.success).toBe(true);
   return result;
}

function expectFail(input: unknown, path?: string) {
   const result = createStatementSchema.safeParse(input);
   expect(result.success).toBe(false);
   if (path && !result.success) {
      expect(result.error.issues.some((i) => i.path.includes(path))).toBe(true);
   }
}

// =============================================================================
// createStatementSchema
// =============================================================================

describe("createStatementSchema", () => {
   const valid = {
      creditCardId: "550e8400-e29b-41d4-a716-446655440000",
      statementPeriod: "2026-03",
      closingDate: "2026-03-15",
      dueDate: "2026-03-25",
   };

   it("accepts valid statement", () => {
      expectPass(valid);
   });

   it("rejects invalid statementPeriod format", () => {
      expectFail({ ...valid, statementPeriod: "2026-3" }, "statementPeriod");
      expectFail({ ...valid, statementPeriod: "03-2026" }, "statementPeriod");
      expectFail({ ...valid, statementPeriod: "2026/03" }, "statementPeriod");
   });

   it("rejects statementPeriod with invalid month", () => {
      expectFail({ ...valid, statementPeriod: "2026-00" }, "statementPeriod");
      expectFail({ ...valid, statementPeriod: "2026-13" }, "statementPeriod");
   });

   it("accepts statementPeriod for all valid months", () => {
      for (let m = 1; m <= 12; m++) {
         expectPass({
            ...valid,
            statementPeriod: `2026-${String(m).padStart(2, "0")}`,
         });
      }
   });

   it("rejects invalid creditCardId", () => {
      expectFail({ ...valid, creditCardId: "not-a-uuid" }, "creditCardId");
   });

   it("rejects invalid closingDate format", () => {
      expectFail({ ...valid, closingDate: "15/03/2026" }, "closingDate");
   });

   it("rejects invalid dueDate format", () => {
      expectFail({ ...valid, dueDate: "25/03/2026" }, "dueDate");
   });
});
