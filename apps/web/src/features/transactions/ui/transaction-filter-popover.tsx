import type {
   Condition,
   ConditionGroup,
   NumberCondition,
   StringCondition,
} from "@f-o-t/condition-evaluator";
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import { Combobox } from "@packages/ui/components/combobox";
import { Input } from "@packages/ui/components/input";
import { MoneyInput } from "@packages/ui/components/money-input";
import {
   Popover,
   PopoverContent,
   PopoverTrigger,
} from "@packages/ui/components/popover";
import { Separator } from "@packages/ui/components/separator";
import { Slider } from "@packages/ui/components/slider";
import { Switch } from "@packages/ui/components/switch";
import {
   ToggleGroup,
   ToggleGroupItem,
} from "@packages/ui/components/toggle-group";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Filter, Plus, Trash2 } from "lucide-react";
import { Suspense, useId, useState } from "react";
import type { z } from "zod";
import { orpc } from "@/integrations/orpc/client";

// ─────────────────────────────────────────────────────────────────────────────
// Property definitions
// ─────────────────────────────────────────────────────────────────────────────

type PropertyType = "string" | "number" | "select";
type SelectType = "category" | "bankAccount" | "creditCard" | "paymentMethod";

type PropertyDef = {
   field: string;
   label: string;
   type: PropertyType;
   selectType?: SelectType;
};

const FILTER_PROPERTIES: PropertyDef[] = [
   {
      field: "categoryId",
      label: "Categoria",
      type: "select",
      selectType: "category",
   },
   {
      field: "bankAccountId",
      label: "Conta",
      type: "select",
      selectType: "bankAccount",
   },
   {
      field: "creditCardId",
      label: "Cartão",
      type: "select",
      selectType: "creditCard",
   },
   { field: "amount", label: "Valor", type: "number" },
   { field: "name", label: "Nome", type: "string" },
   {
      field: "paymentMethod",
      label: "Forma de pagamento",
      type: "select",
      selectType: "paymentMethod" as SelectType,
   },
];

// ─────────────────────────────────────────────────────────────────────────────
// Operators
// ─────────────────────────────────────────────────────────────────────────────

const STRING_OPERATORS: Array<{
   value: z.infer<typeof StringCondition>["operator"];
   label: string;
}> = [
   { value: "contains", label: "contém" },
   { value: "not_contains", label: "não contém" },
   { value: "eq", label: "é igual a" },
   { value: "neq", label: "não é igual a" },
   { value: "starts_with", label: "começa com" },
   { value: "ends_with", label: "termina com" },
   { value: "is_empty", label: "está vazio" },
   { value: "is_not_empty", label: "não está vazio" },
];

const SELECT_OPERATORS: Array<{
   value: z.infer<typeof StringCondition>["operator"];
   label: string;
}> = [
   { value: "eq", label: "é igual a" },
   { value: "neq", label: "não é igual a" },
   { value: "is_empty", label: "está vazio" },
   { value: "is_not_empty", label: "não está vazio" },
];

const NUMBER_OPERATORS: Array<{
   value: z.infer<typeof NumberCondition>["operator"];
   label: string;
}> = [
   { value: "eq", label: "=" },
   { value: "neq", label: "≠" },
   { value: "gt", label: ">" },
   { value: "gte", label: "≥" },
   { value: "lt", label: "<" },
   { value: "lte", label: "≤" },
];

const NO_VALUE_OPERATORS = new Set(["is_empty", "is_not_empty"]);

// ─────────────────────────────────────────────────────────────────────────────
// Row state
// ─────────────────────────────────────────────────────────────────────────────

interface FilterRow {
   id: string;
   field: string;
   operator: string;
   value: string;
   weight: number;
}

function conditionToRow(c: Condition): FilterRow {
   const rawValue =
      "value" in c && c.value !== undefined && c.value !== null
         ? String(c.value)
         : "";
   const weight =
      c.options?.weight !== undefined ? Math.round(c.options.weight * 100) : 50;
   return {
      id: c.id,
      field: c.field,
      operator: c.operator as string,
      value: rawValue,
      weight,
   };
}

