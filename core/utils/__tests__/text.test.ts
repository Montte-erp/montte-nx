import { describe, expect, it } from "vitest";
import { createSlug } from "../src/text";

describe("text utilities", () => {
   describe("createSlug", () => {
      it("creates a slug from text", () => {
         expect(createSlug("Hello World Test")).toBe("hello-world-test");
      });

      it("removes special characters", () => {
         expect(createSlug("Hello! @#$%^&*() World")).toBe("hello-world");
      });

      it("normalizes accented characters", () => {
         expect(createSlug("Café résumé")).toBe("cafe-resume");
      });

      it("handles an empty string", () => {
         expect(createSlug("")).toBe("");
      });
   });
});
