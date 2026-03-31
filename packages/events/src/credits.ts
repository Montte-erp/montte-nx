import type { Redis } from "@core/redis/connection";
import { FREE_TIER_LIMITS } from "@core/stripe/constants";

function usageHashKey(organizationId: string): string {
   return `usage:${organizationId}`;
}

function msUntilEndOfMonth(): number {
   const now = new Date();
   const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
   return new Date(next.getTime() + 86_400_000).getTime() - now.getTime();
}

export async function isWithinFreeTier(
   organizationId: string,
   eventName: string,
   redis?: Redis,
): Promise<boolean> {
   if (!redis) return true;

   const limit = FREE_TIER_LIMITS[eventName];
   if (limit === undefined) return true;

   const raw = await redis.hget(usageHashKey(organizationId), eventName);
   if (raw === null) return true;

   return Number(raw) < limit;
}

export async function incrementUsage(
   organizationId: string,
   eventName: string,
   redis?: Redis,
): Promise<void> {
   if (!redis) return;

   const key = usageHashKey(organizationId);
   const newValue = await redis.hincrby(key, eventName, 1);

   if (newValue === 1) {
      const ttl = await redis.pttl(key);
      if (ttl < 0) {
         await redis.pexpire(key, msUntilEndOfMonth());
      }
   }
}

export async function getCurrentUsage(
   organizationId: string,
   eventName: string,
   redis?: Redis,
): Promise<{ used: number; limit: number; withinFreeTier: boolean }> {
   const limit = FREE_TIER_LIMITS[eventName] ?? 0;

   if (!redis) return { used: 0, limit, withinFreeTier: true };

   const raw = await redis.hget(usageHashKey(organizationId), eventName);
   const used = raw ? Number(raw) : 0;

   return { used, limit, withinFreeTier: used < limit };
}

export async function getAllUsage(
   organizationId: string,
   redis?: Redis,
): Promise<Record<string, number>> {
   if (!redis) return {};

   const data = await redis.hgetall(usageHashKey(organizationId));
   return Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, Number(v)]),
   );
}
