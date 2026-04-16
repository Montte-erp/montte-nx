import { describe, expect, it } from "vitest";
import { applyMapping, getSampleValues } from "@/features/import/lib/map-rows";

const raw = {
   headers: ["nome", "tipo"],
   rows: [
      ["Alimentação", "despesa"],
      ["", ""],
      ["  ", "  "],
   ],
};

describe("applyMapping", () => {
   it("maps fields and drops empty rows", () => {
      const result = applyMapping(raw, { nome: "name", tipo: "type" });
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ name: "Alimentação", type: "despesa" });
   });
   it("omits __skip__ columns", () => {
      const result = applyMapping(raw, { nome: "name", tipo: "__skip__" });
      expect(result[0]).not.toHaveProperty("type");
   });
   it("trims whitespace from values", () => {
      const result = applyMapping(
         { headers: ["nome"], rows: [["  foo  "]] },
         { nome: "name" },
      );
      expect(result[0]).toEqual({ name: "foo" });
   });
});

describe("getSampleValues", () => {
   it("joins up to 3 non-empty values", () => {
      expect(getSampleValues(raw, "nome")).toBe("Alimentação");
   });
   it("returns empty string for unknown header", () => {
      expect(getSampleValues(raw, "unknown")).toBe("");
   });
});
