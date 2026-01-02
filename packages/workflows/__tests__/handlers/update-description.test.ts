import { describe, expect, it, mock } from "bun:test";
import { updateDescriptionHandler } from "../../src/actions/handlers/update-description";
import { createUpdateDescriptionConsequence, createTestConsequence } from "../helpers/fixtures";
import { createMockContext, type MockContextOverrides } from "../helpers/mock-context";

function createMockDbForUpdateDescription(overrides: {
   updateResult?: Record<string, unknown>[];
   shouldThrow?: boolean;
   errorMessage?: string;
} = {}) {
   const { updateResult = [{ id: "tx-123" }], shouldThrow = false, errorMessage = "DB Error" } = overrides;

   if (shouldThrow) {
      return {
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
      update: mock(() => ({
         set: mock(() => ({
            where: mock(() => ({
               returning: mock(() => Promise.resolve(updateResult)),
            })),
         })),
      })),
   };
}

function createDescriptionContext(
   dbOverrides: Parameters<typeof createMockDbForUpdateDescription>[0] = {},
   contextOverrides: Omit<MockContextOverrides, "db"> = {},
) {
   const db = createMockDbForUpdateDescription(dbOverrides);
   return createMockContext({ db: db as unknown as MockContextOverrides["db"], ...contextOverrides });
}

describe("updateDescriptionHandler", () => {
   describe("execute", () => {
      it("should update description in replace mode", async () => {
         const consequence = createTestConsequence({
            type: "update_description",
            payload: { value: "New description", mode: "replace", template: false },
         });
         const context = createDescriptionContext();

         const result = await updateDescriptionHandler.execute(consequence, context);

         expect(result.success).toBe(true);
         expect(result.type).toBe("update_description");
         expect((result.result as { newDescription: string }).newDescription).toBe("New description");
         expect((result.result as { originalDescription: string }).originalDescription).toBe("Test transaction");
      });

      it("should append to description", async () => {
         const consequence = createTestConsequence({
            type: "update_description",
            payload: { value: " - PROCESSED", mode: "append", template: false },
         });
         const context = createDescriptionContext();

         const result = await updateDescriptionHandler.execute(consequence, context);

         expect(result.success).toBe(true);
         expect((result.result as { newDescription: string }).newDescription).toBe("Test transaction - PROCESSED");
      });

      it("should prepend to description", async () => {
         const consequence = createTestConsequence({
            type: "update_description",
            payload: { value: "[URGENT] ", mode: "prepend", template: false },
         });
         const context = createDescriptionContext();

         const result = await updateDescriptionHandler.execute(consequence, context);

         expect(result.success).toBe(true);
         expect((result.result as { newDescription: string }).newDescription).toBe("[URGENT] Test transaction");
      });

      it("should use replace mode by default", async () => {
         const consequence = createTestConsequence({
            type: "update_description",
            payload: { value: "Default mode test", template: false },
         });
         const context = createDescriptionContext();

         const result = await updateDescriptionHandler.execute(consequence, context);

         expect(result.success).toBe(true);
         expect((result.result as { newDescription: string }).newDescription).toBe("Default mode test");
      });

      it("should process templates when template is true", async () => {
         const consequence = createUpdateDescriptionConsequence("Updated: {{description}}");
         const context = createDescriptionContext();

         const result = await updateDescriptionHandler.execute(consequence, context);

         expect(result.success).toBe(true);
         expect((result.result as { newDescription: string }).newDescription).toBe("Updated: Test transaction");
      });

      it("should process amount template variable", async () => {
         const consequence = createTestConsequence({
            type: "update_description",
            payload: { value: "Amount: {{amount}}", mode: "replace", template: true },
         });
         const context = createDescriptionContext();

         const result = await updateDescriptionHandler.execute(consequence, context);

         expect(result.success).toBe(true);
         expect((result.result as { newDescription: string }).newDescription).toBe("Amount: 100.5");
      });

      it("should not process templates when template is false", async () => {
         const consequence = createTestConsequence({
            type: "update_description",
            payload: { value: "Literal: {{description}}", mode: "replace", template: false },
         });
         const context = createDescriptionContext();

         const result = await updateDescriptionHandler.execute(consequence, context);

         expect(result.success).toBe(true);
         expect((result.result as { newDescription: string }).newDescription).toBe("Literal: {{description}}");
      });

      it("should return skipped result when no value provided", async () => {
         const consequence = createTestConsequence({
            type: "update_description",
            payload: {},
         });
         const context = createDescriptionContext();

         const result = await updateDescriptionHandler.execute(consequence, context);

         expect(result.success).toBe(true);
         expect(result.skipped).toBe(true);
         expect(result.skipReason).toBe("No value provided");
      });

      it("should fail when no transaction ID in event data", async () => {
         const consequence = createUpdateDescriptionConsequence("Test");
         const context = createDescriptionContext({}, { eventData: { description: "No ID" } });

         const result = await updateDescriptionHandler.execute(consequence, context);

         expect(result.success).toBe(false);
         expect(result.error).toBe("No transaction ID in event data");
      });

      it("should return dry run result without database changes", async () => {
         const consequence = createTestConsequence({
            type: "update_description",
            payload: { value: "Dry run test", mode: "replace", template: false },
         });
         const context = createDescriptionContext({}, { dryRun: true });

         const result = await updateDescriptionHandler.execute(consequence, context);

         expect(result.success).toBe(true);
         expect((result.result as { dryRun: boolean }).dryRun).toBe(true);
         expect((result.result as { newDescription: string }).newDescription).toBe("Dry run test");
      });

      it("should fail when transaction not found", async () => {
         const consequence = createTestConsequence({
            type: "update_description",
            payload: { value: "Test", mode: "replace", template: false },
         });
         const context = createDescriptionContext({ updateResult: [] });

         const result = await updateDescriptionHandler.execute(consequence, context);

         expect(result.success).toBe(false);
         expect(result.error).toBe("Transconsequence not found");
      });

      it("should handle database errors gracefully", async () => {
         const consequence = createTestConsequence({
            type: "update_description",
            payload: { value: "Test", mode: "replace", template: false },
         });
         const context = createDescriptionContext({ shouldThrow: true, errorMessage: "Connection failed" });

         const result = await updateDescriptionHandler.execute(consequence, context);

         expect(result.success).toBe(false);
         expect(result.error).toBe("Connection failed");
      });

      it("should handle empty original description", async () => {
         const consequence = createTestConsequence({
            type: "update_description",
            payload: { value: " suffix", mode: "append", template: false },
         });
         const context = createDescriptionContext({}, { eventData: { id: "tx-123", description: "" } });

         const result = await updateDescriptionHandler.execute(consequence, context);

         expect(result.success).toBe(true);
         expect((result.result as { newDescription: string }).newDescription).toBe(" suffix");
      });

      it("should handle null original description", async () => {
         const consequence = createTestConsequence({
            type: "update_description",
            payload: { value: " suffix", mode: "append", template: false },
         });
         const context = createDescriptionContext({}, { eventData: { id: "tx-123" } });

         const result = await updateDescriptionHandler.execute(consequence, context);

         expect(result.success).toBe(true);
         expect((result.result as { newDescription: string }).newDescription).toBe(" suffix");
         expect((result.result as { originalDescription: string }).originalDescription).toBe("");
      });
   });

   describe("validate", () => {
      it("should return valid when value is provided", () => {
         const result = updateDescriptionHandler.validate?.({ value: "Test" });

         expect(result?.valid).toBe(true);
         expect(result?.errors).toEqual([]);
      });

      it("should return valid for all valid modes", () => {
         const modes = ["replace", "append", "prepend"] as const;
         for (const mode of modes) {
            const result = updateDescriptionHandler.validate?.({ value: "Test", mode });
            expect(result?.valid).toBe(true);
         }
      });

      it("should return invalid when value is missing", () => {
         const result = updateDescriptionHandler.validate?.({});

         expect(result?.valid).toBe(false);
         expect(result?.errors).toContain("Value is required");
      });

      it("should return invalid when value is empty string", () => {
         const result = updateDescriptionHandler.validate?.({ value: "" });

         expect(result?.valid).toBe(false);
         expect(result?.errors).toContain("Value is required");
      });

      it("should return invalid for unknown mode", () => {
         // biome-ignore lint/suspicious/noExplicitAny: Testing invalid input type
         const result = updateDescriptionHandler.validate?.({ value: "Test", mode: "invalid" as any });

         expect(result?.valid).toBe(false);
         expect(result?.errors).toContain("Mode must be replace, append, or prepend");
      });
   });
});