function rowToCondition(row: FilterRow, advanced: boolean): Condition {
   const def = FILTER_PROPERTIES.find((p) => p.field === row.field) ?? {
      type: "string" as PropertyType,
   };
   const options = advanced ? { weight: row.weight / 100 } : undefined;
   const noValue = NO_VALUE_OPERATORS.has(row.operator);

   if (def.type === "number") {
      return {
         id: row.id,
         type: "number",
         field: row.field,
         operator: row.operator as z.infer<typeof NumberCondition>["operator"],
         value: noValue || row.value === "" ? undefined : Number(row.value),
         options,
      };
   }
   return {
      id: row.id,
      type: "string",
      field: row.field,
      operator: row.operator as z.infer<typeof StringCondition>["operator"],
      value: noValue ? undefined : row.value || undefined,
      options,
   };
}

function defaultOperatorFor(_type: PropertyType): string {
   return "eq";
}

function getOperatorsFor(
   type: PropertyType,
): Array<{ value: string; label: string }> {
   if (type === "number") return NUMBER_OPERATORS;
   if (type === "select") return SELECT_OPERATORS;
   return STRING_OPERATORS;
}

// ─────────────────────────────────────────────────────────────────────────────
// Value select sub-components (Suspense-wrapped comboboxes)
// ─────────────────────────────────────────────────────────────────────────────

function CategoryValueSelectInner({
   value,
   onChange,
}: {
   value: string;
   onChange: (v: string) => void;
}) {
   const { data: categories } = useSuspenseQuery(
      orpc.categories.getAll.queryOptions({}),
   );
   const options = categories.map((c) => ({ value: c.id, label: c.name }));
   return (
      <Combobox
         className="h-7 text-xs"
         emptyMessage="Nenhuma categoria."
         onValueChange={(v) => onChange(v ?? "")}
         options={options}
         placeholder="Selecionar..."
         searchPlaceholder="Buscar..."
         value={value}
      />
   );
}

function CategoryValueSelect({
   value,
   onChange,
}: {
   value: string;
   onChange: (v: string) => void;
}) {
   return (
      <Suspense
         fallback={
            <div className="h-7 rounded-md border bg-muted/30 animate-pulse" />
         }
      >
         <CategoryValueSelectInner onChange={onChange} value={value} />
      </Suspense>
   );
}

function AccountValueSelectInner({
   value,
   onChange,
}: {
   value: string;
   onChange: (v: string) => void;
}) {
   const { data: bankAccounts } = useSuspenseQuery(
      orpc.bankAccounts.getAll.queryOptions({}),
   );
   const options = bankAccounts.map((a) => ({ value: a.id, label: a.name }));
   return (
      <Combobox
         className="h-7 text-xs"
         emptyMessage="Nenhuma conta."
         onValueChange={(v) => onChange(v ?? "")}
         options={options}
         placeholder="Selecionar..."
         searchPlaceholder="Buscar..."
         value={value}
      />
   );
}

function AccountValueSelect({
   value,
   onChange,
}: {
   value: string;
   onChange: (v: string) => void;
}) {
   return (
      <Suspense
         fallback={
            <div className="h-7 rounded-md border bg-muted/30 animate-pulse" />
         }
      >
         <AccountValueSelectInner onChange={onChange} value={value} />
      </Suspense>
   );
}

function CardValueSelectInner({
   value,
   onChange,
}: {
   value: string;
   onChange: (v: string) => void;
}) {
   const { data: creditCards } = useSuspenseQuery(
      orpc.creditCards.getAll.queryOptions({}),
   );
   const options = creditCards.map((c) => ({ value: c.id, label: c.name }));
   return (
      <Combobox
         className="h-7 text-xs"
         emptyMessage="Nenhum cartão."
         onValueChange={(v) => onChange(v ?? "")}
         options={options}
         placeholder="Selecionar..."
         searchPlaceholder="Buscar..."
         value={value}
      />
   );
}

function CardValueSelect({
   value,
   onChange,
}: {
   value: string;
   onChange: (v: string) => void;
}) {
   return (
      <Suspense
         fallback={
            <div className="h-7 rounded-md border bg-muted/30 animate-pulse" />
         }
      >
         <CardValueSelectInner onChange={onChange} value={value} />
      </Suspense>
   );
}

