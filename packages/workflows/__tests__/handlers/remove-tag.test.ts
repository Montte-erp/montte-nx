import { describe, expect, it, mock } from "bun:test";
import { removeTagHandler } from "../../src/actions/handlers/remove-tag";
import { createRemoveTagConsequence, createTestConsequence } from "../helpers/fixtures";
import { createMockContext, type MockContextOverrides } from "../helpers/mock-context";

function createMockDbForTagHandler(overrides: {
   deleteResult?: { tagId: string; transactionId: string }[];
   shouldThrow?: boolean;
   errorMessage?: string;
} = {}) {
   const { deleteResult = [], shouldThrow = false, errorMessage = "DB Error" } = overrides;

   if (shouldThrow) {
      return {
         delete: mock(() => ({
            where: mock(() => ({
               returning: mock(() => Promise.reject(new Error(errorMessage))),
            })),
         })),
      };
   }

   return {
      delete: mock(() => ({
         where: mock(() => ({
            returning: mock(() => Promise.resolve(deleteResult)),
         })),
      })),
   };
}

function createTagContext(
   dbOverrides: Parameters<typeof createMockDbForTagHandler>[0] = {},
   contextOverrides: Omit<MockContextOverrides, "db"> = {},
) {
   const db = createMockDbForTagHandler(dbOverrides);
   return createMockContext({ db: db as unknown as MockContextOverrides["db"], ...contextOverrides });
}

describe("removeTagHandler", () => {
   describe("execute", () => {
      it("should remove tags successfully", async () => {
         const consequence = createRemoveTagConsequence("tag-123");
         const context = createTagContext({
            deleteResult: [{ tagId: "tag-123", transactionId: "tx-123" }],
         });

         const result = await removeTagHandler.execute(consequence, context);

         expect(result.success).toBe(true);
         expect(result.type).toBe("remove_tag");
         expect((result.result as { removedCount: number }).removedCount).toBe(1);
         expect((result.result as { tagIds: string[] }).tagIds).toEqual(["tag-123"]);
      });

      it("should remove multiple tags", async () => {
         const consequence = createTestConsequence({
            type: "remove_tag",
            payload: { tagIds: ["tag-1", "tag-2", "tag-3"] },
         });
         const context = createTagContext({
            deleteResult: [
               { tagId: "tag-1", transactionId: "tx-123" },
               { tagId: "tag-2", transactionId: "tx-123" },
            ],
         });

         const result = await removeTagHandler.execute(consequence, context);

         expect(result.success).toBe(true);
         expect((result.result as { removedCount: number }).removedCount).toBe(2);
      });

      it("should succeed with zero removed tags", async () => {
         const consequence = createRemoveTagConsequence("tag-123");
         const context = createTagContext({ deleteResult: [] });

         const result = await removeTagHandler.execute(consequence, context);

         expect(result.success).toBe(true);
         expect((result.result as { removedCount: number }).removedCount).toBe(0);
      });

      it("should return skipped result when no tag IDs provided", async () => {
         const consequence = createTestConsequence({
            type: "remove_tag",
            payload: { tagIds: [] },
         });
         const context = createTagContext();

         const result = await removeTagHandler.execute(consequence, context);

         expect(result.success).toBe(true);
         expect(result.skipped).toBe(true);
         expect(result.skipReason).toBe("No tag IDs provided");
      });

      it("should return skipped result when tagIds is undefined", async () => {
         const consequence = createTestConsequence({
            type: "remove_tag",
            payload: {},
         });
         const context = createTagContext();

         const result = await removeTagHandler.execute(consequence, context);

         expect(result.success).toBe(true);
         expect(result.skipped).toBe(true);
      });

      it("should fail when no transaction ID in event data", async () => {
         const consequence = createRemoveTagConsequence("tag-123");
         const context = createTagContext({}, { eventData: { description: "No ID" } });

         const result = await removeTagHandler.execute(consequence, context);

         expect(result.success).toBe(false);
         expect(result.error).toBe("No transaction ID in event data");
      });

      it("should return dry run result without database changes", async () => {
         const consequence = createRemoveTagConsequence("tag-123");
         const context = createTagContext({}, { dryRun: true });

         const result = await removeTagHandler.execute(consequence, context);

         expect(result.success).toBe(true);
         expect((result.result as { dryRun: boolean }).dryRun).toBe(true);
         expect((result.result as { tagIds: string[] }).tagIds).toEqual(["tag-123"]);
         expect((result.result as { transactionId: string }).transactionId).toBe("tx-123");
      });

      it("should handle database errors gracefully", async () => {
         const consequence = createRemoveTagConsequence("tag-123");
         const context = createTagContext({ shouldThrow: true, errorMessage: "Connection failed" });

         const result = await removeTagHandler.execute(consequence, context);

         expect(result.success).toBe(false);
         expect(result.error).toBe("Connection failed");
      });
   });

   describe("validate", () => {
      it("should return valid when tagIds is provided", () => {
         const result = removeTagHandler.validate?.({ tagIds: ["tag-1"] });

         expect(result?.valid).toBe(true);
         expect(result?.errors).toEqual([]);
      });

      it("should return valid when multiple tagIds provided", () => {
         const result = removeTagHandler.validate?.({ tagIds: ["tag-1", "tag-2", "tag-3"] });

         expect(result?.valid).toBe(true);
         expect(result?.errors).toEqual([]);
      });

      it("should return invalid when tagIds is empty", () => {
         const result = removeTagHandler.validate?.({ tagIds: [] });

         expect(result?.valid).toBe(false);
         expect(result?.errors).toContain("At least one tag ID is required");
      });

      it("should return invalid when tagIds is undefined", () => {
         const result = removeTagHandler.validate?.({});

         expect(result?.valid).toBe(false);
         expect(result?.errors).toContain("At least one tag ID is required");
      });
   });
});
