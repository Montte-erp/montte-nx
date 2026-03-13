import type { Redis } from "@core/redis/connection";
export interface SecondaryStorage {
   get: (key: string) => Promise<string | null>;
   set: (key: string, value: string, ttl?: number) => Promise<void>;
   delete: (key: string) => Promise<void>;
}
export interface BetterAuthStorageOptions {
   prefix?: string;
}
export declare function createBetterAuthStorage(
   redis: Redis,
   options?: BetterAuthStorageOptions,
): SecondaryStorage;
//# sourceMappingURL=cache.d.ts.map
