import { describe, expect, it } from "vitest";
import { tableSearchSchema } from "@/lib/table-search-schema";

describe("tableSearchSchema", () => {
   it("defaults sorting and columnFilters to empty arrays when omitted", () => {
      const result = tableSearchSchema.parse({});
      expect(result.sorting).toEqual([]);
      expect(result.columnFilters).toEqual([]);
   });

   it("accepts valid sorting entries", () => {
      const result = tableSearchSchema.parse({
         sorting: [{ id: "name", desc: false }],
      });
      expect(result.sorting).toEqual([{ id: "name", desc: false }]);
   });

   it("accepts valid columnFilters entries", () => {
      const result = tableSearchSchema.parse({
         columnFilters: [{ id: "type", value: "cliente" }],
      });
      expect(result.columnFilters).toEqual([{ id: "type", value: "cliente" }]);
   });

   it("rejects sorting entry missing required fields", () => {
      expect(() =>
         tableSearchSchema.parse({ sorting: [{ id: "name" }] }),
      ).toThrow();
   });
});
