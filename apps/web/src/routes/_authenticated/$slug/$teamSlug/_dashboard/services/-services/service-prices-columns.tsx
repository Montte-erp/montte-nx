import { Badge } from "@packages/ui/components/badge";
import { Switch } from "@packages/ui/components/switch";
import {
   Tooltip,
   TooltipContent,
   TooltipTrigger,
} from "@packages/ui/components/tooltip";
import { format, of } from "@f-o-t/money";
import type { ColumnDef } from "@tanstack/react-table";
import { Lock } from "lucide-react";
import { z } from "zod";
import type { Outputs } from "@/integrations/orpc/client";

export type ServicePrice = Outputs["prices"]["list"][number];

export const PRICING_TYPE_LABEL: Record<ServicePrice["type"], string> = {
   flat: "Fixo",
   per_unit: "Por unidade",
   metered: "Medido",
};

export const INTERVAL_LABEL: Record<ServicePrice["interval"], string> = {
   hourly: "Por hora",
   shift: "Por turno",
   daily: "Diária",
   weekly: "Semanal",
   monthly: "Mensal",
   semestral: "Semestral",
   annual: "Anual",
   one_time: "Único",
};

const TYPE_OPTIONS = (
   Object.keys(PRICING_TYPE_LABEL) as ServicePrice["type"][]
).map((value) => ({ value, label: PRICING_TYPE_LABEL[value] }));

const INTERVAL_OPTIONS = (
   Object.keys(INTERVAL_LABEL) as ServicePrice["interval"][]
).map((value) => ({ value, label: INTERVAL_LABEL[value] }));

export type PriceField =
   | "name"
   | "type"
   | "interval"
   | "basePrice"
   | "meterId"
   | "minPrice"
   | "priceCap"
   | "trialDays"
   | "autoEnroll"
   | "isActive";

export interface BuildPriceColumnsArgs {
   meters: { id: string; name: string }[];
   onSaveCell: (
      rowId: string,
      field: PriceField,
      value: unknown,
   ) => Promise<void>;
}

const nameSchema = z.string().min(1, "Nome obrigatório.").max(120);
const moneyStringSchema = z
   .string()
   .regex(/^\d+(\.\d{1,2})?$/, "Use formato 0.00")
   .refine((v) => Number(v) >= 0, "Valor negativo.");

function NotApplicable({ hint }: { hint: string }) {
   return (
      <Tooltip>
         <TooltipTrigger asChild>
            <div className="-mx-4 -my-2 flex cursor-not-allowed select-none items-center bg-muted/40 px-4 py-2 text-muted-foreground/40">
               <Lock className="size-3.5" />
            </div>
         </TooltipTrigger>
         <TooltipContent>{hint}</TooltipContent>
      </Tooltip>
   );
}

