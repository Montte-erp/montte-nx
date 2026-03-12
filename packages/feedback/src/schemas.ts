import { z } from "zod";

export const bugReportSchema = z.object({
   type: z.literal("bug_report"),
   description: z.string().min(1),
   severity: z.string().optional(),
});

export const featureRequestSchema = z.object({
   type: z.literal("feature_request"),
   feature: z.string().min(1),
   problem: z.string().optional(),
   priority: z.number().min(0).max(5),
});

export const featureFeedbackSchema = z.object({
   type: z.literal("feature_feedback"),
   featureName: z.string().min(1),
   rating: z.number().min(1).max(5),
   improvement: z.string().optional(),
});

export const feedbackPayloadSchema = z.discriminatedUnion("type", [
   bugReportSchema,
   featureRequestSchema,
   featureFeedbackSchema,
]);

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
