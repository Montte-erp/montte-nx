import { Combobox } from "@packages/ui/components/combobox";
import { Switch } from "@packages/ui/components/switch";
import {
   Tooltip,
   TooltipContent,
   TooltipTrigger,
} from "@packages/ui/components/tooltip";
import type { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";
import { Lock } from "lucide-react";
import { z } from "zod";
import type { Outputs } from "@/integrations/orpc/client";
import {
   buildDirectionOptions,
   buildDurationOptions,
   buildScopeOptions,
   buildTriggerOptions,
   buildTypeOptions,
   DIRECTION_ICON,
   DIRECTION_LABEL,
   DURATION_ICON,
   DURATION_LABEL,
   SCOPE_LABEL,
   TRIGGER_ICON,
   TRIGGER_LABEL,
   TYPE_ICON,
   TYPE_LABEL,
   type CouponDirection,
   type CouponDuration,
   type CouponTrigger,
   type CouponType,
} from "./labels";

export type CouponRow = Outputs["coupons"]["list"][number];

export interface BuildCouponColumnsArgs {
   meterOptions: Array<{ label: string; value: string }>;
   onSaveCell: (
      rowId: string,
      field:
         | "code"
         | "direction"
         | "trigger"
         | "scope"
         | "meterId"
         | "type"
         | "amount"
         | "duration"
         | "durationMonths"
         | "maxUses"
         | "redeemBy"
         | "isActive",
      value: unknown,
   ) => Promise<void>;
}

const DIRECTION_OPTIONS = buildDirectionOptions();
const TRIGGER_OPTIONS = buildTriggerOptions();
const SCOPE_OPTIONS = buildScopeOptions();
const TYPE_OPTIONS = buildTypeOptions();
const DURATION_OPTIONS = buildDurationOptions();

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

export function buildCouponColumns({
   meterOptions,
   onSaveCell,
}: BuildCouponColumnsArgs): ColumnDef<CouponRow>[] {
   return [
      {
         accessorKey: "isActive",
         header: "Ativo",
         meta: { label: "Ativo" },
         cell: ({ row }) => (
            <Switch
               aria-label="Ativar cupom"
               checked={row.original.isActive}
               onCheckedChange={(v) =>
                  onSaveCell(row.original.id, "isActive", v)
               }
            />
         ),
      },
      {
         accessorKey: "code",
         header: "Código",
         meta: {
            label: "Código",
            isEditable: true,
            cellComponent: "text",
            editMode: "inline",
            editSchema: z.string().min(1, "Código obrigatório."),
            onSave: (rowId, value) => onSaveCell(rowId, "code", String(value)),
         },
         cell: ({ row }) => (
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">
               {row.original.code}
            </code>
         ),
      },
      {
         accessorKey: "direction",
         header: "Tipo",
         meta: { label: "Tipo" },
         cell: ({ row }) => {
            const renderWithIcon = (opt: { value: string; label: string }) => {
               const Icon = DIRECTION_ICON[opt.value as CouponDirection];
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
                  options={DIRECTION_OPTIONS}
                  placeholder="Selecionar..."
                  renderOption={renderWithIcon}
                  renderSelected={renderWithIcon}
                  searchPlaceholder="Buscar tipo..."
                  value={row.original.direction}
                  onValueChange={(v) =>
                     onSaveCell(row.original.id, "direction", v)
                  }
               />
            );
         },
      },
      {
         accessorKey: "type",
         header: "Forma",
         meta: { label: "Forma" },
         cell: ({ row }) => {
            const renderWithIcon = (opt: { value: string; label: string }) => {
               const Icon = TYPE_ICON[opt.value as CouponType];
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
                  options={TYPE_OPTIONS}
                  placeholder="Selecionar..."
                  renderOption={renderWithIcon}
                  renderSelected={renderWithIcon}
                  searchPlaceholder="Buscar forma..."
                  value={row.original.type}
                  onValueChange={(v) => onSaveCell(row.original.id, "type", v)}
               />
            );
         },
      },
      {
         accessorKey: "amount",
         header: "Valor",
         meta: {
            label: "Valor",
            isEditable: true,
            cellComponent: "numeric",
            editMode: "inline",
            editSchema: z
               .string()
               .refine(
                  (v) =>
                     v !== "" && Number.isFinite(Number(v)) && Number(v) > 0,
                  "Valor deve ser positivo.",
               ),
            onSave: (rowId, value) => {
               const n = Number(value);
               const safe = Number.isFinite(n) ? n.toFixed(4) : "0";
               return onSaveCell(rowId, "amount", safe);
            },
         },
         cell: ({ row }) => {
            const c = row.original;
            const v =
               c.type === "percent"
                  ? `${Number(c.amount)}%`
                  : `R$ ${Number(c.amount).toLocaleString("pt-BR", {
                       minimumFractionDigits: 2,
                       maximumFractionDigits: 4,
                    })}`;
            return <span className="tabular-nums text-sm">{v}</span>;
         },
      },
      {
         accessorKey: "trigger",
         header: "Disparo",
         meta: { label: "Disparo" },
         cell: ({ row }) => {
            const renderWithIcon = (opt: { value: string; label: string }) => {
               const Icon = TRIGGER_ICON[opt.value as CouponTrigger];
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
                  options={TRIGGER_OPTIONS}
                  placeholder="Selecionar..."
                  renderOption={renderWithIcon}
                  renderSelected={renderWithIcon}
                  searchPlaceholder="Buscar disparo..."
                  value={row.original.trigger}
                  onValueChange={(v) =>
                     onSaveCell(row.original.id, "trigger", v)
                  }
               />
            );
         },
      },
      {
         accessorKey: "scope",
         header: "Escopo",
         meta: { label: "Escopo" },
         cell: ({ row }) => (
            <Combobox
               className="h-7 w-full justify-between"
               options={SCOPE_OPTIONS}
               placeholder="Selecionar..."
               searchPlaceholder="Buscar escopo..."
               value={row.original.scope}
               onValueChange={(v) => onSaveCell(row.original.id, "scope", v)}
            />
         ),
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
            isEditableForRow: (row: CouponRow) => row.scope === "meter",
            onSave: (rowId, value) =>
               onSaveCell(rowId, "meterId", value || null),
         },
         cell: ({ row }) => {
            if (row.original.scope !== "meter")
               return (
                  <NotApplicable hint="Disponível só para escopo Medidor." />
               );
            const id = row.original.meterId;
            if (!id) return <span className="text-muted-foreground/40">—</span>;
            const opt = meterOptions.find((o) => o.value === id);
            return <span className="text-sm">{opt?.label ?? "—"}</span>;
         },
      },
      {
         accessorKey: "duration",
         header: "Duração",
         meta: { label: "Duração" },
         cell: ({ row }) => {
            const renderWithIcon = (opt: { value: string; label: string }) => {
               const Icon = DURATION_ICON[opt.value as CouponDuration];
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
                  options={DURATION_OPTIONS}
                  placeholder="Selecionar..."
                  renderOption={renderWithIcon}
                  renderSelected={renderWithIcon}
                  searchPlaceholder="Buscar duração..."
                  value={row.original.duration}
                  onValueChange={(v) =>
                     onSaveCell(row.original.id, "duration", v)
                  }
               />
            );
         },
      },
      {
         accessorKey: "durationMonths",
         header: "Meses",
         meta: {
            label: "Meses",
            isEditable: true,
            cellComponent: "numeric",
            editMode: "inline",
            isEditableForRow: (row: CouponRow) => row.duration === "repeating",
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
               return onSaveCell(rowId, "durationMonths", parsed);
            },
         },
         cell: ({ row }) => {
            if (row.original.duration !== "repeating")
               return (
                  <NotApplicable hint="Disponível só para duração Recorrente." />
               );
            return row.original.durationMonths ? (
               <span className="tabular-nums">
                  {row.original.durationMonths}
               </span>
            ) : (
               <span className="text-muted-foreground/40">—</span>
            );
         },
      },
      {
         accessorKey: "usedCount",
         header: "Usos",
         meta: { label: "Usos" },
         cell: ({ row }) => (
            <span className="tabular-nums text-xs text-muted-foreground">
               {row.original.usedCount}
               {row.original.maxUses ? ` / ${row.original.maxUses}` : ""}
            </span>
         ),
      },
      {
         accessorKey: "maxUses",
         header: "Limite",
         meta: {
            label: "Limite",
            isEditable: true,
            cellComponent: "numeric",
            editMode: "inline",
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
               return onSaveCell(rowId, "maxUses", parsed);
            },
         },
         cell: ({ row }) =>
            row.original.maxUses ? (
               <span className="tabular-nums">{row.original.maxUses}</span>
            ) : (
               <span className="text-muted-foreground/40">—</span>
            ),
      },
      {
         accessorKey: "redeemBy",
         header: "Validade",
         meta: {
            label: "Validade",
            isEditable: true,
            cellComponent: "date",
            editMode: "inline",
            onSave: (rowId, value) => {
               const str = String(value ?? "");
               return onSaveCell(
                  rowId,
                  "redeemBy",
                  str ? dayjs(str).toISOString() : null,
               );
            },
         },
         cell: ({ row }) =>
            row.original.redeemBy ? (
               <span className="text-xs">
                  {dayjs(row.original.redeemBy).format("DD/MM/YYYY")}
               </span>
            ) : (
               <span className="text-muted-foreground/40">—</span>
            ),
      },
   ];
}

export {
   DIRECTION_LABEL,
   DURATION_LABEL,
   SCOPE_LABEL,
   TRIGGER_LABEL,
   TYPE_LABEL,
};
