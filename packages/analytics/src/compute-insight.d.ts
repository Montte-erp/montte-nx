import type { DatabaseInstance } from "@core/database/client";
import type { Insight } from "@core/database/schemas/insights";
export declare function computeInsightData(
   db: DatabaseInstance,
   insight: Insight,
): Promise<Record<string, unknown>>;
//# sourceMappingURL=compute-insight.d.ts.map
