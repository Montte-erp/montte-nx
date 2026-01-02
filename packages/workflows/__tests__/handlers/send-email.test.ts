import { describe, expect, it, mock } from "bun:test";
import { sendEmailHandler } from "../../src/actions/handlers/send-email";
import { createSendEmailConsequence, createTestConsequence, testOrganizationMembers } from "../helpers/fixtures";
import { createMockContext, createContextWithoutResend, type MockContextOverrides } from "../helpers/mock-context";
import type { ConsequenceExecutionResult } from "../../src/types/actions";

const mockBillsData = {
   bills: [
      {
         description: "Electricity Bill",
         amount: "150.00",
         dueDate: "2024-01-15",
         type: "expense" as const,
         isOverdue: false,
      },
   ],
   summary: {
      totalExpenseAmount: "150.00",
      totalIncomeAmount: "0.00",
      totalPending: 1,
      totalOverdue: 0,
   },
   period: "Janeiro 2024",
   organizationName: "Test Org",
   dashboardUrl: "https://app.example.com/bills",
};

function createMockPreviousResults(data = mockBillsData): ConsequenceExecutionResult[] {
   return [
      {
         type: "fetch_bills_report",
         success: true,
         outputData: data,
         consequenceIndex: 0,
      },
   ];
}

describe("sendEmailHandler", () => {
   describe("execute - custom email mode", () => {
      it("should return dry run result for custom email", async () => {
         const consequence = createSendEmailConsequence({
            to: "custom",
            customEmail: "test@example.com",
            subject: "Test Subject",
            body: "<p>Test Body</p>",
         });
         const context = createMockContext({ dryRun: true });

         const result = await sendEmailHandler.execute(consequence, context);

         expect(result.success).toBe(true);
         expect((result.result as { dryRun: boolean }).dryRun).toBe(true);
         expect((result.result as { to: string }).to).toBe("test@example.com");
         expect((result.result as { subject: string }).subject).toBe("Test Subject");
         expect((result.result as { body: string }).body).toBe("<p>Test Body</p>");
      });

      it("should process template variables", async () => {
         const consequence = createSendEmailConsequence({
            to: "custom",
            customEmail: "test@example.com",
            subject: "Transaction: {{description}}",
            body: "<p>Amount: {{amount}}</p>",
         });
         const context = createMockContext({ dryRun: true });

         const result = await sendEmailHandler.execute(consequence, context);

         expect(result.success).toBe(true);
         expect((result.result as { subject: string }).subject).toBe("Transaction: Test transaction");
         expect((result.result as { body: string }).body).toBe("<p>Amount: 100.5</p>");
      });

      it("should skip when subject is missing (custom recipient)", async () => {
         const consequence = createTestConsequence({
            type: "send_email",
            payload: {
               to: "custom",
               customEmail: "test@example.com",
               body: "<p>Test</p>",
            },
         });
         const context = createMockContext();

         const result = await sendEmailHandler.execute(consequence, context);

         expect(result.success).toBe(true);
         expect(result.skipped).toBe(true);
         expect(result.skipReason).toContain("Subject and body");
      });

      it("should skip when body is missing (custom recipient)", async () => {
         const consequence = createTestConsequence({
            type: "send_email",
            payload: {
               to: "custom",
               customEmail: "test@example.com",
               subject: "Test",
            },
         });
         const context = createMockContext();

         const result = await sendEmailHandler.execute(consequence, context);

         expect(result.success).toBe(true);
         expect(result.skipped).toBe(true);
      });

      it("should fail when resend client is not configured (custom recipient)", async () => {
         const consequence = createSendEmailConsequence({
            to: "custom",
            customEmail: "test@example.com",
            subject: "Test",
            body: "<p>Test</p>",
         });
         const context = createContextWithoutResend();

         const result = await sendEmailHandler.execute(consequence, context);

         expect(result.success).toBe(false);
         expect(result.error).toContain("Email client not configured");
      });

      it("should include attachment info from previous action", async () => {
         const consequence = createSendEmailConsequence({
            to: "custom",
            customEmail: "test@example.com",
            subject: "Report",
            body: "<p>See attached</p>",
            includeAttachment: true,
         });
         const context = createMockContext({ dryRun: true });
         context.previousResults = [
            {
               type: "format_data",
               success: true,
               outputData: {
                  attachment: {
                     filename: "report.csv",
                     content: "base64content",
                     contentType: "text/csv",
                  },
               },
               consequenceIndex: 0,
            },
         ];

         const result = await sendEmailHandler.execute(consequence, context);

         expect(result.success).toBe(true);
         expect((result.result as { attachment: { filename: string } }).attachment.filename).toBe("report.csv");
      });
   });

   describe("execute - bills_digest template mode", () => {
      it("should return dry run result for bills digest (custom recipient)", async () => {
         const consequence = createTestConsequence({
            type: "send_email",
            payload: {
               to: "custom",
               customEmail: "test@example.com",
               useTemplate: "bills_digest",
            },
         });
         const context = createMockContext({ dryRun: true });
         context.previousResults = createMockPreviousResults();

         const result = await sendEmailHandler.execute(consequence, context);

         expect(result.success).toBe(true);
         expect((result.result as { dryRun: boolean }).dryRun).toBe(true);
         expect((result.result as { useTemplate: string }).useTemplate).toBe("bills_digest");
         expect((result.result as { billsCount: number }).billsCount).toBe(1);
      });

      it("should skip when no bills data for bills_digest (custom recipient)", async () => {
         const consequence = createTestConsequence({
            type: "send_email",
            payload: {
               to: "custom",
               customEmail: "test@example.com",
               useTemplate: "bills_digest",
            },
         });
         const context = createMockContext();
         context.previousResults = [];

         const result = await sendEmailHandler.execute(consequence, context);

         expect(result.success).toBe(true);
         expect(result.skipped).toBe(true);
         expect(result.skipReason).toContain("No bills data");
      });

      it("should skip when bills array is empty for bills_digest (custom recipient)", async () => {
         const consequence = createTestConsequence({
            type: "send_email",
            payload: {
               to: "custom",
               customEmail: "test@example.com",
               useTemplate: "bills_digest",
            },
         });
         const context = createMockContext();
         context.previousResults = createMockPreviousResults({ ...mockBillsData, bills: [] });

         const result = await sendEmailHandler.execute(consequence, context);

         expect(result.success).toBe(true);
         expect(result.skipped).toBe(true);
      });

      it("should fail when resend client is not configured for bills_digest (custom recipient)", async () => {
         const consequence = createTestConsequence({
            type: "send_email",
            payload: {
               to: "custom",
               customEmail: "test@example.com",
               useTemplate: "bills_digest",
            },
         });
         const context = createContextWithoutResend();
         context.previousResults = createMockPreviousResults();

         const result = await sendEmailHandler.execute(consequence, context);

         expect(result.success).toBe(false);
         expect(result.error).toContain("Email client not configured");
      });
   });

   describe("validate", () => {
      it("should return valid for bills_digest template", () => {
         const result = sendEmailHandler.validate?.({ useTemplate: "bills_digest" });

         expect(result?.valid).toBe(true);
         expect(result?.errors).toEqual([]);
      });

      it("should return valid for complete custom email config", () => {
         const result = sendEmailHandler.validate?.({
            to: "owner",
            subject: "Test",
            body: "<p>Test</p>",
         });

         expect(result?.valid).toBe(true);
      });

      it("should return invalid when subject is missing", () => {
         const result = sendEmailHandler.validate?.({
            to: "owner",
            body: "<p>Test</p>",
         });

         expect(result?.valid).toBe(false);
         expect(result?.errors).toContain("Subject is required");
      });

      it("should return invalid when body is missing", () => {
         const result = sendEmailHandler.validate?.({
            to: "owner",
            subject: "Test",
         });

         expect(result?.valid).toBe(false);
         expect(result?.errors).toContain("Body is required");
      });

      it("should return invalid when custom email is missing for custom recipient", () => {
         const result = sendEmailHandler.validate?.({
            to: "custom",
            subject: "Test",
            body: "<p>Test</p>",
         });

         expect(result?.valid).toBe(false);
         expect(result?.errors).toContain("Custom email is required when recipient is set to custom");
      });

      it("should return valid when custom email is provided for custom recipient", () => {
         const result = sendEmailHandler.validate?.({
            to: "custom",
            customEmail: "test@example.com",
            subject: "Test",
            body: "<p>Test</p>",
         });

         expect(result?.valid).toBe(true);
      });
   });
});
