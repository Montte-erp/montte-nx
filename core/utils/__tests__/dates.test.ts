import { describe, expect, it } from "vitest";
import { isIsoDateString } from "../src/dates";

describe("date utilities", () => {
   describe("isIsoDateString", () => {
      it("accepts valid YYYY-MM-DD dates", () => {
         expect(isIsoDateString("2026-05-17")).toBe(true);
      });

      it("rejects impossible calendar dates", () => {
         expect(isIsoDateString("2026-02-30")).toBe(false);
      });

      it("rejects non-ISO date strings", () => {
         expect(isIsoDateString("17/05/2026")).toBe(false);
      });
   });
});
