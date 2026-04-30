import type { DatabaseInstance } from "@core/database/client";
import type { Insight } from "@core/database/schemas/insights";
import { AppError, propagateError } from "@core/logging/errors";
import { executeBreakdownQuery } from "./compute-breakdown";
import { executeKpiQuery } from "./compute-kpi";
import { executeTimeSeriesQuery } from "./compute-time-series";
import { insightConfigSchema } from "./types";

export async function computeInsightData(
   db: DatabaseInstance,
   insight: Insight,
): Promise<Record<string, unknown>> {
   try {
      const config = insightConfigSchema.parse(insight.config);

      switch (config.type) {
         case "kpi": {
            const result = await executeKpiQuery(db, insight.teamId, config);
            return result as unknown as Record<string, unknown>;
         }
         case "time_series": {
            const result = await executeTimeSeriesQuery(
               db,
               insight.teamId,
               config,
            );
            return result as unknown as Record<string, unknown>;
         }
         case "breakdown": {
            const result = await executeBreakdownQuery(
               db,
               insight.teamId,
               config,
            );
            return result as unknown as Record<string, unknown>;
         }
      }
   } catch (err) {
      propagateError(err);
      throw AppError.internal(`Failed to compute insight data: ${err}`, {
         cause: err,
      });
   }
}
