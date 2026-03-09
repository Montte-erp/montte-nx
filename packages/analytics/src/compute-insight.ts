import type { DatabaseInstance } from "@core/database/client";
import type { Insight } from "@core/database/schemas/insights";
import { AppError, propagateError } from "@core/utils/errors";
import { executeBreakdownQuery } from "./compute-breakdown";
import { executeKpiQuery } from "./compute-kpi";
import { executeTimeSeriesQuery } from "./compute-time-series";
import {
   breakdownConfigSchema,
   insightConfigSchema,
   kpiConfigSchema,
   timeSeriesConfigSchema,
} from "./types";

/**
 * Compute insight data based on insight configuration.
 * Returns the query result in JSON format ready to be cached.
 */
export async function computeInsightData(
   db: DatabaseInstance,
   insight: Insight,
): Promise<Record<string, unknown>> {
   try {
      // Parse and validate config
      const config = insightConfigSchema.parse(insight.config);

      // Dispatch to appropriate query executor based on type
      switch (config.type) {
         case "kpi": {
            const kpiConfig = kpiConfigSchema.parse(config);
            const result = await executeKpiQuery(db, insight.teamId, kpiConfig);
            return result as unknown as Record<string, unknown>;
         }
         case "time_series": {
            const tsConfig = timeSeriesConfigSchema.parse(config);
            const result = await executeTimeSeriesQuery(
               db,
               insight.teamId,
               tsConfig,
            );
            return result as unknown as Record<string, unknown>;
         }
         case "breakdown": {
            const bdConfig = breakdownConfigSchema.parse(config);
            const result = await executeBreakdownQuery(
               db,
               insight.teamId,
               bdConfig,
            );
            return result as unknown as Record<string, unknown>;
         }
         default: {
            throw AppError.validation(
               `Unknown insight type: ${(config as { type: string }).type}`,
            );
         }
      }
   } catch (err) {
      propagateError(err);
      throw AppError.internal(`Failed to compute insight data: ${err}`, {
         cause: err,
      });
   }
}
