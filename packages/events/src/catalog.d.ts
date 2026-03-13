import type { Money } from "@f-o-t/money";
export declare const EVENT_CATEGORIES: {
   readonly finance: "finance";
   readonly ai: "ai";
   readonly webhook: "webhook";
   readonly dashboard: "dashboard";
   readonly insight: "insight";
   readonly contact: "contact";
   readonly inventory: "inventory";
   readonly service: "service";
   readonly nfe: "nfe";
   readonly document: "document";
   readonly system: "system";
};
export type EventCategory =
   (typeof EVENT_CATEGORIES)[keyof typeof EVENT_CATEGORIES];
export type EmitFn = (params: {
   organizationId: string;
   eventName: string;
   eventCategory: EventCategory;
   properties: Record<string, unknown>;
   userId?: string;
   teamId?: string;
   priceOverride?: Money;
}) => Promise<void>;
export declare function getEventCategory(
   eventName: string,
): EventCategory | undefined;
//# sourceMappingURL=catalog.d.ts.map
