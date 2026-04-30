import type {
   BreakdownConfig,
   InsightConfig,
   KpiConfig,
   TimeSeriesConfig,
} from "@modules/insights/types";
import { Store, useStore, shallow } from "@tanstack/react-store";
import { useDebouncedCallback } from "@tanstack/react-pacer";
import { useCallback, useState } from "react";

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

type InsightState =
   | { type: "kpi"; config: KpiConfig }
   | { type: "time_series"; config: TimeSeriesConfig }
   | { type: "breakdown"; config: BreakdownConfig };

function buildInitialState(initialConfig?: InsightConfig): InsightState {
   if (initialConfig?.type === "kpi")
      return { type: "kpi", config: initialConfig };
   if (initialConfig?.type === "time_series")
      return { type: "time_series", config: initialConfig };
   if (initialConfig?.type === "breakdown")
      return { type: "breakdown", config: initialConfig };
   return { type: "kpi", config: DEFAULT_KPI_CONFIG };
}

function mergeConfig(
   state: InsightState,
   updates: Partial<InsightConfig>,
): InsightState {
   if (state.type === "kpi")
      return {
         type: "kpi",
         config: { ...state.config, ...updates, type: "kpi" },
      };
   if (state.type === "time_series")
      return {
         type: "time_series",
         config: { ...state.config, ...updates, type: "time_series" },
      };
   return {
      type: "breakdown",
      config: { ...state.config, ...updates, type: "breakdown" },
   };
}

export function useInsightConfig(initialConfig?: InsightConfig) {
   const [store] = useState(
      () => new Store<InsightState>(buildInitialState(initialConfig)),
   );

   const state = useStore(store, (s) => s, shallow);

   const setType = useCallback(
      (newType: InsightType) => {
         if (newType === "kpi") {
            store.setState(() => ({ type: "kpi", config: DEFAULT_KPI_CONFIG }));
            return;
         }
         if (newType === "time_series") {
            store.setState(() => ({
               type: "time_series",
               config: DEFAULT_TIME_SERIES_CONFIG,
            }));
            return;
         }
         store.setState(() => ({
            type: "breakdown",
            config: DEFAULT_BREAKDOWN_CONFIG,
         }));
      },
      [store],
   );

   const updateConfig = useDebouncedCallback(
      (updates: Partial<InsightConfig>) => {
         store.setState((prev) => mergeConfig(prev, updates));
      },
      { wait: 500 },
   );

   const updateConfigImmediate = useCallback(
      (updates: Partial<InsightConfig>) => {
         store.setState((prev) => mergeConfig(prev, updates));
      },
      [store],
   );

   return {
      type: state.type,
      config: state.config,
      setType,
      updateConfig,
      updateConfigImmediate,
   };
}
