import type {
   BreakdownConfig,
   InsightConfig,
   KpiConfig,
   TimeSeriesConfig,
} from "@packages/analytics/types";
import { useDebouncedValue } from "foxact/use-debounced-value";
import { useCallback, useEffect, useState } from "react";

export type InsightType = "kpi" | "time_series" | "breakdown";

export const DEFAULT_KPI_CONFIG: KpiConfig = {
   type: "kpi",
   measure: { aggregation: "sum" },
   filters: {
      dateRange: { type: "relative", value: "this_month" },
      transactionType: ["income"],
   },
   compare: true,
};

const DEFAULT_TIME_SERIES_CONFIG: TimeSeriesConfig = {
   type: "time_series",
   measure: { aggregation: "sum" },
   filters: {
      dateRange: { type: "relative", value: "30d" },
   },
   interval: "month",
   chartType: "line",
   compare: false,
};

const DEFAULT_BREAKDOWN_CONFIG: BreakdownConfig = {
   type: "breakdown",
   measure: { aggregation: "sum" },
   filters: {
      dateRange: { type: "relative", value: "30d" },
      transactionType: ["expense"],
   },
   groupBy: "category",
   limit: 10,
};

export function useInsightConfig(initialType: InsightType = "kpi") {
   const [type, setType] = useState<InsightType>(initialType);
   const [config, setConfig] = useState<InsightConfig>(DEFAULT_KPI_CONFIG);
   const [pendingUpdates, setPendingUpdates] = useState<Partial<InsightConfig>>(
      {},
   );
   const debouncedUpdates = useDebouncedValue(pendingUpdates, 500);

   useEffect(() => {
      if (Object.keys(debouncedUpdates).length > 0) {
         setConfig((c) => ({ ...c, ...debouncedUpdates }) as InsightConfig);
         setPendingUpdates({});
      }
   }, [debouncedUpdates]);

   const handleTypeChange = useCallback((newType: InsightType) => {
      setType(newType);
      switch (newType) {
         case "kpi":
            setConfig(DEFAULT_KPI_CONFIG);
            break;
         case "time_series":
            setConfig(DEFAULT_TIME_SERIES_CONFIG);
            break;
         case "breakdown":
            setConfig(DEFAULT_BREAKDOWN_CONFIG);
            break;
      }
   }, []);

   const updateConfig = useCallback((updates: Partial<InsightConfig>) => {
      setPendingUpdates((prev) => ({ ...prev, ...updates }));
   }, []);

   const updateConfigImmediate = useCallback(
      (updates: Partial<InsightConfig>) => {
         setConfig((prev) => ({ ...prev, ...updates }) as InsightConfig);
      },
      [],
   );

   return {
      type,
      config,
      setType: handleTypeChange,
      updateConfig,
      updateConfigImmediate,
   };
}
