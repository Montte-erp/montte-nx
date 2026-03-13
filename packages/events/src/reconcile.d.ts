import type { DatabaseInstance } from "@core/database/client";
import type { Redis } from "ioredis";
export declare function reconcileUsageCounters(
   db: DatabaseInstance,
   redis: Redis,
): Promise<void>;
//# sourceMappingURL=reconcile.d.ts.map
