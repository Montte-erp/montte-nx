import { describe, expect, it, mock } from "bun:test";
import { setCostCenterHandler } from "../../src/actions/handlers/set-cost-center";
import { createSetCostCenterConsequence, createTestConsequence } from "../helpers/fixtures";
import { createMockContext, type MockContextOverrides } from "../helpers/mock-context";

function createMockDbForCostCenter(overrides: {
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

function createCostCenterContext(
   dbOverrides: Parameters<typeof createMockDbForCostCenter>[0] = {},
   contextOverrides: Omit<MockContextOverrides, "db"> = {},
) {
   const db = createMockDbForCostCenter(dbOverrides);
   return createMockContext({ db: db as unknown as MockContextOverrides["db"], ...contextOverrides });
}

describe("setCostCenterHandler", () => {
   describe("execute", () => {
      it("should set cost center successfully", async () => {
         const consequence = createSetCostCenterConsequence("cost-123");
         const context = createCostCenterContext();

         const result = await setCostCenterHandler.execute(consequence, context);

         expect(result.success).toBe(true);
         expect(result.type).toBe("set_cost_center");
         expect((result.result as { costCenterId: string }).costCenterId).toBe("cost-123");
         expect((result.result as { transactionId: string }).transactionId).toBe("tx-123");
      });

      it("should return skipped result when no cost center ID provided", async () => {
         const consequence = createTestConsequence({
            type: "set_cost_center",
            payload: {},
         });
         const context = createCostCenterContext();

         const result = await setCostCenterHandler.execute(consequence, context);

         expect(result.success).toBe(true);
         expect(result.skipped).toBe(true);
         expect(result.skipReason).toBe("No cost center ID provided");
      });

      it("should fail when no transaction ID in event data", async () => {
         const consequence = createSetCostCenterConsequence("cost-123");
         const context = createCostCenterContext({}, { eventData: { description: "No ID" } });

         const result = await setCostCenterHandler.execute(consequence, context);

         expect(result.success).toBe(false);
         expect(result.error).toBe("No transaction ID in event data");
      });

      it("should return dry run result without database changes", async () => {
         const consequence = createSetCostCenterConsequence("cost-123");
         const context = createCostCenterContext({}, { dryRun: true });

         const result = await setCostCenterHandler.execute(consequence, context);

         expect(result.success).toBe(true);
         expect((result.result as { dryRun: boolean }).dryRun).toBe(true);
         expect((result.result as { costCenterId: string }).costCenterId).toBe("cost-123");
         expect((result.result as { transactionId: string }).transactionId).toBe("tx-123");
      });

      it("should fail when transaction not found", async () => {
         const consequence = createSetCostCenterConsequence("cost-123");
         const context = createCostCenterContext({ updateResult: [] });

         const result = await setCostCenterHandler.execute(consequence, context);

         expect(result.success).toBe(false);
         expect(result.error).toBe("Transconsequence not found");
      });

      it("should handle database errors gracefully", async () => {
         const consequence = createSetCostCenterConsequence("cost-123");
         const context = createCostCenterContext({ shouldThrow: true, errorMessage: "Connection failed" });

         const result = await setCostCenterHandler.execute(consequence, context);

         expect(result.success).toBe(false);
         expect(result.error).toBe("Connection failed");
      });
   });

   describe("validate", () => {
      it("should return valid when costCenterId is provided", () => {
         const result = setCostCenterHandler.validate?.({ costCenterId: "cost-123" });

         expect(result?.valid).toBe(true);
         expect(result?.errors).toEqual([]);
      });

      it("should return invalid when costCenterId is missing", () => {
         const result = setCostCenterHandler.validate?.({});

         expect(result?.valid).toBe(false);
         expect(result?.errors).toContain("Cost center ID is required");
      });

      it("should return invalid when costCenterId is empty string", () => {
         const result = setCostCenterHandler.validate?.({ costCenterId: "" });

         expect(result?.valid).toBe(false);
         expect(result?.errors).toContain("Cost center ID is required");
      });
   });
});
