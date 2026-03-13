import type { DatabaseInstance } from "@core/database/client";
import type { BreakdownConfig, BreakdownResult } from "./types";
export declare function executeBreakdownQuery(
   db: DatabaseInstance,
   teamId: string,
   config: BreakdownConfig,
): Promise<BreakdownResult>;
//# sourceMappingURL=compute-breakdown.d.ts.map
