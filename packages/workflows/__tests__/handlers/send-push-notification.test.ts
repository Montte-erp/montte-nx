import { describe, expect, it, mock, beforeEach } from "bun:test";
import { sendPushNotificationHandler } from "../../src/actions/handlers/send-push-notification";
import { createSendPushNotificationConsequence, createTestConsequence, testOrganizationMembers } from "../helpers/fixtures";
import { createMockContext, createMockVapidConfig, createContextWithoutVapid, type MockContextOverrides } from "../helpers/mock-context";

// Mock the external dependencies
const mockGetOrganizationMembers = mock(() => Promise.resolve(testOrganizationMembers));
const mockSendPushNotificationToUser = mock(() => Promise.resolve({ success: true, sent: 1, failed: 0, errors: [] }));

// Create a mock db that supports the getOrganizationMembers pattern
function createMockDbForPush(overrides: {
   members?: typeof testOrganizationMembers;
   shouldThrow?: boolean;
   errorMessage?: string;
} = {}) {
   const { members = testOrganizationMembers, shouldThrow = false, errorMessage = "DB Error" } = overrides;

   if (shouldThrow) {
      return {
         select: mock(() => ({
            from: mock(() => ({
               where: mock(() => Promise.reject(new Error(errorMessage))),
               leftJoin: mock(() => ({
                  where: mock(() => Promise.reject(new Error(errorMessage))),
               })),
            })),
         })),
         query: {
            member: {
               findMany: mock(() => Promise.reject(new Error(errorMessage))),
            },
         },
      };
   }

   return {
      select: mock(() => ({
         from: mock(() => ({
            where: mock(() => Promise.resolve(members)),
            leftJoin: mock(() => ({
               where: mock(() => Promise.resolve(members)),
            })),
         })),
      })),
      query: {
         member: {
            findMany: mock(() => Promise.resolve(members)),
         },
      },
   };
}

beforeEach(() => {
   mockGetOrganizationMembers.mockReset();
   mockSendPushNotificationToUser.mockReset();

   mockGetOrganizationMembers.mockImplementation(() => Promise.resolve(testOrganizationMembers));
   mockSendPushNotificationToUser.mockImplementation(() => Promise.resolve({ success: true, sent: 1, failed: 0, errors: [] }));
});

describe("sendPushNotificationHandler", () => {
   describe("execute - validation cases", () => {
      it("should skip when title is missing", async () => {
         const consequence = createTestConsequence({
            type: "send_push_notification",
            payload: { body: "Test body" },
         });
         const context = createMockContext();

         const result = await sendPushNotificationHandler.execute(consequence, context);

         expect(result.success).toBe(true);
         expect(result.skipped).toBe(true);
         expect(result.skipReason).toContain("Title and body");
      });

      it("should skip when body is missing", async () => {
         const consequence = createTestConsequence({
            type: "send_push_notification",
            payload: { title: "Test title" },
         });
         const context = createMockContext();

         const result = await sendPushNotificationHandler.execute(consequence, context);

         expect(result.success).toBe(true);
         expect(result.skipped).toBe(true);
         expect(result.skipReason).toContain("Title and body");
      });

      it("should skip when both title and body are missing", async () => {
         const consequence = createTestConsequence({
            type: "send_push_notification",
            payload: {},
         });
         const context = createMockContext();

         const result = await sendPushNotificationHandler.execute(consequence, context);

         expect(result.success).toBe(true);
         expect(result.skipped).toBe(true);
      });

      it("should return dry run result", async () => {
         const consequence = createSendPushNotificationConsequence({
            title: "Test Title",
            body: "Test Body",
            url: "/transactions/123",
         });
         const context = createMockContext({ dryRun: true });

         const result = await sendPushNotificationHandler.execute(consequence, context);

         expect(result.success).toBe(true);
         expect((result.result as { dryRun: boolean }).dryRun).toBe(true);
         expect((result.result as { title: string }).title).toBe("Test Title");
         expect((result.result as { body: string }).body).toBe("Test Body");
         expect((result.result as { url: string }).url).toBe("/transactions/123");
      });

      it("should process template variables in title", async () => {
         const consequence = createSendPushNotificationConsequence({
            title: "Transaction: {{description}}",
            body: "Amount: {{amount}}",
         });
         const context = createMockContext({ dryRun: true });

         const result = await sendPushNotificationHandler.execute(consequence, context);

         expect(result.success).toBe(true);
         expect((result.result as { title: string }).title).toBe("Transaction: Test transaction");
         expect((result.result as { body: string }).body).toBe("Amount: 100.5");
      });

      it("should process template variables in URL", async () => {
         const consequence = createSendPushNotificationConsequence({
            title: "Test",
            body: "Test",
            url: "/transactions/{{id}}",
         });
         const context = createMockContext({ dryRun: true });

         const result = await sendPushNotificationHandler.execute(consequence, context);

         expect(result.success).toBe(true);
         expect((result.result as { url: string }).url).toBe("/transactions/tx-123");
      });

      it("should fail when vapidConfig is not provided", async () => {
         const consequence = createSendPushNotificationConsequence();
         const context = createContextWithoutVapid();

         const result = await sendPushNotificationHandler.execute(consequence, context);

         expect(result.success).toBe(false);
         expect(result.error).toContain("not configured");
      });
   });

   describe("validate", () => {
      it("should return valid when title and body are provided", () => {
         const result = sendPushNotificationHandler.validate?.({
            title: "Test Title",
            body: "Test Body",
         });

         expect(result?.valid).toBe(true);
         expect(result?.errors).toEqual([]);
      });

      it("should return valid with optional url", () => {
         const result = sendPushNotificationHandler.validate?.({
            title: "Test Title",
            body: "Test Body",
            url: "/test",
         });

         expect(result?.valid).toBe(true);
      });

      it("should return invalid when title is missing", () => {
         const result = sendPushNotificationHandler.validate?.({
            body: "Test Body",
         });

         expect(result?.valid).toBe(false);
         expect(result?.errors).toContain("Title is required");
      });

      it("should return invalid when body is missing", () => {
         const result = sendPushNotificationHandler.validate?.({
            title: "Test Title",
         });

         expect(result?.valid).toBe(false);
         expect(result?.errors).toContain("Body is required");
      });

      it("should return invalid when both are missing", () => {
         const result = sendPushNotificationHandler.validate?.({});

         expect(result?.valid).toBe(false);
         expect(result?.errors).toContain("Title is required");
         expect(result?.errors).toContain("Body is required");
      });

      it("should return invalid when title is empty string", () => {
         const result = sendPushNotificationHandler.validate?.({
            title: "",
            body: "Test Body",
         });

         expect(result?.valid).toBe(false);
      });

      it("should return invalid when body is empty string", () => {
         const result = sendPushNotificationHandler.validate?.({
            title: "Test Title",
            body: "",
         });

         expect(result?.valid).toBe(false);
      });
   });
});
