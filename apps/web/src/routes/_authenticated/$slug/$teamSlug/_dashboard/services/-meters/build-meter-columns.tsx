import { Button } from "@packages/ui/components/button";
import { Combobox } from "@packages/ui/components/combobox";
import { Switch } from "@packages/ui/components/switch";
import {
   Tooltip,
   TooltipContent,
   TooltipTrigger,
} from "@packages/ui/components/tooltip";
import type { ColumnDef } from "@tanstack/react-table";
import { Lock, Trash2 } from "lucide-react";
import { z } from "zod";
import type { Outputs } from "@/integrations/orpc/client";
import {
   AGG_ICON,
   buildAggregationOptions,
   type MeterAggregationKey,
} from "./labels";
import { RateCell } from "./rate-cell";

export type MeterRow = Outputs["meters"]["getMeters"][number];

export interface BuildMeterColumnsArgs {
   onSaveCell: (
      rowId: string,
      field:
         | "name"
         | "eventName"
         | "aggregation"
         | "aggregationProperty"
         | "unitCost"
         | "isActive",
      value: unknown,
   ) => Promise<void>;
   onDelete?: (row: MeterRow) => void;
   includeUsedIn?: boolean;
}

const AGG_OPTIONS = buildAggregationOptions();

const eventSlugSchema = z
   .string()
   .min(1, "Identificador obrigatório.")
   .regex(
      /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/,
      "Use a-z, 0-9, _ ou . — ex: ai.chat.",
   );

const propertyKeySchema = z
   .string()
   .regex(/^[a-z][a-z0-9_]*$/, "Use a-z, 0-9, _ — ex: tokens.");

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

export function buildMeterColumns({
   onSaveCell,
   onDelete,
   includeUsedIn = true,
}: BuildMeterColumnsArgs): ColumnDef<MeterRow>[] {
   const cols: ColumnDef<MeterRow>[] = [
      {
         accessorKey: "isActive",
         header: "Ativo",
         meta: { label: "Ativo" },
         cell: ({ row }) => (
            <Switch
               aria-label="Ativar medidor"
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
            editSchema: z.string().min(2, "Mínimo 2 caracteres."),
            onSave: (rowId, value) => onSaveCell(rowId, "name", String(value)),
         },
         cell: ({ row }) => (
            <span className="font-medium">{row.original.name}</span>
         ),
      },
      {
         accessorKey: "eventName",
         header: "Evento",
         meta: {
            label: "Evento",
            isEditable: true,
            cellComponent: "text",
            editMode: "inline",
            editSchema: eventSlugSchema,
            onSave: (rowId, value) =>
               onSaveCell(rowId, "eventName", String(value).toLowerCase()),
         },
         cell: ({ row }) => (
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
               {row.original.eventName}
            </code>
         ),
      },
      {
         accessorKey: "aggregation",
         header: "Como contar",
         meta: { label: "Como contar" },
         cell: ({ row }) => {
            const renderWithIcon = (opt: { value: string; label: string }) => {
               const Icon = AGG_ICON[opt.value as MeterAggregationKey];
               return (
                  <span className="inline-flex items-center gap-2">
                     <Icon className="size-4 text-muted-foreground" />
                     {opt.label}
                  </span>
               );
            };
            return (
               <Combobox
                  className="h-7 w-full justify-between"
                  options={AGG_OPTIONS}
                  placeholder="Selecionar..."
                  renderOption={renderWithIcon}
                  renderSelected={renderWithIcon}
                  searchPlaceholder="Buscar..."
                  value={row.original.aggregation}
                  onValueChange={(v) =>
                     onSaveCell(row.original.id, "aggregation", v)
                  }
               />
            );
         },
      },
      {
         accessorKey: "aggregationProperty",
         header: "Campo numérico",
         meta: {
            label: "Campo numérico",
            isEditable: true,
            cellComponent: "text",
            editMode: "inline",
            editSchema: propertyKeySchema,
            isEditableForRow: (row: MeterRow) => row.aggregation !== "count",
            onSave: (rowId, value) => {
               const v = String(value ?? "").trim();
               return onSaveCell(rowId, "aggregationProperty", v || null);
            },
         },
         cell: ({ row }) => {
            if (row.original.aggregation === "count")
               return <NotApplicable hint="Não se aplica para Contagem." />;
            const v = row.original.aggregationProperty;
            if (!v) return <span className="text-muted-foreground/40">—</span>;
            return (
               <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                  {v}
               </code>
            );
         },
      },
      {
         accessorKey: "unitCost",
         header: "Preço",
         meta: { label: "Preço" },
         cell: ({ row }) => (
            <RateCell
               unitCost={row.original.unitCost}
               onSave={(v) => onSaveCell(row.original.id, "unitCost", v)}
            />
         ),
      },
   ];

   if (includeUsedIn) {
      cols.push({
         accessorKey: "usedIn",
         header: "Em uso",
         meta: { label: "Em uso" },
         cell: ({ row }) => (
            <span className="tabular-nums text-muted-foreground">
               {row.original.usedIn} vínculos
            </span>
         ),
      });
   }

   if (onDelete) {
      cols.push({
         id: "delete",
         header: "",
         cell: ({ row }) => (
            <Button
               className="text-destructive hover:text-destructive"
               onClick={() => onDelete(row.original)}
               size="icon-sm"
               tooltip="Excluir"
               variant="ghost"
            >
               <Trash2 />
               <span className="sr-only">Excluir</span>
            </Button>
         ),
      });
   }

   return cols;
}
