import { describe, expect, it } from "vitest";
import {
   activeCount,
   costPerCycle,
   formatCostBRL,
   monthlyEstimateForBenefit,
   pausedCount,
   summarizeByType,
   topByCost,
   totalCostPerCycle,
   totalMonthlyEstimate,
   type BenefitForAggregate,
} from "../../src/services/benefits-aggregates";

const credit = (
   overrides: Partial<BenefitForAggregate>,
): BenefitForAggregate => ({
   id: "1",
   name: "default",
   type: "credits",
   creditAmount: 100,
   unitCost: "0.01",
   isActive: true,
   usedInServices: 1,
   ...overrides,
});

describe("monthlyEstimateForBenefit", () => {
   it("returns zero when paused", () => {
      const m = monthlyEstimateForBenefit(credit({ isActive: false }));
      expect(formatCostBRL(m)).toContain("0");
   });

   it("multiplies unitCost × creditAmount × usedInServices", () => {
      const m = monthlyEstimateForBenefit(
         credit({ creditAmount: 1000, unitCost: "0.001", usedInServices: 5 }),
      );
      // 1000 * 0.001 * 5 = 5.00
      expect(formatCostBRL(m)).toMatch(/R\$\s*5,00/);
   });

   it("treats null creditAmount as 1 unit (feature_access/custom)", () => {
      const m = monthlyEstimateForBenefit(
         credit({
            type: "feature_access",
            creditAmount: null,
            unitCost: "10",
            usedInServices: 3,
         }),
      );
      // 1 * 10 * 3 = 30
      expect(formatCostBRL(m)).toMatch(/R\$\s*30,00/);
   });
});

describe("totalMonthlyEstimate", () => {
   it("sums across benefits", () => {
      const total = totalMonthlyEstimate([
         credit({
            id: "a",
            creditAmount: 1000,
            unitCost: "0.001",
            usedInServices: 1,
         }),
         credit({
            id: "b",
            creditAmount: 500,
            unitCost: "0.002",
            usedInServices: 1,
         }),
      ]);
      // 1 + 1 = 2
      expect(formatCostBRL(total)).toMatch(/R\$\s*2,00/);
   });

   it("returns zero for empty list", () => {
      expect(formatCostBRL(totalMonthlyEstimate([]))).toMatch(/R\$\s*0,00/);
   });
});

describe("summarizeByType", () => {
   it("groups by type with counts and top", () => {
      const summaries = summarizeByType([
         credit({
            id: "a",
            type: "credits",
            creditAmount: 100,
            unitCost: "0.01",
            usedInServices: 1,
         }),
         credit({
            id: "b",
            type: "credits",
            creditAmount: 1000,
            unitCost: "0.01",
            usedInServices: 1,
         }),
         credit({
            id: "c",
            type: "feature_access",
            creditAmount: null,
            unitCost: "5",
            usedInServices: 2,
         }),
         credit({ id: "d", type: "credits", isActive: false }),
      ]);
      const credits = summaries.find((s) => s.type === "credits");
      expect(credits?.count).toBe(3);
      expect(credits?.activeCount).toBe(2);
      expect(credits?.topByCost?.id).toBe("b");

      const feat = summaries.find((s) => s.type === "feature_access");
      expect(feat?.count).toBe(1);
   });
});

describe("topByCost", () => {
   it("ranks by intrinsic per-cycle cost, ignoring usedInServices", () => {
      const list = [
         credit({
            id: "a",
            creditAmount: 100,
            unitCost: "0.01",
            usedInServices: 99,
         }),
         credit({
            id: "b",
            creditAmount: 1000,
            unitCost: "0.01",
            usedInServices: 0,
         }),
         credit({
            id: "c",
            isActive: false,
            creditAmount: 9999,
            unitCost: "9999",
         }),
      ];
      const top = topByCost(list, 2);
      // b has higher intrinsic cost (1000*0.01 = 10) than a (100*0.01 = 1)
      expect(top.map((t) => t.id)).toEqual(["b", "a"]);
   });
});

describe("costPerCycle / totalCostPerCycle", () => {
   it("intrinsic cost ignores usedInServices", () => {
      const m = costPerCycle(
         credit({ creditAmount: 1000, unitCost: "0.001", usedInServices: 0 }),
      );
      expect(formatCostBRL(m)).toMatch(/R\$\s*1,00/);
   });
   it("returns zero when paused", () => {
      const m = costPerCycle(
         credit({ isActive: false, creditAmount: 1000, unitCost: "1" }),
      );
      expect(formatCostBRL(m)).toMatch(/R\$\s*0,00/);
   });
   it("totals across benefits", () => {
      const total = totalCostPerCycle([
         credit({
            id: "a",
            creditAmount: 100,
            unitCost: "1",
            usedInServices: 0,
         }),
         credit({
            id: "b",
            creditAmount: null,
            unitCost: "50",
            usedInServices: 0,
         }),
      ]);
      // 100 * 1 + 1 * 50 = 150
      expect(formatCostBRL(total)).toMatch(/R\$\s*150,00/);
   });
});

describe("active/paused counts", () => {
   it("counts correctly", () => {
      const list = [
         credit({ id: "1", isActive: true }),
         credit({ id: "2", isActive: true }),
         credit({ id: "3", isActive: false }),
      ];
      expect(activeCount(list)).toBe(2);
      expect(pausedCount(list)).toBe(1);
   });
});
