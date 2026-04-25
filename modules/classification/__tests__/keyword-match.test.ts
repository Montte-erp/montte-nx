import { describe, expect, it } from "vitest";
import { matchByKeywords } from "../src/keyword-match";

describe("matchByKeywords", () => {
   it("matches when single category has 2+ keyword hits", () => {
      const results = matchByKeywords(
         [{ id: "tx-1", name: "Burger King delivery", contactName: null }],
         [
            {
               id: "cat-food",
               name: "Food",
               keywords: ["burger", "delivery", "uber eats"],
            },
         ],
      );

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
         transactionId: "tx-1",
         matchedCategoryId: "cat-food",
         topScore: 2,
         runnerUpScore: 0,
         reason: "matched",
      });
   });

   it("returns null when single category has only 1 hit (below threshold)", () => {
      const results = matchByKeywords(
         [{ id: "tx-1", name: "Burger King", contactName: null }],
         [
            {
               id: "cat-food",
               name: "Food",
               keywords: ["burger", "delivery", "uber eats"],
            },
         ],
      );

      expect(results[0].matchedCategoryId).toBeNull();
      expect(results[0].topScore).toBe(1);
      expect(results[0].reason).toBe("below-threshold");
   });

   it("returns null when top doesn't beat runner-up by 50% margin (3 vs 2)", () => {
      const results = matchByKeywords(
         [
            {
               id: "tx-1",
               name: "Burger delivery food",
               contactName: null,
            },
         ],
         [
            {
               id: "cat-a",
               name: "A",
               keywords: ["burger", "delivery", "food"],
            },
            {
               id: "cat-b",
               name: "B",
               keywords: ["burger", "delivery"],
            },
         ],
      );

      expect(results[0].matchedCategoryId).toBeNull();
      expect(results[0].topScore).toBe(3);
      expect(results[0].runnerUpScore).toBe(2);
      expect(results[0].reason).toBe("tie-or-too-close");
   });

   it("matches when top beats runner-up by 2x (4 vs 2)", () => {
      const results = matchByKeywords(
         [
            {
               id: "tx-1",
               name: "alpha beta gamma delta epsilon zeta",
               contactName: null,
            },
         ],
         [
            {
               id: "cat-a",
               name: "A",
               keywords: ["alpha", "beta", "gamma", "delta"],
            },
            {
               id: "cat-b",
               name: "B",
               keywords: ["epsilon", "zeta"],
            },
         ],
      );

      expect(results[0].matchedCategoryId).toBe("cat-a");
      expect(results[0].topScore).toBe(4);
      expect(results[0].runnerUpScore).toBe(2);
      expect(results[0].reason).toBe("matched");
   });

   it("skips categories with empty/null keywords", () => {
      const results = matchByKeywords(
         [{ id: "tx-1", name: "Anything", contactName: null }],
         [
            { id: "cat-empty", name: "Empty", keywords: [] },
            { id: "cat-null", name: "Null", keywords: null },
         ],
      );

      expect(results[0].matchedCategoryId).toBeNull();
      expect(results[0].topScore).toBe(0);
      expect(results[0].runnerUpScore).toBe(0);
      expect(results[0].reason).toBe("below-threshold");
   });

   it("returns null for all transactions when no categories at all", () => {
      const results = matchByKeywords(
         [
            { id: "tx-1", name: "Anything", contactName: null },
            { id: "tx-2", name: "Anything else", contactName: null },
         ],
         [],
      );

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.matchedCategoryId === null)).toBe(true);
      expect(results.every((r) => r.reason === "below-threshold")).toBe(true);
   });

   it("matches case-insensitively", () => {
      const results = matchByKeywords(
         [{ id: "tx-1", name: "burger king", contactName: null }],
         [
            {
               id: "cat-food",
               name: "Food",
               keywords: ["Burger", "King"],
            },
         ],
      );

      expect(results[0].matchedCategoryId).toBe("cat-food");
      expect(results[0].topScore).toBe(2);
   });

   it("returns one result per input transaction", () => {
      const results = matchByKeywords(
         [
            { id: "tx-1", name: "burger delivery", contactName: null },
            { id: "tx-2", name: "uber gas station", contactName: null },
            { id: "tx-3", name: "no match here", contactName: null },
         ],
         [
            {
               id: "cat-food",
               name: "Food",
               keywords: ["burger", "delivery", "uber eats"],
            },
            {
               id: "cat-fuel",
               name: "Fuel",
               keywords: ["uber", "gas", "station"],
            },
         ],
      );

      expect(results).toHaveLength(3);
      expect(results[0].transactionId).toBe("tx-1");
      expect(results[0].matchedCategoryId).toBe("cat-food");
      expect(results[1].transactionId).toBe("tx-2");
      expect(results[1].matchedCategoryId).toBe("cat-fuel");
      expect(results[2].transactionId).toBe("tx-3");
      expect(results[2].matchedCategoryId).toBeNull();
   });

   it("matches keywords against contactName as well as transactionName", () => {
      const results = matchByKeywords(
         [
            {
               id: "tx-1",
               name: "Pagamento mensal",
               contactName: "Uber Eats Brasil",
            },
         ],
         [
            {
               id: "cat-food",
               name: "Food",
               keywords: ["uber", "eats"],
            },
         ],
      );

      expect(results[0].matchedCategoryId).toBe("cat-food");
      expect(results[0].topScore).toBeGreaterThanOrEqual(2);
   });
});