const PAYMENT_METHOD_OPTIONS = [
   { value: "pix", label: "Pix" },
   { value: "credit_card", label: "Cartão de Crédito" },
   { value: "debit_card", label: "Cartão de Débito" },
   { value: "boleto", label: "Boleto" },
   { value: "cash", label: "Dinheiro" },
   { value: "transfer", label: "Transferência" },
   { value: "other", label: "Outro" },
];

function PaymentMethodValueSelect({
   value,
   onChange,
}: {
   value: string;
   onChange: (v: string) => void;
}) {
   return (
      <Combobox
         className="h-7 text-xs"
         emptyMessage="Nenhuma forma."
         onValueChange={(v) => onChange(v ?? "")}
         options={PAYMENT_METHOD_OPTIONS}
         placeholder="Selecionar..."
         searchPlaceholder="Buscar..."
         value={value}
      />
   );
}

// ─────────────────────────────────────────────────────────────────────────────
// Filter row value input
// ─────────────────────────────────────────────────────────────────────────────

function FilterRowValueInput({
   row,
   def,
   onChange,
}: {
   row: FilterRow;
   def: PropertyDef;
   onChange: (v: string) => void;
}) {
   if (NO_VALUE_OPERATORS.has(row.operator)) {
      return (
         <div className="h-7 flex items-center px-2 text-xs text-muted-foreground italic">
            qualquer valor
         </div>
      );
   }

   if (def.type === "select" && def.selectType === "category") {
      return <CategoryValueSelect onChange={onChange} value={row.value} />;
   }
   if (def.type === "select" && def.selectType === "bankAccount") {
      return <AccountValueSelect onChange={onChange} value={row.value} />;
   }
   if (def.type === "select" && def.selectType === "creditCard") {
      return <CardValueSelect onChange={onChange} value={row.value} />;
   }
   if (def.type === "select" && def.selectType === "paymentMethod") {
      return <PaymentMethodValueSelect onChange={onChange} value={row.value} />;
   }
   if (def.type === "number") {
      return (
         <MoneyInput
            onChange={(v) => onChange(v !== undefined ? String(v) : "")}
            value={row.value !== "" ? Number(row.value) : undefined}
         />
      );
   }
   return (
      <Input
         className="h-7 text-xs"
         onChange={(e) => onChange(e.target.value)}
         placeholder="valor..."
         type="text"
         value={row.value}
      />
   );
}

// ─────────────────────────────────────────────────────────────────────────────
// Select components for property / operator
// ─────────────────────────────────────────────────────────────────────────────

import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export interface TransactionFilterPopoverProps {
   value: ConditionGroup | undefined;
   onChange: (group: ConditionGroup | undefined) => void;
}

