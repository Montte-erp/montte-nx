import { ArrowDown10, Hash, Sigma, TrendingUp, Clock } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type MeterAggregationKey =
   | "sum"
   | "count"
   | "count_unique"
   | "max"
   | "last";

export const AGG_LABEL: Record<MeterAggregationKey, string> = {
   sum: "Soma",
   count: "Contagem",
   count_unique: "Contagem única",
   max: "Máximo",
   last: "Último",
};

export const AGG_ICON: Record<MeterAggregationKey, LucideIcon> = {
   sum: Sigma,
   count: Hash,
   count_unique: ArrowDown10,
   max: TrendingUp,
   last: Clock,
};

export const AGG_HELPER: Record<MeterAggregationKey, string> = {
   sum: "Soma o valor de uma propriedade. Ex: tokens consumidos, minutos de sala.",
   count: "Conta cada evento. Ex: chamadas de API, impressões emitidas.",
   count_unique:
      "Conta valores distintos de uma propriedade. Ex: usuários únicos, salas distintas.",
   max: "Maior valor observado no ciclo. Ex: pico de armazenamento.",
   last: "Último valor registrado no ciclo. Ex: snapshot final de assentos.",
};

export function buildAggregationOptions() {
   return (Object.keys(AGG_LABEL) as MeterAggregationKey[]).map((key) => ({
      label: AGG_LABEL[key],
      value: key,
   }));
}
