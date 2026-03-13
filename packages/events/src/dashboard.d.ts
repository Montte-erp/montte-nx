import { z } from "zod";
import { type EmitFn } from "./catalog";
export declare const DASHBOARD_EVENTS: {
   readonly "dashboard.created": "dashboard.created";
   readonly "dashboard.updated": "dashboard.updated";
   readonly "dashboard.deleted": "dashboard.deleted";
};
export type DashboardEventName =
   (typeof DASHBOARD_EVENTS)[keyof typeof DASHBOARD_EVENTS];
export declare const DASHBOARD_PRICING: Record<string, string>;
export declare const dashboardCreatedEventSchema: z.ZodObject<
   {
      dashboardId: z.ZodString;
      name: z.ZodString;
   },
   z.core.$strip
>;
export type DashboardCreatedEvent = z.infer<typeof dashboardCreatedEventSchema>;
export declare function emitDashboardCreated(
   emit: EmitFn,
   ctx: {
      organizationId: string;
      userId?: string;
      teamId?: string;
   },
   properties: DashboardCreatedEvent,
): Promise<void>;
export declare const dashboardUpdatedEventSchema: z.ZodObject<
   {
      dashboardId: z.ZodString;
      changedFields: z.ZodArray<z.ZodString>;
   },
   z.core.$strip
>;
export type DashboardUpdatedEvent = z.infer<typeof dashboardUpdatedEventSchema>;
export declare function emitDashboardUpdated(
   emit: EmitFn,
   ctx: {
      organizationId: string;
      userId?: string;
      teamId?: string;
   },
   properties: DashboardUpdatedEvent,
): Promise<void>;
export declare const dashboardDeletedEventSchema: z.ZodObject<
   {
      dashboardId: z.ZodString;
   },
   z.core.$strip
>;
export type DashboardDeletedEvent = z.infer<typeof dashboardDeletedEventSchema>;
export declare function emitDashboardDeleted(
   emit: EmitFn,
   ctx: {
      organizationId: string;
      userId?: string;
      teamId?: string;
   },
   properties: DashboardDeletedEvent,
): Promise<void>;
//# sourceMappingURL=dashboard.d.ts.map
