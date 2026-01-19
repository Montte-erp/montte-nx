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
import { BarChart, Eye, Palette, Sparkles, Tag, Trophy } from "lucide-react";
import type { ChartType } from "../config-search-index";

const Y_AXIS_UNITS = [
   { value: "none", label: "Nenhuma" },
   { value: "currency", label: "Moeda" },
   { value: "percentage", label: "Percentual" },
   { value: "number", label: "Numero" },
];

type ChartOptionsSectionProps = {
   chartType: ChartType;
   showLabels: boolean;
   showLegend: boolean;
   showAlertThresholdLines: boolean;
   showMultipleYAxes: boolean;
   showTrendLine: boolean;
   colorBy: "name" | "rank";
   yAxisUnit: string;
   yAxisScale: "linear" | "logarithmic";
   showSparkline: boolean;
   sparklineType: "sparkline" | "area" | "bar";
   sparklineShowTrend: boolean;
   onShowLabelsChange: (value: boolean) => void;
   onShowLegendChange: (value: boolean) => void;
   onShowAlertThresholdLinesChange: (value: boolean) => void;
   onShowMultipleYAxesChange: (value: boolean) => void;
   onShowTrendLineChange: (value: boolean) => void;
   onColorByChange: (value: "name" | "rank") => void;
   onYAxisUnitChange: (value: string) => void;
   onYAxisScaleChange: (value: "linear" | "logarithmic") => void;
   onShowSparklineChange: (value: boolean) => void;
   onSparklineTypeChange: (value: "sparkline" | "area" | "bar") => void;
   onSparklineShowTrendChange: (value: boolean) => void;
};

export function ChartOptionsSection({
   chartType,
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
   onShowLabelsChange,
   onShowLegendChange,
   onShowAlertThresholdLinesChange,
   onShowMultipleYAxesChange,
   onShowTrendLineChange,
   onColorByChange,
   onYAxisUnitChange,
   onYAxisScaleChange,
   onShowSparklineChange,
   onSparklineTypeChange,
   onSparklineShowTrendChange,
}: ChartOptionsSectionProps) {
   const isStatCard = chartType === "stat_card";

   return (
      <div className="space-y-6">
         {/* Display Settings */}
         <section className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b">
               <Eye className="h-4 w-4 text-muted-foreground" />
               <h4 className="text-sm font-medium">
                  Configuracoes de Exibicao
               </h4>
            </div>
            <div className="space-y-4 pl-6">
               <SwitchField
                  checked={showLabels}
                  id="show-labels"
                  label="Mostrar valores na serie"
                  onCheckedChange={onShowLabelsChange}
               />
               <SwitchField
                  checked={showLegend}
                  id="show-legend"
                  label="Mostrar legenda"
                  onCheckedChange={onShowLegendChange}
               />
               <SwitchField
                  checked={showAlertThresholdLines}
                  id="show-threshold"
                  label="Mostrar linhas de limite de alerta"
                  onCheckedChange={onShowAlertThresholdLinesChange}
               />
               <SwitchField
                  checked={showMultipleYAxes}
                  id="show-multi-y-axis"
                  label="Mostrar multiplos eixos Y"
                  onCheckedChange={onShowMultipleYAxesChange}
               />
               <SwitchField
                  checked={showTrendLine}
                  id="show-trend-line"
                  label="Mostrar linha de tendencia"
                  onCheckedChange={onShowTrendLineChange}
               />
            </div>
         </section>

         {/* Color Customization */}
         <section className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b">
               <Palette className="h-4 w-4 text-muted-foreground" />
               <h4 className="text-sm font-medium">Personalizacao de Cores</h4>
            </div>
            <ToggleGroup
               className="w-full grid grid-cols-2"
               onValueChange={(value) =>
                  value && onColorByChange(value as "name" | "rank")
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
                  Por classificacao
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
                  <Select onValueChange={onYAxisUnitChange} value={yAxisUnit}>
                     <SelectTrigger className="h-10">
                        <SelectValue />
                     </SelectTrigger>
                     <SelectContent>
                        {Y_AXIS_UNITS.map((unit) => (
                           <SelectItem key={unit.value} value={unit.value}>
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
                        onYAxisScaleChange(value as "linear" | "logarithmic")
                     }
                     type="single"
                     value={yAxisScale}
                     variant="outline"
                  >
                     <ToggleGroupItem value="linear">Linear</ToggleGroupItem>
                     <ToggleGroupItem value="logarithmic">
                        Logaritmica
                     </ToggleGroupItem>
                  </ToggleGroup>
               </div>
            </div>
         </section>

         {/* Sparkline Options (for stat_card) */}
         {isStatCard && (
            <section className="space-y-4">
               <div className="flex items-center gap-2 pb-2 border-b">
                  <Sparkles className="h-4 w-4 text-muted-foreground" />
                  <h4 className="text-sm font-medium">Mini Grafico</h4>
               </div>
               <div className="space-y-4 pl-6">
                  <SwitchField
                     checked={showSparkline}
                     id="show-sparkline"
                     label="Mostrar mini grafico de tendencia"
                     onCheckedChange={onShowSparklineChange}
                  />
                  {showSparkline && (
                     <>
                        <div>
                           <Label className="text-sm font-normal mb-2 block">
                              Tipo do mini grafico
                           </Label>
                           <ToggleGroup
                              className="w-full grid grid-cols-3"
                              onValueChange={(value) =>
                                 value &&
                                 onSparklineTypeChange(
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
                                 Area
                              </ToggleGroupItem>
                              <ToggleGroupItem value="bar">
                                 Barras
                              </ToggleGroupItem>
                           </ToggleGroup>
                        </div>
                        <SwitchField
                           checked={sparklineShowTrend}
                           id="sparkline-trend"
                           label="Colorir baseado na tendencia"
                           onCheckedChange={onSparklineShowTrendChange}
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
