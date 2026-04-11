import { z } from "zod";

export const jobNotificationSchema = z.object({
   jobId: z.string(),
   type: z.string(),
   status: z.union([z.literal("completed"), z.literal("failed")]),
   payload: z.record(z.string(), z.unknown()).optional(),
   error: z.string().optional(),
   teamId: z.string().uuid(),
   timestamp: z.string().datetime(),
});

export type JobNotification = z.infer<typeof jobNotificationSchema>;
