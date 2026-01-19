import type {
   InsightConfig,
   InsightFilter,
} from "@packages/database/schemas/dashboards";
import { Button } from "@packages/ui/components/button";
import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogTitle,
} from "@packages/ui/components/dialog";
import {
   Drawer,
   DrawerContent,
   DrawerDescription,
   DrawerFooter,
   DrawerHeader,
   DrawerTitle,
} from "@packages/ui/components/drawer";
import { SidebarProvider } from "@packages/ui/components/sidebar";
import { useIsMobile } from "@packages/ui/hooks/use-mobile";
import { Settings2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { type ConfigSection, type ChartType } from "./config-search-index";
import { InsightConfigHeader } from "./insight-config-header";
import { InsightConfigMobileNav } from "./insight-config-mobile-nav";
import { InsightConfigSidebar } from "./insight-config-sidebar";
import { AdvancedSection } from "./sections/advanced-section";
import { ChartOptionsSection } from "./sections/chart-options-section";
import { DataFiltersSection } from "./sections/data-filters-section";
import { DisplayTypeSection } from "./sections/display-type-section";
import { TimeFiltersSection } from "./sections/time-filters-section";

type RelativePeriod = NonNullable<
   InsightConfig["dateRangeOverride"]
>["relativePeriod"];
type TimeGrouping = NonNullable<InsightConfig["timeGrouping"]>;
type ComparisonType = NonNullable<InsightConfig["comparison"]>["type"] | "none";
type TransactionType = "income" | "expense" | "transfer" | "all";

// Helper functions to parse InsightFilter array
function getFilterValue(
   filters: InsightFilter[],
   field: string,
): string | string[] | null {
   const filter = filters.find((f) => f.field === field);
   if (!filter) return null;
   return filter.value as string | string[];
}

function getCategoryIdsFromFilters(filters: InsightFilter[]): string[] {
   const value = getFilterValue(filters, "categoryId");
   if (!value) return [];
   return Array.isArray(value) ? value : [value];
}

function getTagIdsFromFilters(filters: InsightFilter[]): string[] {
   const value = getFilterValue(filters, "tagId");
   if (!value) return [];
   return Array.isArray(value) ? value : [value];
}

function getBankAccountIdFromFilters(filters: InsightFilter[]): string {
   const value = getFilterValue(filters, "bankAccountId");
   if (!value) return "all";
   return Array.isArray(value) ? value[0] || "all" : value;
}

function getTransactionTypeFromFilters(
   filters: InsightFilter[],
): TransactionType {
   const value = getFilterValue(filters, "type");
   if (!value) return "all";
   const typeValue = Array.isArray(value) ? value[0] : value;
   if (
      typeValue === "income" ||
      typeValue === "expense" ||
      typeValue === "transfer"
   ) {
      return typeValue;
   }
   return "all";
}

function buildDataFilters(
   typeFilter: TransactionType,
   categoryIds: string[],
   tagIds: string[],
   bankAccountId: string,
): InsightFilter[] {
   const filters: InsightFilter[] = [];

   if (typeFilter !== "all") {
      filters.push({ field: "type", operator: "equals", value: typeFilter });
   }

   if (categoryIds.length > 0) {
      filters.push({ field: "categoryId", operator: "in", value: categoryIds });
   }

   if (tagIds.length > 0) {
      filters.push({ field: "tagId", operator: "in", value: tagIds });
   }

   if (bankAccountId !== "all") {
      filters.push({
         field: "bankAccountId",
         operator: "equals",
         value: bankAccountId,
      });
   }

   return filters;
}

type InsightConfigDialogProps = {
   open: boolean;
   onOpenChange: (open: boolean) => void;
   config: InsightConfig;
   onApply: (updates: Partial<InsightConfig>) => void;
   initialSection?: ConfigSection;
};

export function InsightConfigDialog({
   open,
   onOpenChange,
   config,
   onApply,
   initialSection = "display-type",
}: InsightConfigDialogProps) {
   const isMobile = useIsMobile();
   const [activeSection, setActiveSection] =
      useState<ConfigSection>(initialSection);
   const [searchQuery, setSearchQuery] = useState("");

   // Parse initial filter values from config
   const initialFilters = config.filters || [];

   // Draft state for all configuration options
   // Display Type
   const [chartType, setChartType] = useState<ChartType>(config.chartType);

   // Time Filters
   const [dateRange, setDateRange] = useState<RelativePeriod>(
      config.dateRangeOverride?.relativePeriod ?? "last_30_days",
   );
   const [customStartDate, setCustomStartDate] = useState<Date | undefined>(
      config.dateRangeOverride?.startDate
         ? new Date(config.dateRangeOverride.startDate)
         : undefined,
   );
   const [customEndDate, setCustomEndDate] = useState<Date | undefined>(
      config.dateRangeOverride?.endDate
         ? new Date(config.dateRangeOverride.endDate)
         : undefined,
   );
   const [timeGrouping, setTimeGrouping] = useState<TimeGrouping>(
      config.timeGrouping ?? "month",
   );
   const [comparison, setComparison] = useState<ComparisonType>(
      config.comparison?.type ?? "none",
   );

   // Data Filters
   const [typeFilter, setTypeFilter] = useState<TransactionType>(
      getTransactionTypeFromFilters(initialFilters),
   );
   const [selectedCategories, setSelectedCategories] = useState<string[]>(
      getCategoryIdsFromFilters(initialFilters),
   );
   const [selectedTags, setSelectedTags] = useState<string[]>(
      getTagIdsFromFilters(initialFilters),
   );
   const [selectedBankAccount, setSelectedBankAccount] = useState<string>(
      getBankAccountIdFromFilters(initialFilters),
   );

   // Chart Options
   const [showLabels, setShowLabels] = useState(config.showLabels ?? false);
   const [showLegend, setShowLegend] = useState(config.showLegend ?? false);
   const [showAlertThresholdLines, setShowAlertThresholdLines] = useState(
      config.showAlertThresholdLines ?? false,
   );
   const [showMultipleYAxes, setShowMultipleYAxes] = useState(
      config.showMultipleYAxes ?? false,
   );
   const [showTrendLine, setShowTrendLine] = useState(
      config.showTrendLine ?? false,
   );
   const [colorBy, setColorBy] = useState<"name" | "rank">(
      config.colorBy ?? "name",
   );
   const [yAxisUnit, setYAxisUnit] = useState(config.yAxisUnit || "none");
   const [yAxisScale, setYAxisScale] = useState<"linear" | "logarithmic">(
      config.yAxisScale ?? "linear",
   );

   // Sparkline options for stat_card
   const [showSparkline, setShowSparkline] = useState(!!config.miniChart);
   const [sparklineType, setSparklineType] = useState<
      "sparkline" | "area" | "bar"
   >(config.miniChart?.type ?? "sparkline");
   const [sparklineShowTrend, setSparklineShowTrend] = useState(
      config.miniChart?.showTrend ?? true,
   );

   // Advanced options
   const [showConfidenceIntervals, setShowConfidenceIntervals] = useState(
      config.showConfidenceIntervals ?? false,
   );
   const [showMovingAverage, setShowMovingAverage] = useState(
      config.showMovingAverage ?? false,
   );

   // Comparison overlay options
   const [showComparisonOverlay, setShowComparisonOverlay] = useState(
      config.comparisonOverlay?.enabled ?? false,
   );
   const [comparisonOverlayType, setComparisonOverlayType] = useState<
      "previous_period" | "previous_year"
   >(config.comparisonOverlay?.type ?? "previous_period");
   const [comparisonOverlayStyle, setComparisonOverlayStyle] = useState<
      "dashed" | "dotted" | "solid"
   >(config.comparisonOverlay?.style ?? "dashed");

   // Forecast options
   const [showForecast, setShowForecast] = useState(
      config.forecast?.enabled ?? false,
   );
   const [forecastModel, setForecastModel] = useState<
      "linear" | "moving_average" | "exponential_smoothing"
   >(config.forecast?.model ?? "linear");
   const [forecastPeriods, setForecastPeriods] = useState(
      config.forecast?.periods ?? 3,
   );
   const [forecastShowConfidence, setForecastShowConfidence] = useState(
      config.forecast?.showConfidenceInterval ?? true,
   );

   // Reset all state when dialog opens or config changes
   useEffect(() => {
      if (!open) return;

      // Reset section to initial section
      setActiveSection(initialSection);
      setSearchQuery("");

      // Reset display type
      setChartType(config.chartType);

      // Reset time filters
      setDateRange(config.dateRangeOverride?.relativePeriod ?? "last_30_days");
      setCustomStartDate(
         config.dateRangeOverride?.startDate
            ? new Date(config.dateRangeOverride.startDate)
            : undefined,
      );
      setCustomEndDate(
         config.dateRangeOverride?.endDate
            ? new Date(config.dateRangeOverride.endDate)
            : undefined,
      );
      setTimeGrouping(config.timeGrouping ?? "month");
      setComparison(config.comparison?.type ?? "none");

      // Reset data filters
      const filters = config.filters || [];
      setTypeFilter(getTransactionTypeFromFilters(filters));
      setSelectedCategories(getCategoryIdsFromFilters(filters));
      setSelectedTags(getTagIdsFromFilters(filters));
      setSelectedBankAccount(getBankAccountIdFromFilters(filters));

      // Reset chart options
      setShowLabels(config.showLabels ?? false);
      setShowLegend(config.showLegend ?? false);
      setShowAlertThresholdLines(config.showAlertThresholdLines ?? false);
      setShowMultipleYAxes(config.showMultipleYAxes ?? false);
      setShowTrendLine(config.showTrendLine ?? false);
      setColorBy(config.colorBy ?? "name");
      setYAxisUnit(config.yAxisUnit || "none");
      setYAxisScale(config.yAxisScale ?? "linear");

      // Reset sparkline options
      setShowSparkline(!!config.miniChart);
      setSparklineType(config.miniChart?.type ?? "sparkline");
      setSparklineShowTrend(config.miniChart?.showTrend ?? true);

      // Reset advanced options
      setShowConfidenceIntervals(config.showConfidenceIntervals ?? false);
      setShowMovingAverage(config.showMovingAverage ?? false);

      // Reset comparison overlay
      setShowComparisonOverlay(config.comparisonOverlay?.enabled ?? false);
      setComparisonOverlayType(config.comparisonOverlay?.type ?? "previous_period");
      setComparisonOverlayStyle(config.comparisonOverlay?.style ?? "dashed");

      // Reset forecast options
      setShowForecast(config.forecast?.enabled ?? false);
      setForecastModel(config.forecast?.model ?? "linear");
      setForecastPeriods(config.forecast?.periods ?? 3);
      setForecastShowConfidence(config.forecast?.showConfidenceInterval ?? true);
   }, [open, config, initialSection]);

   // Count active data filters
   const activeFilterCount = useMemo(() => {
      let count = 0;
      if (typeFilter !== "all") count++;
      if (selectedCategories.length > 0) count++;
      if (selectedTags.length > 0) count++;
      if (selectedBankAccount !== "all") count++;
      return count;
   }, [typeFilter, selectedCategories, selectedTags, selectedBankAccount]);

   // Check if there are any changes
   const hasChanges = useMemo(() => {
      // Chart type
      if (chartType !== config.chartType) return true;

      // Time filters
      if (
         dateRange !==
         (config.dateRangeOverride?.relativePeriod ?? "last_30_days")
      )
         return true;
      if (timeGrouping !== (config.timeGrouping ?? "month")) return true;
      if (comparison !== (config.comparison?.type ?? "none")) return true;

      // Data filters
      if (typeFilter !== getTransactionTypeFromFilters(initialFilters))
         return true;
      if (
         JSON.stringify(selectedCategories.sort()) !==
         JSON.stringify(getCategoryIdsFromFilters(initialFilters).sort())
      )
         return true;
      if (
         JSON.stringify(selectedTags.sort()) !==
         JSON.stringify(getTagIdsFromFilters(initialFilters).sort())
      )
         return true;
      if (selectedBankAccount !== getBankAccountIdFromFilters(initialFilters))
         return true;

      // Chart options
      if (showLabels !== (config.showLabels ?? false)) return true;
      if (showLegend !== (config.showLegend ?? false)) return true;
      if (
         showAlertThresholdLines !== (config.showAlertThresholdLines ?? false)
      )
         return true;
      if (showMultipleYAxes !== (config.showMultipleYAxes ?? false))
         return true;
      if (showTrendLine !== (config.showTrendLine ?? false)) return true;
      if (colorBy !== (config.colorBy ?? "name")) return true;
      if (yAxisUnit !== (config.yAxisUnit || "none")) return true;
      if (yAxisScale !== (config.yAxisScale ?? "linear")) return true;

      // Sparkline
      if (showSparkline !== !!config.miniChart) return true;
      if (showSparkline) {
         if (sparklineType !== (config.miniChart?.type ?? "sparkline"))
            return true;
         if (sparklineShowTrend !== (config.miniChart?.showTrend ?? true))
            return true;
      }

      // Advanced
      if (
         showConfidenceIntervals !== (config.showConfidenceIntervals ?? false)
      )
         return true;
      if (showMovingAverage !== (config.showMovingAverage ?? false))
         return true;

      // Comparison overlay
      if (
         showComparisonOverlay !== (config.comparisonOverlay?.enabled ?? false)
      )
         return true;
      if (showComparisonOverlay) {
         if (
            comparisonOverlayType !==
            (config.comparisonOverlay?.type ?? "previous_period")
         )
            return true;
         if (
            comparisonOverlayStyle !==
            (config.comparisonOverlay?.style ?? "dashed")
         )
            return true;
      }

      // Forecast
      if (showForecast !== (config.forecast?.enabled ?? false)) return true;
      if (showForecast) {
         if (forecastModel !== (config.forecast?.model ?? "linear"))
            return true;
         if (forecastPeriods !== (config.forecast?.periods ?? 3)) return true;
         if (
            forecastShowConfidence !==
            (config.forecast?.showConfidenceInterval ?? true)
         )
            return true;
      }

      return false;
   }, [
      chartType,
      config,
      dateRange,
      timeGrouping,
      comparison,
      typeFilter,
      selectedCategories,
      selectedTags,
      selectedBankAccount,
      showLabels,
      showLegend,
      showAlertThresholdLines,
      showMultipleYAxes,
      showTrendLine,
      colorBy,
      yAxisUnit,
      yAxisScale,
      showSparkline,
      sparklineType,
      sparklineShowTrend,
      showConfidenceIntervals,
      showMovingAverage,
      showComparisonOverlay,
      comparisonOverlayType,
      comparisonOverlayStyle,
      showForecast,
      forecastModel,
      forecastPeriods,
      forecastShowConfidence,
      initialFilters,
   ]);

   const handleApply = useCallback(() => {
      const dataFilters = buildDataFilters(
         typeFilter,
         selectedCategories,
         selectedTags,
         selectedBankAccount,
      );

      onApply({
         chartType,
         dateRangeOverride: {
            relativePeriod: dateRange,
            startDate:
               dateRange === "custom" && customStartDate
                  ? customStartDate.toISOString()
                  : undefined,
            endDate:
               dateRange === "custom" && customEndDate
                  ? customEndDate.toISOString()
                  : undefined,
         },
         timeGrouping,
         comparison: comparison === "none" ? undefined : { type: comparison },
         filters: dataFilters,
         showLabels,
         showLegend,
         showAlertThresholdLines,
         showMultipleYAxes,
         showTrendLine,
         colorBy,
         yAxisUnit: yAxisUnit === "none" ? undefined : yAxisUnit,
         yAxisScale,
         showConfidenceIntervals,
         showMovingAverage,
         miniChart: showSparkline
            ? { type: sparklineType, showTrend: sparklineShowTrend }
            : undefined,
         comparisonOverlay: showComparisonOverlay
            ? {
                 enabled: true,
                 type: comparisonOverlayType,
                 style: comparisonOverlayStyle,
              }
            : undefined,
         forecast: showForecast
            ? {
                 enabled: true,
                 model: forecastModel,
                 periods: forecastPeriods,
                 showConfidenceInterval: forecastShowConfidence,
              }
            : undefined,
      });
      onOpenChange(false);
   }, [
      chartType,
      customEndDate,
      customStartDate,
      dateRange,
      timeGrouping,
      comparison,
      typeFilter,
      selectedCategories,
      selectedTags,
      selectedBankAccount,
      showLabels,
      showLegend,
      showAlertThresholdLines,
      showMultipleYAxes,
      showTrendLine,
      colorBy,
      yAxisUnit,
      yAxisScale,
      showConfidenceIntervals,
      showMovingAverage,
      showSparkline,
      sparklineType,
      sparklineShowTrend,
      showComparisonOverlay,
      comparisonOverlayType,
      comparisonOverlayStyle,
      showForecast,
      forecastModel,
      forecastPeriods,
      forecastShowConfidence,
      onApply,
      onOpenChange,
   ]);

   const handleCancel = useCallback(() => {
      onOpenChange(false);
   }, [onOpenChange]);

   const renderSection = () => {
      switch (activeSection) {
         case "display-type":
            return (
               <DisplayTypeSection
                  chartType={chartType}
                  dataSource={config.dataSource}
                  onChartTypeChange={setChartType}
               />
            );
         case "time-filters":
            return (
               <TimeFiltersSection
                  comparison={comparison}
                  customEndDate={customEndDate}
                  customStartDate={customStartDate}
                  dateRange={dateRange}
                  onComparisonChange={setComparison}
                  onCustomEndDateChange={setCustomEndDate}
                  onCustomStartDateChange={setCustomStartDate}
                  onDateRangeChange={setDateRange}
                  onTimeGroupingChange={setTimeGrouping}
                  timeGrouping={timeGrouping}
               />
            );
         case "data-filters":
            return (
               <DataFiltersSection
                  dataSource={config.dataSource}
                  onBankAccountChange={setSelectedBankAccount}
                  onCategoriesChange={setSelectedCategories}
                  onTagsChange={setSelectedTags}
                  onTypeFilterChange={setTypeFilter}
                  selectedBankAccount={selectedBankAccount}
                  selectedCategories={selectedCategories}
                  selectedTags={selectedTags}
                  typeFilter={typeFilter}
               />
            );
         case "chart-options":
            return (
               <ChartOptionsSection
                  chartType={chartType}
                  colorBy={colorBy}
                  onColorByChange={setColorBy}
                  onShowAlertThresholdLinesChange={setShowAlertThresholdLines}
                  onShowLabelsChange={setShowLabels}
                  onShowLegendChange={setShowLegend}
                  onShowMultipleYAxesChange={setShowMultipleYAxes}
                  onShowSparklineChange={setShowSparkline}
                  onShowTrendLineChange={setShowTrendLine}
                  onSparklineShowTrendChange={setSparklineShowTrend}
                  onSparklineTypeChange={setSparklineType}
                  onYAxisScaleChange={setYAxisScale}
                  onYAxisUnitChange={setYAxisUnit}
                  showAlertThresholdLines={showAlertThresholdLines}
                  showLabels={showLabels}
                  showLegend={showLegend}
                  showMultipleYAxes={showMultipleYAxes}
                  showSparkline={showSparkline}
                  showTrendLine={showTrendLine}
                  sparklineShowTrend={sparklineShowTrend}
                  sparklineType={sparklineType}
                  yAxisScale={yAxisScale}
                  yAxisUnit={yAxisUnit}
               />
            );
         case "advanced":
            return (
               <AdvancedSection
                  chartType={chartType}
                  comparisonOverlayStyle={comparisonOverlayStyle}
                  comparisonOverlayType={comparisonOverlayType}
                  forecastModel={forecastModel}
                  forecastPeriods={forecastPeriods}
                  forecastShowConfidence={forecastShowConfidence}
                  onComparisonOverlayStyleChange={setComparisonOverlayStyle}
                  onComparisonOverlayTypeChange={setComparisonOverlayType}
                  onForecastModelChange={setForecastModel}
                  onForecastPeriodsChange={setForecastPeriods}
                  onForecastShowConfidenceChange={setForecastShowConfidence}
                  onShowComparisonOverlayChange={setShowComparisonOverlay}
                  onShowConfidenceIntervalsChange={setShowConfidenceIntervals}
                  onShowForecastChange={setShowForecast}
                  onShowMovingAverageChange={setShowMovingAverage}
                  showComparisonOverlay={showComparisonOverlay}
                  showConfidenceIntervals={showConfidenceIntervals}
                  showForecast={showForecast}
                  showMovingAverage={showMovingAverage}
               />
            );
         default:
            return null;
      }
   };

   // Mobile: Drawer
   if (isMobile) {
      return (
         <Drawer onOpenChange={onOpenChange} open={open}>
            <DrawerContent className="max-h-[85vh]">
               <DrawerHeader>
                  <DrawerTitle className="flex items-center gap-2">
                     <Settings2 className="h-5 w-5" />
                     Configurar Widget
                  </DrawerTitle>
                  <DrawerDescription>
                     Configure as opcoes do widget
                  </DrawerDescription>
               </DrawerHeader>
               <InsightConfigMobileNav
                  activeFilterCount={activeFilterCount}
                  activeSection={activeSection}
                  onSectionChange={setActiveSection}
               />
               <div className="flex-1 overflow-y-auto px-4 pb-4">
                  {renderSection()}
               </div>
               <DrawerFooter className="border-t pt-4">
                  <div className="flex gap-2">
                     <Button
                        className="flex-1"
                        onClick={handleCancel}
                        variant="outline"
                     >
                        Cancelar
                     </Button>
                     <Button
                        className="flex-1"
                        disabled={!hasChanges}
                        onClick={handleApply}
                     >
                        Aplicar
                     </Button>
                  </div>
               </DrawerFooter>
            </DrawerContent>
         </Drawer>
      );
   }

   // Desktop: Dialog
   return (
      <Dialog onOpenChange={onOpenChange} open={open}>
         <DialogContent
            className="overflow-hidden p-0 md:max-h-[500px] md:max-w-[700px] lg:max-w-[800px]"
            showCloseButton={false}
         >
            <DialogTitle className="sr-only">Configurar Widget</DialogTitle>
            <DialogDescription className="sr-only">
               Configure as opcoes de exibicao do widget
            </DialogDescription>
            <SidebarProvider className="items-start min-h-0">
               <InsightConfigSidebar
                  activeFilterCount={activeFilterCount}
                  activeSection={activeSection}
                  onSectionChange={setActiveSection}
               />
               <main className="flex h-[480px] flex-1 flex-col overflow-hidden">
                  <InsightConfigHeader
                     onSearchQueryChange={setSearchQuery}
                     onSectionChange={setActiveSection}
                     searchQuery={searchQuery}
                     section={activeSection}
                  />
                  <div className="flex-1 overflow-y-auto p-4">
                     {renderSection()}
                  </div>
                  <footer className="border-t p-4 flex justify-end gap-2">
                     <Button onClick={handleCancel} variant="outline">
                        Cancelar
                     </Button>
                     <Button disabled={!hasChanges} onClick={handleApply}>
                        Aplicar
                     </Button>
                  </footer>
               </main>
            </SidebarProvider>
         </DialogContent>
      </Dialog>
   );
}
