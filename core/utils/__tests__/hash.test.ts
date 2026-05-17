import { describe, expect, it } from "vitest";
import { sha256JsonHash, stringifyJson } from "../src/hash";

describe("hash", () => {
   it("stringifyJson throws a clear error for unsupported root values", () => {
      expect(() => stringifyJson(undefined)).toThrow(TypeError);
      expect(() => stringifyJson(() => undefined)).toThrow(TypeError);
      expect(() => stringifyJson(Symbol("value"))).toThrow(TypeError);
   });

   it("sha256JsonHash accepts serializable values", () => {
      expect(sha256JsonHash({ value: "ok" })).toMatch(/^[a-f0-9]{64}$/);
   });
});
