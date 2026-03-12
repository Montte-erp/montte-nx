import {
   bugReportSchema,
   featureFeedbackSchema,
   featureRequestSchema,
} from "@packages/feedback/schemas";
import { feedbackSender } from "@packages/feedback/sender";
import { authenticatedProcedure } from "../server";

export const submitBugReport = authenticatedProcedure
   .input(bugReportSchema.omit({ type: true }))
   .handler(async ({ context, input }) => {
      await feedbackSender.send({
         userId: context.userId,
         payload: { type: "bug_report", ...input },
      });
      return { success: true };
   });

export const submitFeatureRequest = authenticatedProcedure
   .input(featureRequestSchema.omit({ type: true }))
   .handler(async ({ context, input }) => {
      await feedbackSender.send({
         userId: context.userId,
         payload: { type: "feature_request", ...input },
      });
      return { success: true };
   });

export const submitFeatureFeedback = authenticatedProcedure
   .input(featureFeedbackSchema.omit({ type: true }))
   .handler(async ({ context, input }) => {
      await feedbackSender.send({
         userId: context.userId,
         payload: { type: "feature_feedback", ...input },
      });
      return { success: true };
   });
