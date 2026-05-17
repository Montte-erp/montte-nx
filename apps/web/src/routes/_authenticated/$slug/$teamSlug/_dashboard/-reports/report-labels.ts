import {
   CalendarClock,
   LineChart,
   PieChart,
   ReceiptText,
   Tags,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Outputs } from "@/integrations/orpc/client";

export type SavedReport = Outputs["reports"]["list"][number];
export type ReportType = SavedReport["type"];

export const REPORT_LABELS: Record<
   ReportType,
   { label: string; icon: LucideIcon }
> = {
   dre: { label: "Resultado / DRE", icon: ReceiptText },
   "cash-flow": { label: "Fluxo de caixa", icon: LineChart },
   "cost-centers": { label: "Centro de Custo", icon: Tags },
   aging: { label: "A receber / pagar", icon: CalendarClock },
   categories: { label: "Despesas por categoria", icon: PieChart },
};
