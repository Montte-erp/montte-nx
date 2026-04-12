import { z } from "zod";

export const jobNotificationSchema = z.object({
   jobId: z.string(),
   type: z.string(),
   status: z.union([
      z.literal("started"),
      z.literal("completed"),
      z.literal("failed"),
   ]),
   message: z.string(),
   payload: z.record(z.string(), z.unknown()).optional(),
   teamId: z.string().uuid(),
   timestamp: z.string().datetime(),
});

export type JobNotification = z.infer<typeof jobNotificationSchema>;
