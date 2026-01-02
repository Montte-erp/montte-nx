import { describe, expect, it, mock } from "bun:test";
import { addTagHandler } from "../../src/actions/handlers/add-tag";
import { createAddTagConsequence, createTestConsequence } from "../helpers/fixtures";
import { createMockContext, type MockContextOverrides } from "../helpers/mock-context";

function createMockDbForTagHandler(overrides: {
   existingTags?: { tagId: string; transactionId: string }[];
   insertResult?: { tagId: string; transactionId: string }[];
   shouldThrow?: boolean;
   errorMessage?: string;
} = {}) {
   const { existingTags = [], insertResult = [], shouldThrow = false, errorMessage = "DB Error" } = overrides;

   if (shouldThrow) {
      return {
         select: mock(() => ({
            from: mock(() => ({
               where: mock(() => Promise.reject(new Error(errorMessage))),
            })),
         })),
         insert: mock(() => ({
            values: mock(() => ({
               returning: mock(() => Promise.reject(new Error(errorMessage))),
            })),
         })),
      };
   }

   return {
      select: mock(() => ({
         from: mock(() => ({
            where: mock(() => Promise.resolve(existingTags)),
         })),
      })),
      insert: mock(() => ({
         values: mock(() => ({
            returning: mock(() => Promise.resolve(insertResult)),
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

describe("addTagHandler", () => {
   describe("execute", () => {
      it("should add tags when none exist", async () => {
         const consequence = createAddTagConsequence("tag-123");
         const context = createTagContext({ existingTags: [] });

         const result = await addTagHandler.execute(consequence, context);

         expect(result.success).toBe(true);
         expect(result.type).toBe("add_tag");
         expect((result.result as { addedTagIds: string[] }).addedTagIds).toEqual(["tag-123"]);
         expect((result.result as { skippedTagIds: string[] }).skippedTagIds).toEqual([]);
      });

      it("should add multiple tags", async () => {
         const consequence = createTestConsequence({
            type: "add_tag",
            payload: { tagIds: ["tag-1", "tag-2", "tag-3"] },
         });
         const context = createTagContext({ existingTags: [] });

         const result = await addTagHandler.execute(consequence, context);

         expect(result.success).toBe(true);
         expect((result.result as { addedTagIds: string[] }).addedTagIds).toEqual(["tag-1", "tag-2", "tag-3"]);
      });

      it("should skip tags that already exist", async () => {
         const consequence = createTestConsequence({
            type: "add_tag",
            payload: { tagIds: ["tag-1", "tag-2", "tag-3"] },
         });
         const context = createTagContext({
            existingTags: [
               { tagId: "tag-1", transactionId: "tx-123" },
               { tagId: "tag-3", transactionId: "tx-123" },
            ],
         });

         const result = await addTagHandler.execute(consequence, context);

         expect(result.success).toBe(true);
         expect((result.result as { addedTagIds: string[] }).addedTagIds).toEqual(["tag-2"]);
         expect((result.result as { skippedTagIds: string[] }).skippedTagIds).toEqual(["tag-1", "tag-3"]);
      });

      it("should skip when all tags already exist", async () => {
         const consequence = createTestConsequence({
            type: "add_tag",
            payload: { tagIds: ["tag-1", "tag-2"] },
         });
         const context = createTagContext({
            existingTags: [
               { tagId: "tag-1", transactionId: "tx-123" },
               { tagId: "tag-2", transactionId: "tx-123" },
            ],
         });

         const result = await addTagHandler.execute(consequence, context);

         expect(result.success).toBe(true);
         expect((result.result as { addedTagIds: string[] }).addedTagIds).toEqual([]);
         expect((result.result as { skippedTagIds: string[] }).skippedTagIds).toEqual(["tag-1", "tag-2"]);
      });

      it("should return skipped result when no tag IDs provided", async () => {
         const consequence = createTestConsequence({
            type: "add_tag",
            payload: { tagIds: [] },
         });
         const context = createTagContext();

         const result = await addTagHandler.execute(consequence, context);

         expect(result.success).toBe(true);
         expect(result.skipped).toBe(true);
         expect(result.skipReason).toBe("No tag IDs provided");
      });

      it("should return skipped result when tagIds is undefined", async () => {
         const consequence = createTestConsequence({
            type: "add_tag",
            payload: {},
         });
         const context = createTagContext();

         const result = await addTagHandler.execute(consequence, context);

         expect(result.success).toBe(true);
         expect(result.skipped).toBe(true);
      });

      it("should fail when no transaction ID in event data", async () => {
         const consequence = createAddTagConsequence("tag-123");
         const context = createTagContext({}, { eventData: { description: "No ID" } });

         const result = await addTagHandler.execute(consequence, context);

         expect(result.success).toBe(false);
         expect(result.error).toBe("No transaction ID in event data");
      });

      it("should return dry run result without database changes", async () => {
         const consequence = createAddTagConsequence("tag-123");
         const context = createTagContext({}, { dryRun: true });

         const result = await addTagHandler.execute(consequence, context);

         expect(result.success).toBe(true);
         expect((result.result as { dryRun: boolean }).dryRun).toBe(true);
         expect((result.result as { tagIds: string[] }).tagIds).toEqual(["tag-123"]);
         expect((result.result as { transactionId: string }).transactionId).toBe("tx-123");
      });

      it("should handle database errors gracefully", async () => {
         const consequence = createAddTagConsequence("tag-123");
         const context = createTagContext({ shouldThrow: true, errorMessage: "Connection failed" });

         const result = await addTagHandler.execute(consequence, context);

         expect(result.success).toBe(false);
         expect(result.error).toBe("Connection failed");
      });
   });

   describe("validate", () => {
      it("should return valid when tagIds is provided", () => {
         const result = addTagHandler.validate?.({ tagIds: ["tag-1"] });

         expect(result?.valid).toBe(true);
         expect(result?.errors).toEqual([]);
      });

      it("should return valid when multiple tagIds provided", () => {
         const result = addTagHandler.validate?.({ tagIds: ["tag-1", "tag-2", "tag-3"] });

         expect(result?.valid).toBe(true);
         expect(result?.errors).toEqual([]);
      });

      it("should return invalid when tagIds is empty", () => {
         const result = addTagHandler.validate?.({ tagIds: [] });

         expect(result?.valid).toBe(false);
         expect(result?.errors).toContain("At least one tag ID is required");
      });

      it("should return invalid when tagIds is undefined", () => {
         const result = addTagHandler.validate?.({});

         expect(result?.valid).toBe(false);
         expect(result?.errors).toContain("At least one tag ID is required");
      });
   });
});
