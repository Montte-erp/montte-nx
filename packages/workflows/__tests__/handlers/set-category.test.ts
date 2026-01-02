import { describe, expect, it, mock } from "bun:test";
import { setCategoryHandler } from "../../src/actions/handlers/set-category";
import { createSetCategoryConsequence, createTestConsequence } from "../helpers/fixtures";
import { createMockContext, type MockContextOverrides } from "../helpers/mock-context";

function createMockDbForCategory(overrides: {
   deleteResult?: unknown[];
   insertResult?: unknown[];
   updateResult?: unknown[];
   shouldThrow?: boolean;
   errorMessage?: string;
} = {}) {
   const {
      deleteResult = [],
      insertResult = [{ id: "new" }],
      updateResult = [{ id: "tx-123" }],
      shouldThrow = false,
      errorMessage = "DB Error",
   } = overrides;

   if (shouldThrow) {
      return {
         delete: mock(() => ({
            where: mock(() => Promise.reject(new Error(errorMessage))),
         })),
         insert: mock(() => ({
            values: mock(() => ({
               returning: mock(() => Promise.reject(new Error(errorMessage))),
            })),
         })),
         update: mock(() => ({
            set: mock(() => ({
               where: mock(() => ({
                  returning: mock(() => Promise.reject(new Error(errorMessage))),
               })),
            })),
         })),
      };
   }

   return {
      delete: mock(() => ({
         where: mock(() => Promise.resolve(deleteResult)),
      })),
      insert: mock(() => ({
         values: mock(() => Promise.resolve(insertResult)),
      })),
      update: mock(() => ({
         set: mock(() => ({
            where: mock(() => Promise.resolve(updateResult)),
         })),
      })),
   };
}

function createCategoryContext(
   dbOverrides: Parameters<typeof createMockDbForCategory>[0] = {},
   contextOverrides: Omit<MockContextOverrides, "db"> = {},
) {
   const db = createMockDbForCategory(dbOverrides);
   return createMockContext({ db: db as unknown as MockContextOverrides["db"], ...contextOverrides });
}

