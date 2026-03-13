import { z } from "zod";
export declare const bugReportSchema: z.ZodObject<
   {
      type: z.ZodLiteral<"bug_report">;
      description: z.ZodString;
      severity: z.ZodOptional<z.ZodString>;
   },
   z.core.$strip
>;
export declare const featureRequestSchema: z.ZodObject<
   {
      type: z.ZodLiteral<"feature_request">;
      feature: z.ZodString;
      problem: z.ZodOptional<z.ZodString>;
      priority: z.ZodNumber;
   },
   z.core.$strip
>;
export declare const featureFeedbackSchema: z.ZodObject<
   {
      type: z.ZodLiteral<"feature_feedback">;
      featureName: z.ZodString;
      rating: z.ZodNumber;
      improvement: z.ZodOptional<z.ZodString>;
   },
   z.core.$strip
>;
export declare const feedbackPayloadSchema: z.ZodDiscriminatedUnion<
   [
      z.ZodObject<
         {
            type: z.ZodLiteral<"bug_report">;
            description: z.ZodString;
            severity: z.ZodOptional<z.ZodString>;
         },
         z.core.$strip
      >,
      z.ZodObject<
         {
            type: z.ZodLiteral<"feature_request">;
            feature: z.ZodString;
            problem: z.ZodOptional<z.ZodString>;
            priority: z.ZodNumber;
         },
         z.core.$strip
      >,
      z.ZodObject<
         {
            type: z.ZodLiteral<"feature_feedback">;
            featureName: z.ZodString;
            rating: z.ZodNumber;
            improvement: z.ZodOptional<z.ZodString>;
         },
         z.core.$strip
      >,
   ],
   "type"
>;
export type BugReport = z.infer<typeof bugReportSchema>;
export type FeatureRequest = z.infer<typeof featureRequestSchema>;
export type FeatureFeedback = z.infer<typeof featureFeedbackSchema>;
export type FeedbackPayload = z.infer<typeof feedbackPayloadSchema>;
export type FeedbackMessage = {
   payload: FeedbackPayload;
   userId: string;
};
export type FeedbackAdapter = {
   name: string;
   send: (message: FeedbackMessage) => Promise<void>;
};
//# sourceMappingURL=schemas.d.ts.map
