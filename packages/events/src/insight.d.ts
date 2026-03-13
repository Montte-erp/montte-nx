import { z } from "zod";
import { type EmitFn } from "./catalog";
export declare const INSIGHT_EVENTS: {
   readonly "insight.created": "insight.created";
   readonly "insight.updated": "insight.updated";
   readonly "insight.deleted": "insight.deleted";
};
export type InsightEventName =
   (typeof INSIGHT_EVENTS)[keyof typeof INSIGHT_EVENTS];
export declare const INSIGHT_PRICING: Record<string, string>;
export declare const insightCreatedEventSchema: z.ZodObject<
   {
      insightId: z.ZodString;
      name: z.ZodString;
   },
   z.core.$strip
>;
export type InsightCreatedEvent = z.infer<typeof insightCreatedEventSchema>;
export declare function emitInsightCreated(
   emit: EmitFn,
   ctx: {
      organizationId: string;
      userId?: string;
      teamId?: string;
   },
   properties: InsightCreatedEvent,
): Promise<void>;
export declare const insightUpdatedEventSchema: z.ZodObject<
   {
      insightId: z.ZodString;
      changedFields: z.ZodArray<z.ZodString>;
   },
   z.core.$strip
>;
export type InsightUpdatedEvent = z.infer<typeof insightUpdatedEventSchema>;
export declare function emitInsightUpdated(
   emit: EmitFn,
   ctx: {
      organizationId: string;
      userId?: string;
      teamId?: string;
   },
   properties: InsightUpdatedEvent,
): Promise<void>;
export declare const insightDeletedEventSchema: z.ZodObject<
   {
      insightId: z.ZodString;
   },
   z.core.$strip
>;
export type InsightDeletedEvent = z.infer<typeof insightDeletedEventSchema>;
export declare function emitInsightDeleted(
   emit: EmitFn,
   ctx: {
      organizationId: string;
      userId?: string;
      teamId?: string;
   },
   properties: InsightDeletedEvent,
): Promise<void>;
//# sourceMappingURL=insight.d.ts.map