describe("setCategoryHandler", () => {
   describe("execute", () => {
      it("should set single category", async () => {
         const consequence = createSetCategoryConsequence("cat-123");
         const context = createCategoryContext();

         const result = await setCategoryHandler.execute(consequence, context);

         expect(result.success).toBe(true);
         expect(result.type).toBe("set_category");
         expect((result.result as { categoryIds: string[] }).categoryIds).toEqual(["cat-123"]);
      });

      it("should set multiple categories with equal split", async () => {
         const consequence = createTestConsequence({
            type: "set_category",
            payload: {
               categoryIds: ["cat-1", "cat-2"],
               categorySplitMode: "equal",
            },
         });
         const context = createCategoryContext({}, {
            eventData: { id: "tx-123", amount: 100 },
         });

         const result = await setCategoryHandler.execute(consequence, context);

         expect(result.success).toBe(true);
         expect((result.result as { categoryIds: string[] }).categoryIds).toEqual(["cat-1", "cat-2"]);
         expect((result.result as { splits: unknown[] }).splits).toBeDefined();
      });

      it("should set categories with percentage split", async () => {
         const consequence = createTestConsequence({
            type: "set_category",
            payload: {
               categorySplitMode: "percentage",
               categorySplits: [
                  { categoryId: "cat-1", value: 60 },
                  { categoryId: "cat-2", value: 40 },
               ],
            },
         });
         const context = createCategoryContext({}, {
            eventData: { id: "tx-123", amount: 100 },
         });

         const result = await setCategoryHandler.execute(consequence, context);

         expect(result.success).toBe(true);
         expect((result.result as { categoryIds: string[] }).categoryIds).toEqual(["cat-1", "cat-2"]);
      });

      it("should set categories with fixed split", async () => {
         const consequence = createTestConsequence({
            type: "set_category",
            payload: {
               categorySplitMode: "fixed",
               categorySplits: [
                  { categoryId: "cat-1", value: 60 },
                  { categoryId: "cat-2", value: 40 },
               ],
            },
         });
         const context = createCategoryContext({}, {
            eventData: { id: "tx-123", amount: 100 },
         });

         const result = await setCategoryHandler.execute(consequence, context);

         expect(result.success).toBe(true);
      });

      it("should skip when no categories to set", async () => {
         const consequence = createTestConsequence({
            type: "set_category",
            payload: {},
         });
         const context = createCategoryContext();

         const result = await setCategoryHandler.execute(consequence, context);

         expect(result.success).toBe(true);
         expect(result.skipped).toBe(true);
         expect(result.skipReason).toContain("No categories");
      });

      it("should fail when no transaction ID in event data", async () => {
         const consequence = createSetCategoryConsequence("cat-123");
         const context = createCategoryContext({}, { eventData: { description: "No ID" } });

         const result = await setCategoryHandler.execute(consequence, context);

         expect(result.success).toBe(false);
         expect(result.error).toContain("transaction ID");
      });

      it("should return dry run result", async () => {
         const consequence = createTestConsequence({
            type: "set_category",
            payload: {
               categoryIds: ["cat-1", "cat-2"],
               categorySplitMode: "equal",
            },
         });
         const context = createCategoryContext({}, {
            eventData: { id: "tx-123", amount: 100 },
            dryRun: true,
         });

         const result = await setCategoryHandler.execute(consequence, context);

         expect(result.success).toBe(true);
         expect((result.result as { dryRun: boolean }).dryRun).toBe(true);
         expect((result.result as { categoryIds: string[] }).categoryIds).toEqual(["cat-1", "cat-2"]);
         expect((result.result as { splits: unknown }).splits).toBeDefined();
      });

      it("should handle database errors gracefully", async () => {
         const consequence = createSetCategoryConsequence("cat-123");
         const context = createCategoryContext({ shouldThrow: true, errorMessage: "Connection failed" });

         const result = await setCategoryHandler.execute(consequence, context);

         expect(result.success).toBe(false);
         expect(result.error).toBe("Connection failed");
      });

      it("should use categoryIds when categorySplitMode is not specified", async () => {
         const consequence = createTestConsequence({
            type: "set_category",
            payload: {
               categoryIds: ["cat-1", "cat-2", "cat-3"],
            },
         });
         const context = createCategoryContext({}, {
            eventData: { id: "tx-123", amount: 150 },
         });

         const result = await setCategoryHandler.execute(consequence, context);

         expect(result.success).toBe(true);
         expect((result.result as { categoryIds: string[] }).categoryIds).toEqual(["cat-1", "cat-2", "cat-3"]);
      });
   });

   describe("validate", () => {
      it("should return valid when categoryId is provided", () => {
         const result = setCategoryHandler.validate?.({ categoryId: "cat-123" });

         expect(result?.valid).toBe(true);
         expect(result?.errors).toEqual([]);
      });

      it("should return valid when categoryIds is provided", () => {
         const result = setCategoryHandler.validate?.({ categoryIds: ["cat-1", "cat-2"] });

         expect(result?.valid).toBe(true);
      });

      it("should return valid for dynamic mode without categories", () => {
         const result = setCategoryHandler.validate?.({ categorySplitMode: "dynamic" });

         expect(result?.valid).toBe(true);
      });

      it("should return invalid when no categories and not dynamic mode", () => {
         const result = setCategoryHandler.validate?.({});

         expect(result?.valid).toBe(false);
         expect(result?.errors).toContain("At least one category is required (unless using dynamic mode)");
      });

      it("should return invalid when percentage mode without splits", () => {
         const result = setCategoryHandler.validate?.({
            categoryIds: ["cat-1"],
            categorySplitMode: "percentage",
         });

         expect(result?.valid).toBe(false);
         expect(result?.errors).toContain("Split values are required for percentage/fixed mode");
      });

      it("should return invalid when fixed mode without splits", () => {
         const result = setCategoryHandler.validate?.({
            categoryIds: ["cat-1"],
            categorySplitMode: "fixed",
         });

         expect(result?.valid).toBe(false);
         expect(result?.errors).toContain("Split values are required for percentage/fixed mode");
      });

      it("should return invalid when percentage splits don't sum to 100", () => {
         const result = setCategoryHandler.validate?.({
            categoryIds: ["cat-1", "cat-2"],
            categorySplitMode: "percentage",
            categorySplits: [
               { categoryId: "cat-1", value: 50 },
               { categoryId: "cat-2", value: 30 },
            ],
         });

         expect(result?.valid).toBe(false);
         expect(result?.errors).toContain("Percentage splits must sum to 100% (current: 80%)");
      });

      it("should return valid when percentage splits sum to 100", () => {
         const result = setCategoryHandler.validate?.({
            categoryIds: ["cat-1", "cat-2"],
            categorySplitMode: "percentage",
            categorySplits: [
               { categoryId: "cat-1", value: 60 },
               { categoryId: "cat-2", value: 40 },
            ],
         });

         expect(result?.valid).toBe(true);
      });

      it("should return valid for equal mode with categoryIds", () => {
         const result = setCategoryHandler.validate?.({
            categorySplitMode: "equal",
            categoryIds: ["cat-1", "cat-2", "cat-3"],
         });

         expect(result?.valid).toBe(true);
      });
   });
});
