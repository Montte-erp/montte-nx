import type { Redis } from "@core/redis/connection";
export declare function isWithinFreeTier(
   organizationId: string,
   eventName: string,
   redis?: Redis,
): Promise<boolean>;
export declare function incrementUsage(
   organizationId: string,
   eventName: string,
   redis?: Redis,
): Promise<void>;
export declare function getCurrentUsage(
   organizationId: string,
   eventName: string,
   redis?: Redis,
): Promise<{
   used: number;
   limit: number;
   withinFreeTier: boolean;
}>;
//# sourceMappingURL=credits.d.ts.map
