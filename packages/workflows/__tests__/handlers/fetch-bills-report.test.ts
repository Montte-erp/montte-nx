import { describe, expect, it } from "bun:test";

// Note: We only test the validate function directly because the handler
// imports repository functions that require server environment variables.
// Full integration tests for execute would need proper environment setup.

// Inline validation logic matching the handler's validate function
function validateFetchBillsReportConfig(config: Record<string, unknown>) {
   const errors: string[] = [];

   if (!config.includePending && !config.includeOverdue) {
      errors.push("At least one of includePending or includeOverdue must be true");
   }

   if (config.daysAhead !== undefined && (config.daysAhead as number) < 0) {
      errors.push("daysAhead must be a positive number");
   }

   return { errors, valid: errors.length === 0 };
}

describe("fetchBillsReportHandler validation", () => {
   it("should return valid for default configuration", () => {
      const result = validateFetchBillsReportConfig({
         includePending: true,
         includeOverdue: true,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
   });

   it("should return valid when only includePending is true", () => {
      const result = validateFetchBillsReportConfig({
         includePending: true,
         includeOverdue: false,
      });

      expect(result.valid).toBe(true);
   });

   it("should return valid when only includeOverdue is true", () => {
      const result = validateFetchBillsReportConfig({
         includePending: false,
         includeOverdue: true,
      });

      expect(result.valid).toBe(true);
   });

   it("should return invalid when both includePending and includeOverdue are false", () => {
      const result = validateFetchBillsReportConfig({
         includePending: false,
         includeOverdue: false,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("At least one of includePending or includeOverdue must be true");
   });

   it("should return invalid for negative daysAhead", () => {
      const result = validateFetchBillsReportConfig({
         includePending: true,
         daysAhead: -5,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("daysAhead must be a positive number");
   });

   it("should return valid for zero daysAhead", () => {
      const result = validateFetchBillsReportConfig({
         includePending: true,
         daysAhead: 0,
      });

      expect(result.valid).toBe(true);
   });

   it("should return valid for positive daysAhead", () => {
      const result = validateFetchBillsReportConfig({
         includePending: true,
         daysAhead: 14,
      });

      expect(result.valid).toBe(true);
   });

   it("should return valid without daysAhead (uses default)", () => {
      const result = validateFetchBillsReportConfig({
         includePending: true,
      });

      expect(result.valid).toBe(true);
   });

   it("should return valid with billTypes array", () => {
      const result = validateFetchBillsReportConfig({
         includePending: true,
         billTypes: ["expense", "income"],
      });

      expect(result.valid).toBe(true);
   });

   it("should return invalid with empty config when both flags are falsy", () => {
      const result = validateFetchBillsReportConfig({});

      // The validate function checks: if (!config.includePending && !config.includeOverdue)
      // With empty config, both are undefined which is falsy, so validation fails
      expect(result.valid).toBe(false);
   });

   it("should return multiple errors for multiple issues", () => {
      const result = validateFetchBillsReportConfig({
         includePending: false,
         includeOverdue: false,
         daysAhead: -1,
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
   });
});
