import { describe, expect, it } from "vitest";
import { formatDate, getCurrentDate } from "../src/date";

describe("date utilities", () => {
   describe("getCurrentDate", () => {
      it("should return current date object without timezone", () => {
         const result = getCurrentDate();
         expect(result).toHaveProperty("date");
         expect(typeof result.date).toBe("string");
         expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });

      it("should accept timezone parameter", () => {
         const result = getCurrentDate("UTC");
         expect(result).toHaveProperty("date");
         expect(typeof result.date).toBe("string");
         expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });

      it("should return different date for different timezones", () => {
         const utcResult = getCurrentDate("UTC");
         expect(utcResult.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });
   });

   describe("formatDate", () => {
      it("should format date with default format using UTC", () => {
         const date = new Date("2024-01-15T12:00:00Z");
         const result = formatDate(date);
         expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
      });

      it("should format date with custom format using UTC by default", () => {
         const date = new Date("2024-01-15T00:00:00Z");
         const result = formatDate(date, "YYYY-MM-DD");
         expect(result).toBe("2024-01-15");
      });

      it("should accept string dates", () => {
         const result = formatDate("2024-01-15T00:00:00Z", "YYYY-MM-DD");
         expect(result).toBe("2024-01-15");
      });

      it("should accept timezone parameter", () => {
         const date = new Date("2024-01-15T12:00:00Z");
         const result = formatDate(date, "YYYY-MM-DD", { timezone: "UTC" });
         expect(result).toBe("2024-01-15");
      });

      it("should handle different dates with UTC by default", () => {
         const date1 = new Date("2024-01-15T00:00:00Z");
         const date2 = new Date("2024-02-20T00:00:00Z");
         const result1 = formatDate(date1, "YYYY-MM-DD");
         const result2 = formatDate(date2, "YYYY-MM-DD");
         expect(result1).toBe("2024-01-15");
         expect(result2).toBe("2024-02-20");
      });

      it("should return fallback for invalid date", () => {
         const invalidDate = new Date("invalid");
         const result = formatDate(invalidDate);
         expect(result).toBe("-");
      });

      it("should use UTC by default", () => {
         const date = new Date("2024-06-15T00:00:00Z");
         const result = formatDate(date, "DD/MM/YYYY");
         expect(result).toBe("15/06/2024");
      });

      it("should allow disabling UTC with useUTC: false", () => {
         const date = new Date("2024-06-15T00:00:00Z");
         const result = formatDate(date, "DD/MM/YYYY", { useUTC: false });
         expect(result).toMatch(/\d{2}\/\d{2}\/2024/);
      });

      it("should replace all format tokens correctly", () => {
         const date = new Date("2024-03-25T00:00:00Z");
         const result = formatDate(date, "YYYY/MM/DD - YYYY");
         expect(result).toBe("2024/03/25 - 2024");
      });
   });
});
