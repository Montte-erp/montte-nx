import type { Money } from "@f-o-t/money";

export const EVENT_CATEGORIES = {
   finance: "finance",
   ai: "ai",
   webhook: "webhook",
   dashboard: "dashboard",
   insight: "insight",
   contact: "contact",
   inventory: "inventory",
   service: "service",
   nfe: "nfe",
   document: "document",
   system: "system",
} as const;

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

const categorySet = new Set<string>(Object.values(EVENT_CATEGORIES));

export function getEventCategory(eventName: string): EventCategory | undefined {
   const prefix = eventName.split(".")[0];
   if (prefix && categorySet.has(prefix)) {
      return prefix as EventCategory;
   }
   return undefined;
}
