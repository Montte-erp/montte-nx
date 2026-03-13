import type { DatabaseInstance } from "@core/database/client";
import type { TimeSeriesConfig, TimeSeriesResult } from "./types";
export declare function executeTimeSeriesQuery(
   db: DatabaseInstance,
   teamId: string,
   config: TimeSeriesConfig,
): Promise<TimeSeriesResult>;
//# sourceMappingURL=compute-time-series.d.ts.map
