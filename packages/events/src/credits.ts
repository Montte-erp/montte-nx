import { getRedisConnection } from "@core/redis/connection";
import { FREE_TIER_LIMITS } from "@core/stripe/constants";

function usageKey(organizationId: string, eventName: string): string {
   return `usage:${organizationId}:${eventName}`;
}

function msUntilEndOfMonth(): number {
   const now = new Date();
   const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
   return new Date(next.getTime() + 86_400_000).getTime() - now.getTime();
}

export async function isWithinFreeTier(
   organizationId: string,
   eventName: string,
): Promise<boolean> {
   const redis = getRedisConnection();
   if (!redis) return true;

   const limit = FREE_TIER_LIMITS[eventName];
   if (limit === undefined) return true;

   const raw = await redis.get(usageKey(organizationId, eventName));
   if (raw === null) return true;

   return Number(raw) < limit;
}

export async function incrementUsage(
   organizationId: string,
   eventName: string,
): Promise<void> {
   const redis = getRedisConnection();
   if (!redis) return;

   const key = usageKey(organizationId, eventName);
   const newValue = await redis.incr(key);

   if (newValue === 1) {
      await redis.pexpire(key, msUntilEndOfMonth());
   }
}

export async function getCurrentUsage(
   organizationId: string,
   eventName: string,
): Promise<{ used: number; limit: number; withinFreeTier: boolean }> {
   const redis = getRedisConnection();
   const limit = FREE_TIER_LIMITS[eventName] ?? 0;

   if (!redis) return { used: 0, limit, withinFreeTier: true };

   const raw = await redis.get(usageKey(organizationId, eventName));
   const used = raw ? Number(raw) : 0;

   return { used, limit, withinFreeTier: used < limit };
}
