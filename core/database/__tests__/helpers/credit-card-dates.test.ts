import { describe, expect, it } from "vitest";
import {
   computeStatementPeriod,
   computeClosingDate,
   computeDueDate,
} from "@core/database/helpers/credit-card-dates";

describe("computeStatementPeriod", () => {
   it("returns same month when purchase is before closing day", () => {
      expect(computeStatementPeriod("2026-03-10", 15)).toBe("2026-03");
   });

   it("returns same month when purchase is on closing day", () => {
      expect(computeStatementPeriod("2026-03-15", 15)).toBe("2026-03");
   });

   it("returns next month when purchase is after closing day", () => {
      expect(computeStatementPeriod("2026-03-20", 15)).toBe("2026-04");
   });

   it("handles year rollover (December → January)", () => {
      expect(computeStatementPeriod("2026-12-20", 15)).toBe("2027-01");
   });

   it("handles purchase on closing day at end of month", () => {
      expect(computeStatementPeriod("2026-01-31", 31)).toBe("2026-01");
   });
});

describe("computeClosingDate", () => {
   it("returns closing date for the given period", () => {
      expect(computeClosingDate("2026-03", 15)).toBe("2026-03-15");
   });

   it("clamps closing day to last day of month (Feb)", () => {
      expect(computeClosingDate("2026-02", 31)).toBe("2026-02-28");
   });

   it("clamps closing day to last day of month (Apr)", () => {
      expect(computeClosingDate("2026-04", 31)).toBe("2026-04-30");
   });
});

describe("computeDueDate", () => {
   it("returns same month when dueDay >= closingDay", () => {
      expect(computeDueDate("2026-03", 15, 25)).toBe("2026-03-25");
   });

   it("returns next month when dueDay < closingDay", () => {
      expect(computeDueDate("2026-03", 25, 5)).toBe("2026-04-05");
   });

   it("handles year rollover", () => {
      expect(computeDueDate("2026-12", 25, 5)).toBe("2027-01-05");
   });

   it("clamps due day to last day of target month", () => {
      expect(computeDueDate("2026-01", 31, 5)).toBe("2026-02-05");
   });

   it("clamps due day when same month has fewer days", () => {
      expect(computeDueDate("2026-02", 15, 31)).toBe("2026-02-28");
   });
});
