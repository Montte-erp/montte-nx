import type { ConnectionOptions } from "bullmq";
import { Queue } from "bullmq";

export const BILL_RECURRENCE_QUEUE = "bill-recurrence";

export interface BillRecurrenceJobData {
   recurrenceGroupId: string;
   teamId: string;
}

export function createBillRecurrenceQueue(
   connection: ConnectionOptions,
): Queue<BillRecurrenceJobData> {
   return new Queue<BillRecurrenceJobData>(BILL_RECURRENCE_QUEUE, {
      connection,
      defaultJobOptions: {
         attempts: 3,
         backoff: { type: "exponential", delay: 30_000 },
         removeOnComplete: { count: 200 },
         removeOnFail: { count: 500 },
      },
   });
}
