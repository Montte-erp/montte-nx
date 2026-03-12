import { afterEach, describe, expect, it, vi } from "vitest";
import {
   resolveDateRange,
   resolveDateRangeWithComparison,
} from "@packages/analytics/date-ranges";

function localMidnight(year: number, month: number, day: number): Date {
   const d = new Date(year, month - 1, day);
   d.setHours(0, 0, 0, 0);
   return d;
}

describe("resolveDateRange", () => {
   afterEach(() => {
      vi.useRealTimers();
   });

   it("resolves absolute date range", () => {
      const result = resolveDateRange({
         type: "absolute",
         start: "2026-01-01T00:00:00.000Z",
         end: "2026-01-31T23:59:59.000Z",
      });
      expect(result.start).toEqual(new Date("2026-01-01T00:00:00.000Z"));
      expect(result.end).toEqual(new Date("2026-01-31T23:59:59.000Z"));
   });

   it("resolves 7d relative range", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 2, 11, 12, 0, 0));

      const result = resolveDateRange({ type: "relative", value: "7d" });
      expect(result.start).toEqual(localMidnight(2026, 3, 4));
   });

   it("resolves 14d relative range", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 2, 11, 12, 0, 0));

      const result = resolveDateRange({ type: "relative", value: "14d" });
      expect(result.start).toEqual(localMidnight(2026, 2, 25));
   });

   it("resolves 30d relative range", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 2, 11, 12, 0, 0));

      const result = resolveDateRange({ type: "relative", value: "30d" });
      expect(result.start).toEqual(localMidnight(2026, 2, 9));
   });

   it("resolves 90d relative range", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 2, 11, 12, 0, 0));

      const result = resolveDateRange({ type: "relative", value: "90d" });
      expect(result.start).toEqual(localMidnight(2025, 12, 11));
   });

   it("resolves 180d relative range", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 2, 11, 12, 0, 0));

      const result = resolveDateRange({ type: "relative", value: "180d" });
      expect(result.start).toEqual(localMidnight(2025, 9, 12));
   });

   it("resolves 12m relative range", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 2, 11, 12, 0, 0));

      const result = resolveDateRange({ type: "relative", value: "12m" });
      expect(result.start).toEqual(localMidnight(2025, 3, 11));
   });

   it("resolves this_month relative range", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 2, 15, 12, 0, 0));

      const result = resolveDateRange({
         type: "relative",
         value: "this_month",
      });
      expect(result.start).toEqual(localMidnight(2026, 3, 1));
   });

   it("resolves last_month relative range", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 2, 15, 12, 0, 0));

      const result = resolveDateRange({
         type: "relative",
         value: "last_month",
      });
      expect(result.start).toEqual(localMidnight(2026, 2, 1));
      expect(result.end).toEqual(localMidnight(2026, 3, 1));
   });

   it("resolves this_quarter relative range", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 4, 15, 12, 0, 0));

      const result = resolveDateRange({
         type: "relative",
         value: "this_quarter",
      });
      expect(result.start).toEqual(localMidnight(2026, 4, 1));
   });

   it("resolves this_year relative range", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 5, 15, 12, 0, 0));

      const result = resolveDateRange({ type: "relative", value: "this_year" });
      expect(result.start).toEqual(localMidnight(2026, 1, 1));
   });

   it("start of day zeroes hours, minutes, seconds, ms", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 2, 11, 15, 30, 45));

      const result = resolveDateRange({ type: "relative", value: "7d" });
      expect(result.start.getHours()).toBe(0);
      expect(result.start.getMinutes()).toBe(0);
      expect(result.start.getSeconds()).toBe(0);
      expect(result.start.getMilliseconds()).toBe(0);
   });
});

describe("resolveDateRangeWithComparison", () => {
   afterEach(() => {
      vi.useRealTimers();
   });

   it("previous period has equal length to main period", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 2, 11, 12, 0, 0));

      const result = resolveDateRangeWithComparison({
         type: "relative",
         value: "30d",
      });
      const mainDuration = result.end.getTime() - result.start.getTime();
      const prevDuration =
         result.previous.end.getTime() - result.previous.start.getTime();
      expect(prevDuration).toBe(mainDuration);
   });

   it("previous period ends where main period starts for absolute ranges", () => {
      const result = resolveDateRangeWithComparison({
         type: "absolute",
         start: "2026-01-01T00:00:00.000Z",
         end: "2026-01-31T00:00:00.000Z",
      });
      expect(result.previous.end).toEqual(new Date("2026-01-01T00:00:00.000Z"));
   });

   it("computes correct previous start for absolute range", () => {
      const result = resolveDateRangeWithComparison({
         type: "absolute",
         start: "2026-01-01T00:00:00.000Z",
         end: "2026-01-31T00:00:00.000Z",
      });
      expect(result.previous.start).toEqual(
         new Date("2025-12-02T00:00:00.000Z"),
      );
   });
});
