import { describe, expect, it } from "vitest";
import { DEFAULT_INSIGHTS } from "@packages/analytics/defaults";
import { insightConfigSchema } from "@packages/analytics/types";

describe("DEFAULT_INSIGHTS", () => {
   it("contains 5 default insights", () => {
      expect(DEFAULT_INSIGHTS).toHaveLength(5);
   });

   it("every config is valid per insightConfigSchema", () => {
      for (const insight of DEFAULT_INSIGHTS) {
         const result = insightConfigSchema.safeParse(insight.config);
         expect(result.success, `Invalid config for "${insight.name}"`).toBe(
            true,
         );
      }
   });

   it("type matches config.type for each insight", () => {
      for (const insight of DEFAULT_INSIGHTS) {
         expect(insight.type).toBe(insight.config.type);
      }
   });

   it("every defaultSize is valid", () => {
      const validSizes = new Set(["sm", "md", "lg", "full"]);
      for (const insight of DEFAULT_INSIGHTS) {
         expect(validSizes.has(insight.defaultSize)).toBe(true);
      }
   });
});