export function TransactionFilterPopover({
   value,
   onChange,
}: TransactionFilterPopoverProps) {
   const uid = useId();
   const [open, setOpen] = useState(false);
   const [rows, setRows] = useState<FilterRow[]>([]);
   const [groupOperator, setGroupOperator] = useState<"AND" | "OR">("AND");
   const [advanced, setAdvanced] = useState(false);
   const [threshold, setThreshold] = useState(70);

   const activeCount = value?.conditions.length ?? 0;

   const handleOpenChange = (next: boolean) => {
      if (next && value) {
         setRows(
            (
               value.conditions.filter(
                  (c): c is Condition => !("conditions" in c),
               ) as Condition[]
            ).map(conditionToRow),
         );
         setGroupOperator(value.operator);
         setAdvanced(value.scoringMode === "weighted");
         setThreshold(
            value.threshold !== undefined
               ? Math.round(value.threshold * 100)
               : 70,
         );
      } else if (next) {
         setRows([]);
         setGroupOperator("AND");
         setAdvanced(false);
         setThreshold(70);
      }
      setOpen(next);
   };

   const handleAddRow = () => {
      const newId = `${uid}-${Date.now()}`;
      const firstProp = FILTER_PROPERTIES[0];
      setRows((prev) => [
         ...prev,
         {
            id: newId,
            field: firstProp.field,
            operator: defaultOperatorFor(firstProp.type),
            value: "",
            weight: 50,
         },
      ]);
   };

   const handleRemoveRow = (id: string) => {
      setRows((prev) => prev.filter((r) => r.id !== id));
   };

   const handleFieldChange = (id: string, field: string) => {
      const def =
         FILTER_PROPERTIES.find((p) => p.field === field) ??
         FILTER_PROPERTIES[0];
      setRows((prev) =>
         prev.map((r) =>
            r.id === id
               ? {
                    ...r,
                    field,
                    operator: defaultOperatorFor(def.type),
                    value: "",
                 }
               : r,
         ),
      );
   };

   const handleOperatorChange = (id: string, operator: string) => {
      setRows((prev) =>
         prev.map((r) =>
            r.id === id
               ? {
                    ...r,
                    operator,
                    value: NO_VALUE_OPERATORS.has(operator) ? "" : r.value,
                 }
               : r,
         ),
      );
   };

   const handleValueChange = (id: string, val: string) => {
      setRows((prev) =>
         prev.map((r) => (r.id === id ? { ...r, value: val } : r)),
      );
   };

   const handleWeightChange = (id: string, weight: number) => {
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, weight } : r)));
   };

   const handleApply = () => {
      if (rows.length === 0) {
         onChange(undefined);
         setOpen(false);
         return;
      }
      const group: ConditionGroup = {
         id: "transaction-filters",
         operator: groupOperator,
         ...(advanced
            ? { scoringMode: "weighted", threshold: threshold / 100 }
            : { scoringMode: "binary" }),
         conditions: rows.map((r) => rowToCondition(r, advanced)),
      };
      onChange(group);
      setOpen(false);
   };

   const handleClear = () => {
      setRows([]);
   };

   // Advanced mode toggle: preserve rows but do not apply yet
   const handleAdvancedToggle = (checked: boolean) => {
      setAdvanced(checked);
   };

   return (
      <Popover onOpenChange={handleOpenChange} open={open}>
         <PopoverTrigger asChild>
            <Button className="h-8 gap-2" variant="outline">
               <Filter className="size-3.5" />
               Filtros
               {activeCount > 0 && (
                  <Badge className="h-4 px-1 text-xs" variant="secondary">
                     {activeCount}
                  </Badge>
               )}
            </Button>
         </PopoverTrigger>

         <PopoverContent align="start" className="w-[600px] p-0" sideOffset={6}>
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2.5 border-b">
               <span className="text-sm font-medium">Filtros</span>
               <div className="flex items-center gap-2">
                  {/* AND/OR toggle */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                     <span>Combinar:</span>
                     <ToggleGroup
                        onValueChange={(v) => {
                           if (v === "AND" || v === "OR") setGroupOperator(v);
                        }}
                        size="sm"
                        type="single"
                        value={groupOperator}
                        variant="outline"
                     >
                        <ToggleGroupItem
                           className="h-6 px-2 text-xs"
                           value="AND"
                        >
                           E
                        </ToggleGroupItem>
                        <ToggleGroupItem
                           className="h-6 px-2 text-xs"
                           value="OR"
                        >
                           OU
                        </ToggleGroupItem>
                     </ToggleGroup>
                  </div>
                  {/* Advanced toggle */}
                  <div className="flex items-center gap-2 text-xs">
                     <span className="text-muted-foreground">Avançado</span>
                     <Switch
                        checked={advanced}
                        onCheckedChange={handleAdvancedToggle}
                     />
                  </div>
               </div>
            </div>

            {/* Column labels */}
            {rows.length > 0 && (
               <div
                  className={`grid gap-2 px-3 pt-2 pb-1 ${advanced ? "grid-cols-[160px_140px_1fr_80px_28px]" : "grid-cols-[160px_140px_1fr_28px]"}`}
               >
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                     Propriedade
                  </span>
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                     Condição
                  </span>
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                     Valor
                  </span>
                  {advanced && (
                     <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                        Peso
                     </span>
                  )}
                  <span />
               </div>
            )}

            {/* Rows */}
            <div className="flex flex-col gap-2 px-3 pt-1 pb-2.5 max-h-[320px] overflow-y-auto">
               {rows.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-7 text-center">
                     <Filter className="size-6 text-muted-foreground/30" />
                     <p className="text-sm text-muted-foreground">
                        Nenhum filtro ativo
                     </p>
                     <p className="text-xs text-muted-foreground/60">
                        Adicione filtros para refinar as transações exibidas
                     </p>
                  </div>
               ) : (
                  rows.map((row) => {
                     const def =
                        FILTER_PROPERTIES.find((p) => p.field === row.field) ??
                        FILTER_PROPERTIES[0];
                     const operators = getOperatorsFor(def.type);

                     return (
                        <div
                           className={`grid gap-2 items-center ${advanced ? "grid-cols-[160px_140px_1fr_80px_28px]" : "grid-cols-[160px_140px_1fr_28px]"}`}
                           key={row.id}
                        >
                           {/* Property select */}
                           <Select
                              onValueChange={(v) =>
                                 handleFieldChange(row.id, v)
                              }
                              value={row.field}
                           >
                              <SelectTrigger className="h-7 text-xs">
                                 <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                 {FILTER_PROPERTIES.map((prop) => (
                                    <SelectItem
                                       key={prop.field}
                                       value={prop.field}
                                    >
                                       {prop.label}
                                    </SelectItem>
                                 ))}
                              </SelectContent>
                           </Select>

                           {/* Operator select */}
                           <Select
                              onValueChange={(v) =>
                                 handleOperatorChange(row.id, v)
                              }
                              value={row.operator}
                           >
                              <SelectTrigger className="h-7 text-xs">
                                 <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                 {operators.map((op) => (
                                    <SelectItem key={op.value} value={op.value}>
                                       {op.label}
                                    </SelectItem>
                                 ))}
                              </SelectContent>
                           </Select>

                           {/* Value input */}
                           <FilterRowValueInput
                              def={def}
                              onChange={(v) => handleValueChange(row.id, v)}
                              row={row}
                           />

                           {/* Weight (advanced only) */}
                           {advanced && (
                              <div className="flex items-center gap-2">
                                 <Slider
                                    className="flex-1"
                                    max={100}
                                    min={0}
                                    onValueChange={([v]) => {
                                       if (v !== undefined)
                                          handleWeightChange(row.id, v);
                                    }}
                                    step={5}
                                    value={[row.weight]}
                                 />
                                 <span className="text-[10px] tabular-nums text-muted-foreground w-6 text-right">
                                    {row.weight}%
                                 </span>
                              </div>
                           )}

                           {/* Remove */}
                           <Button
                              className="size-7 text-muted-foreground hover:text-destructive"
                              onClick={() => handleRemoveRow(row.id)}
                              tooltip="Remover filtro"
                              type="button"
                              variant="outline"
                           >
                              <Trash2 className="size-3.5" />
                           </Button>
                        </div>
                     );
                  })
               )}
            </div>

            <Separator />

            {/* Advanced threshold */}
            {advanced && (
               <div className="px-3 py-2 flex items-center gap-2 border-b">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                     Correspondência mínima:
                  </span>
                  <Slider
                     className="flex-1"
                     max={100}
                     min={0}
                     onValueChange={([v]) => {
                        if (v !== undefined) setThreshold(v);
                     }}
                     step={5}
                     value={[threshold]}
                  />
                  <span className="text-xs font-medium tabular-nums w-8">
                     {threshold}%
                  </span>
               </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between px-3 py-2">
               <Button
                  className="h-7 text-xs gap-2 text-muted-foreground"
                  onClick={handleAddRow}
                  variant="ghost"
               >
                  <Plus className="size-3.5" />
                  Adicionar filtro
               </Button>
               <div className="flex items-center gap-2">
                  <Button
                     className="h-7 text-xs"
                     onClick={handleClear}
                     variant="ghost"
                  >
                     Limpar
                  </Button>
                  <Button className="h-7 text-xs" onClick={handleApply}>
                     Aplicar
                  </Button>
               </div>
            </div>
         </PopoverContent>
      </Popover>
   );
}
