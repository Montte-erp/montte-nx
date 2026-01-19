import type { InsightConfig } from "@packages/database/schemas/dashboards";
import { Button } from "@packages/ui/components/button";
import {
   CredenzaBody,
   CredenzaDescription,
   CredenzaFooter,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import { Field } from "@packages/ui/components/field";
import { Label } from "@packages/ui/components/label";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
import { Switch } from "@packages/ui/components/switch";
import {
   ToggleGroup,
   ToggleGroupItem,
} from "@packages/ui/components/toggle-group";
import {
   BarChart,
   Eye,
   GitCompare,
   Palette,
   Settings2,
   Sparkles,
   Tag,
   TrendingUp,
   Trophy,
} from "lucide-react";
import { useState } from "react";
import { useCredenza } from "@/hooks/use-credenza";

type WidgetOptionsCredenzaProps = {
   config: InsightConfig;
   onApply: (updates: Partial<InsightConfig>) => void;
};

const Y_AXIS_UNITS = [
   { value: "none", label: "None" },
   { value: "currency", label: "Currency" },
   { value: "percentage", label: "Percentage" },
   { value: "number", label: "Number" },
];

export function WidgetOptionsCredenza({
   config,
   onApply,
}: WidgetOptionsCredenzaProps) {
   const { closeCredenza } = useCredenza();

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
   const [showConfidenceIntervals, setShowConfidenceIntervals] = useState(
      config.showConfidenceIntervals ?? false,
   );
   const [showMovingAverage, setShowMovingAverage] = useState(
      config.showMovingAverage ?? false,
   );

   // Sparkline options for stat_card
   const [showSparkline, setShowSparkline] = useState(!!config.miniChart);
   const [sparklineType, setSparklineType] = useState<
      "sparkline" | "area" | "bar"
   >(config.miniChart?.type ?? "sparkline");
   const [sparklineShowTrend, setSparklineShowTrend] = useState(
      config.miniChart?.showTrend ?? true,
   );

   // Comparison overlay options for line/area charts
   const [showComparisonOverlay, setShowComparisonOverlay] = useState(
      config.comparisonOverlay?.enabled ?? false,
   );
   const [comparisonOverlayType, setComparisonOverlayType] = useState<
      "previous_period" | "previous_year"
   >(config.comparisonOverlay?.type ?? "previous_period");
   const [comparisonOverlayStyle, setComparisonOverlayStyle] = useState<
      "dashed" | "dotted" | "solid"
   >(config.comparisonOverlay?.style ?? "dashed");

   // Forecast options for time series charts
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

   const handleApply = () => {
      onApply({
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
      closeCredenza();
   };

   const handleCancel = () => {
      closeCredenza();
   };

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle className="flex items-center gap-2">
               <Settings2 className="h-5 w-5" />
               Opções do Widget
            </CredenzaTitle>
            <CredenzaDescription>
               Configure a exibição do widget
            </CredenzaDescription>
         </CredenzaHeader>
         <CredenzaBody className="max-h-[60vh] overflow-y-auto">
            <div className="space-y-6">
               {/* Display Settings */}
               <section className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b">
                     <Eye className="h-4 w-4 text-muted-foreground" />
                     <h4 className="text-sm font-medium">
                        Configurações de Exibição
                     </h4>
                  </div>
                  <div className="space-y-4 pl-6">
                     <SwitchField
                        checked={showLabels}
                        id="show-labels"
                        label="Mostrar valores na série"
                        onCheckedChange={setShowLabels}
                     />
                     <SwitchField
                        checked={showLegend}
                        id="show-legend"
                        label="Mostrar legenda"
                        onCheckedChange={setShowLegend}
                     />
                     <SwitchField
                        checked={showAlertThresholdLines}
                        id="show-threshold"
                        label="Mostrar linhas de limite de alerta"
                        onCheckedChange={setShowAlertThresholdLines}
                     />
                     <SwitchField
                        checked={showMultipleYAxes}
                        id="show-multi-y-axis"
                        label="Mostrar múltiplos eixos Y"
                        onCheckedChange={setShowMultipleYAxes}
                     />
                     <SwitchField
                        checked={showTrendLine}
                        id="show-trend-line"
                        label="Mostrar linha de tendência"
                        onCheckedChange={setShowTrendLine}
                     />
                  </div>
               </section>

               {/* Color Customization */}
               <section className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b">
                     <Palette className="h-4 w-4 text-muted-foreground" />
                     <h4 className="text-sm font-medium">
                        Personalização de Cores
                     </h4>
                  </div>
                  <ToggleGroup
                     className="w-full grid grid-cols-2"
                     onValueChange={(value) =>
                        value && setColorBy(value as "name" | "rank")
                     }
                     type="single"
                     value={colorBy}
                     variant="outline"
                  >
                     <ToggleGroupItem
                        className="flex items-center gap-2"
                        value="name"
                     >
                        <Tag className="h-4 w-4" />
                        Por nome
                     </ToggleGroupItem>
                     <ToggleGroupItem
                        className="flex items-center gap-2"
                        value="rank"
                     >
                        <Trophy className="h-4 w-4" />
                        Por classificação
                     </ToggleGroupItem>
                  </ToggleGroup>
               </section>

               {/* Y-Axis Settings */}
               <section className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b">
                     <BarChart className="h-4 w-4 text-muted-foreground" />
                     <h4 className="text-sm font-medium">Eixo Y</h4>
                  </div>
                  <div className="space-y-4">
                     <Field>
                        <Label className="text-sm font-normal">
                           Unidade do eixo Y
                        </Label>
                        <Select onValueChange={setYAxisUnit} value={yAxisUnit}>
                           <SelectTrigger className="h-10">
                              <SelectValue />
                           </SelectTrigger>
                           <SelectContent>
                              {Y_AXIS_UNITS.map((unit) => (
                                 <SelectItem
                                    key={unit.value}
                                    value={unit.value}
                                 >
                                    {unit.label}
                                 </SelectItem>
                              ))}
                           </SelectContent>
                        </Select>
                     </Field>
                     <div>
                        <Label className="text-sm font-normal mb-2 block">
                           Escala do eixo Y
                        </Label>
                        <ToggleGroup
                           className="w-full grid grid-cols-2"
                           onValueChange={(value) =>
                              value &&
                              setYAxisScale(value as "linear" | "logarithmic")
                           }
                           type="single"
                           value={yAxisScale}
                           variant="outline"
                        >
                           <ToggleGroupItem value="linear">
                              Linear
                           </ToggleGroupItem>
                           <ToggleGroupItem value="logarithmic">
                              Logarítmica
                           </ToggleGroupItem>
                        </ToggleGroup>
                     </div>
                  </div>
               </section>

               {/* Statistical Analysis */}
               <section className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b">
                     <BarChart className="h-4 w-4 text-muted-foreground" />
                     <h4 className="text-sm font-medium">
                        Análise Estatística
                     </h4>
                  </div>
                  <div className="space-y-4 pl-6">
                     <SwitchField
                        checked={showConfidenceIntervals}
                        id="show-confidence"
                        label="Mostrar intervalos de confiança"
                        onCheckedChange={setShowConfidenceIntervals}
                     />
                     <SwitchField
                        checked={showMovingAverage}
                        id="show-moving-avg"
                        label="Mostrar média móvel"
                        onCheckedChange={setShowMovingAverage}
                     />
                  </div>
               </section>

               {/* Comparison Overlay (for line/area charts) */}
               {(config.chartType === "line" ||
                  config.chartType === "area") && (
                  <section className="space-y-4">
                     <div className="flex items-center gap-2 pb-2 border-b">
                        <GitCompare className="h-4 w-4 text-muted-foreground" />
                        <h4 className="text-sm font-medium">
                           Comparação com Período Anterior
                        </h4>
                     </div>
                     <div className="space-y-4 pl-6">
                        <SwitchField
                           checked={showComparisonOverlay}
                           id="show-comparison-overlay"
                           label="Mostrar sobreposição de período anterior"
                           onCheckedChange={setShowComparisonOverlay}
                        />
                        {showComparisonOverlay && (
                           <>
                              <div>
                                 <Label className="text-sm font-normal mb-2 block">
                                    Comparar com
                                 </Label>
                                 <ToggleGroup
                                    className="w-full grid grid-cols-2"
                                    onValueChange={(value) =>
                                       value &&
                                       setComparisonOverlayType(
                                          value as
                                             | "previous_period"
                                             | "previous_year",
                                       )
                                    }
                                    type="single"
                                    value={comparisonOverlayType}
                                    variant="outline"
                                 >
                                    <ToggleGroupItem value="previous_period">
                                       Período Anterior
                                    </ToggleGroupItem>
                                    <ToggleGroupItem value="previous_year">
                                       Ano Anterior
                                    </ToggleGroupItem>
                                 </ToggleGroup>
                              </div>
                              <div>
                                 <Label className="text-sm font-normal mb-2 block">
                                    Estilo da linha
                                 </Label>
                                 <ToggleGroup
                                    className="w-full grid grid-cols-3"
                                    onValueChange={(value) =>
                                       value &&
                                       setComparisonOverlayStyle(
                                          value as
                                             | "dashed"
                                             | "dotted"
                                             | "solid",
                                       )
                                    }
                                    type="single"
                                    value={comparisonOverlayStyle}
                                    variant="outline"
                                 >
                                    <ToggleGroupItem value="dashed">
                                       Tracejada
                                    </ToggleGroupItem>
                                    <ToggleGroupItem value="dotted">
                                       Pontilhada
                                    </ToggleGroupItem>
                                    <ToggleGroupItem value="solid">
                                       Sólida
                                    </ToggleGroupItem>
                                 </ToggleGroup>
                              </div>
                           </>
                        )}
                     </div>
                  </section>
               )}

               {/* Forecast/Prediction (for line/area charts) */}
               {(config.chartType === "line" ||
                  config.chartType === "area") && (
                  <section className="space-y-4">
                     <div className="flex items-center gap-2 pb-2 border-b">
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        <h4 className="text-sm font-medium">
                           Previsão de Gastos
                        </h4>
                     </div>
                     <div className="space-y-4 pl-6">
                        <SwitchField
                           checked={showForecast}
                           id="show-forecast"
                           label="Mostrar previsão futura"
                           onCheckedChange={setShowForecast}
                        />
                        {showForecast && (
                           <>
                              <div>
                                 <Label className="text-sm font-normal mb-2 block">
                                    Modelo de previsão
                                 </Label>
                                 <ToggleGroup
                                    className="w-full grid grid-cols-3"
                                    onValueChange={(value) =>
                                       value &&
                                       setForecastModel(
                                          value as
                                             | "linear"
                                             | "moving_average"
                                             | "exponential_smoothing",
                                       )
                                    }
                                    type="single"
                                    value={forecastModel}
                                    variant="outline"
                                 >
                                    <ToggleGroupItem value="linear">
                                       Linear
                                    </ToggleGroupItem>
                                    <ToggleGroupItem value="moving_average">
                                       Média Móvel
                                    </ToggleGroupItem>
                                    <ToggleGroupItem value="exponential_smoothing">
                                       Suavização
                                    </ToggleGroupItem>
                                 </ToggleGroup>
                              </div>
                              <Field>
                                 <Label className="text-sm font-normal">
                                    Períodos a prever
                                 </Label>
                                 <Select
                                    onValueChange={(v) =>
                                       setForecastPeriods(Number(v))
                                    }
                                    value={String(forecastPeriods)}
                                 >
                                    <SelectTrigger className="h-10">
                                       <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                       <SelectItem value="1">
                                          1 período
                                       </SelectItem>
                                       <SelectItem value="2">
                                          2 períodos
                                       </SelectItem>
                                       <SelectItem value="3">
                                          3 períodos
                                       </SelectItem>
                                       <SelectItem value="5">
                                          5 períodos
                                       </SelectItem>
                                       <SelectItem value="7">
                                          7 períodos
                                       </SelectItem>
                                    </SelectContent>
                                 </Select>
                              </Field>
                              <SwitchField
                                 checked={forecastShowConfidence}
                                 id="forecast-confidence"
                                 label="Mostrar intervalo de confiança"
                                 onCheckedChange={setForecastShowConfidence}
                              />
                           </>
                        )}
                     </div>
                  </section>
               )}

               {/* Sparkline Options (for stat_card) */}
               {config.chartType === "stat_card" && (
                  <section className="space-y-4">
                     <div className="flex items-center gap-2 pb-2 border-b">
                        <Sparkles className="h-4 w-4 text-muted-foreground" />
                        <h4 className="text-sm font-medium">Mini Gráfico</h4>
                     </div>
                     <div className="space-y-4 pl-6">
                        <SwitchField
                           checked={showSparkline}
                           id="show-sparkline"
                           label="Mostrar mini gráfico de tendência"
                           onCheckedChange={setShowSparkline}
                        />
                        {showSparkline && (
                           <>
                              <div>
                                 <Label className="text-sm font-normal mb-2 block">
                                    Tipo do mini gráfico
                                 </Label>
                                 <ToggleGroup
                                    className="w-full grid grid-cols-3"
                                    onValueChange={(value) =>
                                       value &&
                                       setSparklineType(
                                          value as "sparkline" | "area" | "bar",
                                       )
                                    }
                                    type="single"
                                    value={sparklineType}
                                    variant="outline"
                                 >
                                    <ToggleGroupItem value="sparkline">
                                       Linha
                                    </ToggleGroupItem>
                                    <ToggleGroupItem value="area">
                                       Área
                                    </ToggleGroupItem>
                                    <ToggleGroupItem value="bar">
                                       Barras
                                    </ToggleGroupItem>
                                 </ToggleGroup>
                              </div>
                              <SwitchField
                                 checked={sparklineShowTrend}
                                 id="sparkline-trend"
                                 label="Colorir baseado na tendência"
                                 onCheckedChange={setSparklineShowTrend}
                              />
                           </>
                        )}
                     </div>
                  </section>
               )}
            </div>
         </CredenzaBody>
         <CredenzaFooter>
            <Button onClick={handleCancel} variant="outline">
               Cancelar
            </Button>
            <Button onClick={handleApply}>Aplicar</Button>
         </CredenzaFooter>
      </>
   );
}

type SwitchFieldProps = {
   id: string;
   label: string;
   checked: boolean;
   onCheckedChange: (checked: boolean) => void;
};

function SwitchField({
   id,
   label,
   checked,
   onCheckedChange,
}: SwitchFieldProps) {
   return (
      <div className="flex items-center justify-between gap-4">
         <Label className="text-sm font-normal cursor-pointer" htmlFor={id}>
            {label}
         </Label>
         <Switch checked={checked} id={id} onCheckedChange={onCheckedChange} />
      </div>
   );
}
