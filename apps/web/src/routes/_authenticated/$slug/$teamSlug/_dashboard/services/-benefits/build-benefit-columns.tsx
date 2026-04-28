import { Button } from "@packages/ui/components/button";
import { Combobox } from "@packages/ui/components/combobox";
import { Switch } from "@packages/ui/components/switch";
import {
   Tooltip,
   TooltipContent,
   TooltipTrigger,
} from "@packages/ui/components/tooltip";
import type { ColumnDef } from "@tanstack/react-table";
import { Lock, X } from "lucide-react";
import { z } from "zod";
import type { Outputs } from "@/integrations/orpc/client";
import {
   BENEFIT_TYPE_ICON,
   buildBenefitTypeOptions,
   type BenefitTypeKey,
} from "./labels";

export type BenefitRow = Outputs["benefits"]["getBenefits"][number];

export interface BuildBenefitColumnsArgs {
   meterOptions: Array<{ label: string; value: string }>;
   onSaveCell: (
      rowId: string,
      field:
         | "name"
         | "type"
         | "creditAmount"
         | "meterId"
         | "rollover"
         | "unitCost"
         | "isActive",
      value: unknown,
   ) => Promise<void>;
   onCreateMeter?: (name: string) => Promise<string>;
   onDetach?: (row: BenefitRow) => void;
   includeUsedInServices?: boolean;
   includeCostPerCycle?: boolean;
}

const TYPE_OPTIONS = buildBenefitTypeOptions();

function NotApplicable({ hint }: { hint: string }) {
   return (
      <Tooltip>
         <TooltipTrigger asChild>
            <button
               aria-label={hint}
               className="-mx-4 -my-2 flex cursor-not-allowed select-none items-center bg-muted/40 px-4 py-2 text-muted-foreground/40"
               type="button"
            >
               <Lock className="size-3.5" />
            </button>
         </TooltipTrigger>
         <TooltipContent>{hint}</TooltipContent>
      </Tooltip>
   );
}

export function buildBenefitColumns({
   meterOptions,
   onSaveCell,
   onCreateMeter,
   onDetach,
   includeUsedInServices = true,
   includeCostPerCycle = false,
}: BuildBenefitColumnsArgs): ColumnDef<BenefitRow>[] {
   const cols: ColumnDef<BenefitRow>[] = [
      {
         accessorKey: "isActive",
         header: "Ativo",
         meta: { label: "Ativo" },
         cell: ({ row }) => (
            <Switch
               aria-label="Ativar benefício"
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
         accessorKey: "type",
         header: "Tipo",
         meta: { label: "Tipo" },
         cell: ({ row }) => {
            const locked = row.original.usedInServices > 0;
            const renderWithIcon = (opt: { value: string; label: string }) => {
               const Icon = BENEFIT_TYPE_ICON[opt.value as BenefitTypeKey];
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
                  disabled={locked}
                  options={TYPE_OPTIONS}
                  placeholder="Selecionar..."
                  renderOption={renderWithIcon}
                  renderSelected={renderWithIcon}
                  searchPlaceholder="Buscar tipo..."
                  value={row.original.type}
                  onValueChange={(v) => onSaveCell(row.original.id, "type", v)}
               />
            );
         },
      },
      {
         accessorKey: "creditAmount",
         header: "Quantidade",
         meta: {
            label: "Quantidade",
            isEditable: true,
            cellComponent: "numeric",
            editMode: "inline",
            isEditableForRow: (row: BenefitRow) => row.type === "credits",
            editSchema: z
               .string()
               .refine(
                  (v) =>
                     v === "" ||
                     (Number.isInteger(Number(v)) && Number(v) >= 1),
                  "Mínimo 1.",
               ),
            onSave: (rowId, value) => {
               const str = String(value ?? "");
               const parsed = str === "" ? null : Number.parseInt(str, 10);
               return onSaveCell(rowId, "creditAmount", parsed);
            },
         },
         cell: ({ row }) => {
            if (row.original.type !== "credits")
               return (
                  <NotApplicable hint="Disponível só para benefícios de Créditos." />
               );
            return row.original.creditAmount ? (
               <span className="tabular-nums">
                  {row.original.creditAmount.toLocaleString("pt-BR")}
               </span>
            ) : (
               <span className="text-muted-foreground/40">—</span>
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
            isEditableForRow: (row: BenefitRow) => row.type === "credits",
            onSave: (rowId, value) =>
               onSaveCell(rowId, "meterId", value || null),
            onCreateOption: onCreateMeter,
         },
         cell: ({ row }) => {
            if (row.original.type !== "credits")
               return (
                  <NotApplicable hint="Disponível só para benefícios de Créditos." />
               );
            const id = row.original.meterId;
            if (!id) return <span className="text-muted-foreground/40">—</span>;
            const opt = meterOptions.find((o) => o.value === id);
            return <span className="text-sm">{opt?.label ?? "—"}</span>;
         },
      },
      {
         accessorKey: "rollover",
         header: "Acumula",
         meta: { label: "Acumula" },
         cell: ({ row }) =>
            row.original.type === "credits" ? (
               <Switch
                  aria-label="Acumular créditos não usados"
                  checked={row.original.rollover}
                  onCheckedChange={(v) =>
                     onSaveCell(row.original.id, "rollover", v)
                  }
               />
            ) : (
               <NotApplicable hint="Disponível só para benefícios de Créditos." />
            ),
      },
      {
         accessorKey: "unitCost",
         header: "Custo unit.",
         meta: {
            label: "Custo unit.",
            isEditable: true,
            cellComponent: "money",
            editMode: "inline",
            onSave: (rowId, value) => {
               const n = Number(value);
               const safe = Number.isFinite(n) ? n.toFixed(4) : "0";
               return onSaveCell(rowId, "unitCost", safe);
            },
         },
         cell: ({ row }) => {
            const v = Number(row.original.unitCost);
            if (v === 0)
               return <span className="text-muted-foreground/40">—</span>;
            return (
               <span className="tabular-nums">
                  R${" "}
                  {v.toLocaleString("pt-BR", {
                     minimumFractionDigits: 2,
                     maximumFractionDigits: 4,
                  })}
               </span>
            );
         },
      },
   ];

   if (includeUsedInServices) {
      cols.push({
         accessorKey: "usedInServices",
         header: "Em uso",
         meta: { label: "Em uso" },
         cell: ({ row }) => (
            <span className="tabular-nums text-muted-foreground">
               {row.original.usedInServices} serviços
            </span>
         ),
      });
   }

   if (includeCostPerCycle) {
      cols.push({
         id: "costPerCycle",
         header: "Custo / ciclo",
         meta: { label: "Custo / ciclo" },
         cell: ({ row }) => {
            const qty = row.original.creditAmount ?? 1;
            const cost = Number(row.original.unitCost) * qty;
            return (
               <span className="tabular-nums">
                  R${" "}
                  {cost.toLocaleString("pt-BR", {
                     minimumFractionDigits: 2,
                     maximumFractionDigits: 4,
                  })}
               </span>
            );
         },
      });
   }

   if (onDetach) {
      cols.push({
         id: "detach",
         header: "",
         cell: ({ row }) => (
            <Button
               className="text-destructive hover:text-destructive"
               onClick={() => onDetach(row.original)}
               size="icon-sm"
               tooltip="Desvincular"
               variant="ghost"
            >
               <X />
               <span className="sr-only">Desvincular</span>
            </Button>
         ),
      });
   }

   return cols;
}