export function buildPriceColumns({
   meters,
   onSaveCell,
}: BuildPriceColumnsArgs): ColumnDef<ServicePrice>[] {
   const meterOptions = meters.map((m) => ({ value: m.id, label: m.name }));
   const meterNameById = meters.reduce<Record<string, string>>((acc, m) => {
      acc[m.id] = m.name;
      return acc;
   }, {});

   return [
      {
         accessorKey: "isActive",
         header: "Ativo",
         meta: { label: "Ativo" },
         cell: ({ row }) => (
            <Switch
               aria-label="Ativar preço"
               checked={row.original.isActive}
               onCheckedChange={(v) =>
                  onSaveCell(row.original.id, "isActive", v)
               }
            />
         ),
      },
      {
         accessorKey: "name",
         header: "Nome",
         meta: {
            label: "Nome",
            isEditable: true,
            cellComponent: "text",
            editMode: "inline",
            editSchema: nameSchema,
            onSave: (rowId, value) => onSaveCell(rowId, "name", String(value)),
         },
         cell: ({ row }) => (
            <span className="font-medium">{row.original.name}</span>
         ),
      },
      {
         accessorKey: "type",
         header: "Modelo",
         meta: {
            label: "Modelo",
            isEditable: true,
            cellComponent: "combobox",
            editMode: "inline",
            editOptions: TYPE_OPTIONS,
            onSave: (rowId, value) => onSaveCell(rowId, "type", value),
         },
         cell: ({ row }) => (
            <Badge variant="outline">
               {PRICING_TYPE_LABEL[row.original.type]}
            </Badge>
         ),
      },
      {
         accessorKey: "interval",
         header: "Intervalo",
         meta: {
            label: "Intervalo",
            isEditable: true,
            cellComponent: "combobox",
            editMode: "inline",
            editOptions: INTERVAL_OPTIONS,
            onSave: (rowId, value) => onSaveCell(rowId, "interval", value),
         },
         cell: ({ row }) => INTERVAL_LABEL[row.original.interval],
      },
      {
         accessorKey: "basePrice",
         header: "Valor",
         meta: {
            label: "Valor",
            align: "right" as const,
            isEditable: true,
            cellComponent: "money",
            editMode: "inline",
            editSchema: moneyStringSchema,
            isEditableForRow: (row: ServicePrice) => row.type !== "metered",
            onSave: (rowId, value) => onSaveCell(rowId, "basePrice", value),
         },
         cell: ({ row }) => {
            const p = row.original;
            if (p.type === "metered")
               return <NotApplicable hint="Metered usa o medidor." />;
            return (
               <span className="tabular-nums font-medium">
                  {format(of(p.basePrice, "BRL"), "pt-BR")}
               </span>
            );
         },
      },
      {
         accessorKey: "meterId",
         header: "Medidor",
         meta: {
            label: "Medidor",
            isEditable: true,
            cellComponent: "combobox",
            editMode: "inline",
            editOptions: meterOptions,
            isEditableForRow: (row: ServicePrice) => row.type === "metered",
            onSave: (rowId, value) =>
               onSaveCell(rowId, "meterId", value || null),
         },
         cell: ({ row }) => {
            const p = row.original;
            if (p.type !== "metered")
               return <NotApplicable hint="Apenas para preços medidos." />;
            if (!p.meterId)
               return <span className="text-muted-foreground/60">—</span>;
            return (
               <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                  {meterNameById[p.meterId] ?? "—"}
               </code>
            );
         },
      },
      {
         accessorKey: "minPrice",
         header: "Piso",
         meta: {
            label: "Piso",
            align: "right" as const,
            isEditable: true,
            cellComponent: "money",
            editMode: "inline",
            onSave: (rowId, value) => {
               const v = String(value ?? "").trim();
               return onSaveCell(rowId, "minPrice", v === "" ? null : v);
            },
         },
         cell: ({ row }) => {
            const v = row.original.minPrice;
            if (!v) return <span className="text-muted-foreground/40">—</span>;
            return (
               <span className="tabular-nums">
                  {format(of(v, "BRL"), "pt-BR")}
               </span>
            );
         },
      },
      {
         accessorKey: "priceCap",
         header: "Teto",
         meta: {
            label: "Teto",
            align: "right" as const,
            isEditable: true,
            cellComponent: "money",
            editMode: "inline",
            onSave: (rowId, value) => {
               const v = String(value ?? "").trim();
               return onSaveCell(rowId, "priceCap", v === "" ? null : v);
            },
         },
         cell: ({ row }) => {
            const v = row.original.priceCap;
            if (!v) return <span className="text-muted-foreground/40">—</span>;
            return (
               <span className="tabular-nums">
                  {format(of(v, "BRL"), "pt-BR")}
               </span>
            );
         },
      },
      {
         accessorKey: "trialDays",
         header: "Trial (dias)",
         meta: {
            label: "Trial (dias)",
            align: "right" as const,
            isEditable: true,
            cellComponent: "numeric",
            editMode: "inline",
            isEditableForRow: (row: ServicePrice) =>
               row.interval !== "one_time",
            onSave: (rowId, value) => {
               const s = String(value ?? "").trim();
               if (s === "") return onSaveCell(rowId, "trialDays", null);
               const n = Number.parseInt(s, 10);
               return onSaveCell(
                  rowId,
                  "trialDays",
                  Number.isNaN(n) ? null : n,
               );
            },
         },
         cell: ({ row }) => {
            const p = row.original;
            if (p.interval === "one_time")
               return <NotApplicable hint="Não se aplica para Único." />;
            const v = p.trialDays;
            if (!v) return <span className="text-muted-foreground/40">—</span>;
            return <span className="tabular-nums">{v}</span>;
         },
      },
      {
         accessorKey: "autoEnroll",
         header: "Auto-enroll",
         meta: { label: "Auto-enroll" },
         cell: ({ row }) => {
            const p = row.original;
            if (p.interval === "one_time")
               return <NotApplicable hint="Não se aplica para Único." />;
            return (
               <Switch
                  aria-label="Auto-enroll"
                  checked={p.autoEnroll}
                  onCheckedChange={(v) => onSaveCell(p.id, "autoEnroll", v)}
               />
            );
         },
      },
   ];
}
