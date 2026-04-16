import { describe, expect, it } from "vitest";
import {
   guessMapping,
   mappingStorageKey,
} from "@/features/import/lib/column-mapper";
import type { ColumnDef } from "@/features/import/types";

const DEFS: ColumnDef[] = [
   {
      field: "name",
      label: "Nome *",
      patterns: [/^(nome|name|categoria)$/i],
      required: true,
   },
   { field: "type", label: "Tipo", patterns: [/^(tipo|type)$/i] },
];

describe("guessMapping", () => {
   it("maps known headers by regex", () => {
      expect(guessMapping(["nome", "tipo"], DEFS)).toEqual({
         nome: "name",
         tipo: "type",
      });
   });
   it("marks unknown as __skip__", () => {
      expect(guessMapping(["xyz"], DEFS)["xyz"]).toBe("__skip__");
   });
   it("is case-insensitive", () => {
      expect(guessMapping(["NOME"], DEFS)["NOME"]).toBe("name");
   });
   it("first matching def wins", () => {
      expect(guessMapping(["name"], DEFS)["name"]).toBe("name");
   });
});

describe("mappingStorageKey", () => {
   it("is order-independent", () => {
      expect(mappingStorageKey("cat", ["a", "b"])).toBe(
         mappingStorageKey("cat", ["b", "a"]),
      );
   });
   it("scopes by featureKey", () => {
      expect(mappingStorageKey("cat", ["a"])).not.toBe(
         mappingStorageKey("tx", ["a"]),
      );
   });
});
