import type { Money } from "@f-o-t/money";
import type { DatabaseInstance } from "@core/database/client";
import type { PostHog } from "@core/posthog/server";
import type { StripeClient } from "@core/stripe";
import type { Redis } from "@core/redis/connection";
import type { EmitFn, EventCategory } from "./catalog";
export interface EmitEventParams {
   db: DatabaseInstance;
   redis?: Redis;
   posthog?: PostHog;
   organizationId: string;
   eventName: string;
   eventCategory: EventCategory;
   properties: Record<string, unknown>;
   userId?: string;
   teamId?: string;
   ipAddress?: string;
   userAgent?: string;
   priceOverride?: Money;
   stripeClient?: StripeClient;
   stripeCustomerId?: string;
}
export declare function createEmitFn(
   db: DatabaseInstance,
   posthog?: PostHog,
   stripeClient?: StripeClient,
   stripeCustomerId?: string,
   redis?: Redis,
): EmitFn;
export interface EmitEventBatchParams {
   db: DatabaseInstance;
   posthog?: PostHog;
   events: Omit<EmitEventParams, "db" | "posthog" | "redis">[];
}
export declare function initializeWebhookQueue(redisUrl: string): void;
export declare function emitEvent(params: EmitEventParams): Promise<void>;
export declare function emitEventBatch(
   params: EmitEventBatchParams,
): Promise<void>;
//# sourceMappingURL=emit.d.ts.map
