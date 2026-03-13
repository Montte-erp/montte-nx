import type { InsightConfig } from "./types";
interface DefaultInsightDef {
   name: string;
   description: string;
   type: "kpi" | "time_series" | "breakdown";
   config: InsightConfig;
   defaultSize: "sm" | "md" | "lg" | "full";
}
export declare const DEFAULT_INSIGHTS: DefaultInsightDef[];
export type { DefaultInsightDef };
//# sourceMappingURL=defaults.d.ts.map
