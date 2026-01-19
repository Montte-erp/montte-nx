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
import { BarChart, GitCompare, TrendingUp } from "lucide-react";
import type { ChartType } from "../config-search-index";

type AdvancedSectionProps = {
   chartType: ChartType;
   showConfidenceIntervals: boolean;
   showMovingAverage: boolean;
   showComparisonOverlay: boolean;
   comparisonOverlayType: "previous_period" | "previous_year";
   comparisonOverlayStyle: "dashed" | "dotted" | "solid";
   showForecast: boolean;
   forecastModel: "linear" | "moving_average" | "exponential_smoothing";
   forecastPeriods: number;
   forecastShowConfidence: boolean;
   onShowConfidenceIntervalsChange: (value: boolean) => void;
   onShowMovingAverageChange: (value: boolean) => void;
   onShowComparisonOverlayChange: (value: boolean) => void;
   onComparisonOverlayTypeChange: (
      value: "previous_period" | "previous_year",
   ) => void;
   onComparisonOverlayStyleChange: (
      value: "dashed" | "dotted" | "solid",
   ) => void;
   onShowForecastChange: (value: boolean) => void;
   onForecastModelChange: (
      value: "linear" | "moving_average" | "exponential_smoothing",
   ) => void;
   onForecastPeriodsChange: (value: number) => void;
   onForecastShowConfidenceChange: (value: boolean) => void;
};

export function AdvancedSection({
   chartType,
   showConfidenceIntervals,
   showMovingAverage,
   showComparisonOverlay,
   comparisonOverlayType,
   comparisonOverlayStyle,
   showForecast,
   forecastModel,
   forecastPeriods,
   forecastShowConfidence,
   onShowConfidenceIntervalsChange,
   onShowMovingAverageChange,
   onShowComparisonOverlayChange,
   onComparisonOverlayTypeChange,
   onComparisonOverlayStyleChange,
   onShowForecastChange,
   onForecastModelChange,
   onForecastPeriodsChange,
   onForecastShowConfidenceChange,
}: AdvancedSectionProps) {
   const isLineOrArea = chartType === "line" || chartType === "area";

   return (
      <div className="space-y-6">
         {/* Statistical Analysis */}
         <section className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b">
               <BarChart className="h-4 w-4 text-muted-foreground" />
               <h4 className="text-sm font-medium">Analise Estatistica</h4>
            </div>
            <div className="space-y-4 pl-6">
               <SwitchField
                  checked={showConfidenceIntervals}
                  id="show-confidence"
                  label="Mostrar intervalos de confianca"
                  onCheckedChange={onShowConfidenceIntervalsChange}
               />
               <SwitchField
                  checked={showMovingAverage}
                  id="show-moving-avg"
                  label="Mostrar media movel"
                  onCheckedChange={onShowMovingAverageChange}
               />
            </div>
         </section>

         {/* Comparison Overlay (for line/area charts) */}
         {isLineOrArea && (
            <section className="space-y-4">
               <div className="flex items-center gap-2 pb-2 border-b">
                  <GitCompare className="h-4 w-4 text-muted-foreground" />
                  <h4 className="text-sm font-medium">
                     Comparacao com Periodo Anterior
                  </h4>
               </div>
               <div className="space-y-4 pl-6">
                  <SwitchField
                     checked={showComparisonOverlay}
                     id="show-comparison-overlay"
                     label="Mostrar sobreposicao de periodo anterior"
                     onCheckedChange={onShowComparisonOverlayChange}
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
                                 onComparisonOverlayTypeChange(
                                    value as "previous_period" | "previous_year",
                                 )
                              }
                              type="single"
                              value={comparisonOverlayType}
                              variant="outline"
                           >
                              <ToggleGroupItem value="previous_period">
                                 Periodo Anterior
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
                                 onComparisonOverlayStyleChange(
                                    value as "dashed" | "dotted" | "solid",
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
                              <ToggleGroupItem value="solid">Solida</ToggleGroupItem>
                           </ToggleGroup>
                        </div>
                     </>
                  )}
               </div>
            </section>
         )}

         {/* Forecast/Prediction (for line/area charts) */}
         {isLineOrArea && (
            <section className="space-y-4">
               <div className="flex items-center gap-2 pb-2 border-b">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <h4 className="text-sm font-medium">Previsao de Gastos</h4>
               </div>
               <div className="space-y-4 pl-6">
                  <SwitchField
                     checked={showForecast}
                     id="show-forecast"
                     label="Mostrar previsao futura"
                     onCheckedChange={onShowForecastChange}
                  />
                  {showForecast && (
                     <>
                        <div>
                           <Label className="text-sm font-normal mb-2 block">
                              Modelo de previsao
                           </Label>
                           <ToggleGroup
                              className="w-full grid grid-cols-3"
                              onValueChange={(value) =>
                                 value &&
                                 onForecastModelChange(
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
                                 Media Movel
                              </ToggleGroupItem>
                              <ToggleGroupItem value="exponential_smoothing">
                                 Suavizacao
                              </ToggleGroupItem>
                           </ToggleGroup>
                        </div>
                        <Field>
                           <Label className="text-sm font-normal">
                              Periodos a prever
                           </Label>
                           <Select
                              onValueChange={(v) =>
                                 onForecastPeriodsChange(Number(v))
                              }
                              value={String(forecastPeriods)}
                           >
                              <SelectTrigger className="h-10">
                                 <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                 <SelectItem value="1">1 periodo</SelectItem>
                                 <SelectItem value="2">2 periodos</SelectItem>
                                 <SelectItem value="3">3 periodos</SelectItem>
                                 <SelectItem value="5">5 periodos</SelectItem>
                                 <SelectItem value="7">7 periodos</SelectItem>
                              </SelectContent>
                           </Select>
                        </Field>
                        <SwitchField
                           checked={forecastShowConfidence}
                           id="forecast-confidence"
                           label="Mostrar intervalo de confianca"
                           onCheckedChange={onForecastShowConfidenceChange}
                        />
                     </>
                  )}
               </div>
            </section>
         )}
      </div>
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
