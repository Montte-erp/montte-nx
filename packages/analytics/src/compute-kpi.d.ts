import type { DatabaseInstance } from "@core/database/client";
import type { KpiConfig, KpiResult, TransactionFilters } from "./types";
export declare function executeKpiQuery(
   db: DatabaseInstance,
   teamId: string,
   config: KpiConfig,
): Promise<KpiResult>;
export declare function buildConditions(
   teamId: string,
   filters: TransactionFilters,
   start: Date,
   end: Date,
): import("drizzle-orm").SQL<unknown>[];
//# sourceMappingURL=compute-kpi.d.ts.map
