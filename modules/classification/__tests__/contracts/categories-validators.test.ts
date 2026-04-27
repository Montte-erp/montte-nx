import { describe, expect, it } from "vitest";
import {
   createCategorySchema,
   updateCategorySchema,
} from "../../src/contracts/categories";

// =============================================================================
// Helpers
// =============================================================================

function expectPass(input: unknown) {
   const result = createCategorySchema.safeParse(input);
   expect(result.success).toBe(true);
   return result;
}

function expectFail(input: unknown, path?: string) {
   const result = createCategorySchema.safeParse(input);
   expect(result.success).toBe(false);
   if (path && !result.success) {
      expect(result.error.issues.some((i) => i.path.includes(path))).toBe(true);
   }
}

// =============================================================================
// createCategorySchema
// =============================================================================

describe("createCategorySchema", () => {
   it("accepts valid income category", () => {
      expectPass({ name: "Salário", type: "income" });
   });

   it("accepts valid expense category", () => {
      expectPass({ name: "Alimentação", type: "expense" });
   });

   it("accepts category with all optional fields", () => {
      expectPass({
         name: "Serviços",
         type: "income",
         parentId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
         description: "Receita de serviços",
         color: "#FF5733",
         icon: "briefcase",
         keywords: ["serviço", "consultoria"],
         notes: "Nota importante",
         participatesDre: true,
         dreGroupId: "receita-operacional",
      });
   });

   it("accepts category with minimal fields (name + type only)", () => {
      expectPass({ name: "Outros", type: "expense" });
   });

   it("rejects name shorter than 2 chars", () => {
      expectFail({ name: "A", type: "income" });
   });

   it("rejects name longer than 120 chars", () => {
      expectFail({ name: "A".repeat(121), type: "income" });
   });

   it("rejects invalid type", () => {
      expectFail({ name: "Teste", type: "invalid" });
   });

   it("rejects missing type", () => {
      expectFail({ name: "Teste" });
   });

   it("rejects invalid color format", () => {
      expectFail({ name: "Teste", type: "income", color: "red" });
   });

   it("accepts valid hex color", () => {
      expectPass({ name: "Teste", type: "income", color: "#FF5733" });
   });

   it("accepts null color", () => {
      expectPass({ name: "Teste", type: "income", color: null });
   });

   it("rejects description longer than 255 chars", () => {
      expectFail({
         name: "Teste",
         type: "income",
         description: "A".repeat(256),
      });
   });

   it("rejects keywords array with more than 20 items", () => {
      expectFail({
         name: "Teste",
         type: "income",
         keywords: Array.from({ length: 21 }, (_, i) => `kw${i}`),
      });
   });

   it("rejects empty string in keywords", () => {
      expectFail({ name: "Teste", type: "income", keywords: [""] });
   });

   it("accepts valid parentId UUID", () => {
      expectPass({
         name: "Sub",
         type: "income",
         parentId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      });
   });

   it("rejects invalid parentId format", () => {
      expectFail({ name: "Sub", type: "income", parentId: "not-a-uuid" });
   });

   it("rejects participatesDre=true without dreGroupId", () => {
      expectFail(
         { name: "Teste", type: "income", participatesDre: true },
         "dreGroupId",
      );
   });

   it("accepts participatesDre=true with dreGroupId", () => {
      expectPass({
         name: "Teste",
         type: "income",
         participatesDre: true,
         dreGroupId: "receita-operacional",
      });
   });

   it("applies correct defaults", () => {
      const result = createCategorySchema.safeParse({
         name: "Teste",
         type: "income",
      });
      expect(result.success).toBe(true);
      if (result.success) {
         expect(result.data.participatesDre).toBe(false);
      }
   });
});

// =============================================================================
// updateCategorySchema
// =============================================================================

describe("updateCategorySchema", () => {
   const parse = (input: unknown) => updateCategorySchema.safeParse(input);

   it("accepts empty object (all fields optional)", () => {
      expect(parse({}).success).toBe(true);
   });

   it("accepts partial update with only name", () => {
      expect(parse({ name: "Novo Nome" }).success).toBe(true);
   });

   it("rejects invalid color on update", () => {
      expect(parse({ color: "invalid" }).success).toBe(false);
   });

   it("rejects name shorter than 2 chars on update", () => {
      expect(parse({ name: "A" }).success).toBe(false);
   });

   it("accepts valid color on update", () => {
      expect(parse({ color: "#AABBCC" }).success).toBe(true);
   });

   it("does not accept type field (immutable)", () => {
      const result = parse({ type: "income" });
      expect(result.success).toBe(true);
      if (result.success) {
         expect("type" in result.data).toBe(false);
      }
   });

   it("does not accept parentId field (immutable)", () => {
      const result = parse({
         parentId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      });
      expect(result.success).toBe(true);
      if (result.success) {
         expect("parentId" in result.data).toBe(false);
      }
   });

   it("rejects participatesDre=true without dreGroupId", () => {
      expect(parse({ participatesDre: true }).success).toBe(false);
   });
});
