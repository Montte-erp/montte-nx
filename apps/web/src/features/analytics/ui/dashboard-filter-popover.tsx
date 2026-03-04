import type {
   Condition,
   NumberCondition,
   StringCondition,
} from "@f-o-t/condition-evaluator";
import type { Dashboard } from "@packages/database/schemas/dashboards";
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
import {
   Select,
   SelectContent,
   SelectGroup,
   SelectItem,
   SelectLabel,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
import { Separator } from "@packages/ui/components/separator";
import { cn } from "@packages/ui/lib/utils";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Filter, Plus, Trash2, X } from "lucide-react";
import { Suspense, useId, useState } from "react";
import type { z } from "zod";
import { orpc } from "@/integrations/orpc/client";

// ─────────────────────────────────────────────────────────────────────────────
// Filter property definitions
// ─────────────────────────────────────────────────────────────────────────────

type SelectType = "transactionType" | "bankAccount" | "category" | "contact";

type PropertyDef = {
   field: string;
   label: string;
   type: "string" | "number" | "select";
   selectType?: SelectType;
};

const FILTER_PROPERTIES: PropertyDef[] = [
   {
      field: "type",
      label: "Tipo",
      type: "select",
      selectType: "transactionType",
   },
   {
      field: "bankAccountId",
      label: "Conta",
      type: "select",
      selectType: "bankAccount",
   },
   {
      field: "categoryId",
      label: "Categoria",
      type: "select",
      selectType: "category",
   },
   {
      field: "contactId",
      label: "Contato",
      type: "select",
      selectType: "contact",
   },
   { field: "amount", label: "Valor", type: "number" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Operator sets from @f-o-t/condition-evaluator
// ─────────────────────────────────────────────────────────────────────────────

const SELECT_OPERATORS: Array<{
   value: z.infer<typeof StringCondition>["operator"];
   label: string;
}> = [
   { value: "eq", label: "é igual a" },
   { value: "neq", label: "não é igual a" },
   { value: "is_empty", label: "está vazio" },
   { value: "is_not_empty", label: "não está vazio" },
];

const STRING_OPERATORS: Array<{
   value: z.infer<typeof StringCondition>["operator"];
   label: string;
}> = [
   { value: "eq", label: "é igual a" },
   { value: "neq", label: "não é igual a" },
   { value: "contains", label: "contém" },
   { value: "not_contains", label: "não contém" },
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

// Operators that don't require a value input
const NO_VALUE_OPERATORS = new Set(["is_empty", "is_not_empty"]);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getPropertyDef(field: string): PropertyDef {
   return (
      FILTER_PROPERTIES.find((p) => p.field === field) ?? {
         field,
         label: field,
         type: "string",
      }
   );
}

function defaultOperatorFor(_type: PropertyDef["type"]): string {
   return "eq";
}

function buildCondition(
   id: string,
   field: string,
   type: PropertyDef["type"],
   operator: string,
   value: string,
): Condition {
   if (type === "number") {
      return {
         id,
         type: "number",
         field,
         operator: operator as z.infer<typeof NumberCondition>["operator"],
         value: value !== "" ? Number(value) : undefined,
      };
   }
   return {
      id,
      type: "string",
      field,
      operator: operator as z.infer<typeof StringCondition>["operator"],
      value: NO_VALUE_OPERATORS.has(operator) ? undefined : value,
   };
}

// ─────────────────────────────────────────────────────────────────────────────
// Row state — flat representation for the form
// ─────────────────────────────────────────────────────────────────────────────

interface FilterRow {
   id: string;
   field: string;
   operator: string;
   value: string;
}

function conditionToRow(c: Condition): FilterRow {
   const field = "field" in c ? c.field : "";
   const operator = "operator" in c ? (c.operator as string) : "eq";
   const rawValue = "value" in c ? c.value : undefined;
   const value =
      rawValue === undefined || rawValue === null ? "" : String(rawValue);
   return { id: c.id, field, operator, value };
}

function rowToCondition(row: FilterRow): Condition {
   const def = getPropertyDef(row.field);
   return buildCondition(row.id, row.field, def.type, row.operator, row.value);
}

// ─────────────────────────────────────────────────────────────────────────────
// Value input components
// ─────────────────────────────────────────────────────────────────────────────

function TransactionTypeSelect({
   value,
   onChange,
}: {
   value: string;
   onChange: (v: string) => void;
}) {
   return (
      <Select onValueChange={onChange} value={value}>
         <SelectTrigger className="h-7 text-xs">
            <SelectValue placeholder="Selecionar..." />
         </SelectTrigger>
         <SelectContent>
            <SelectItem value="income">Receita</SelectItem>
            <SelectItem value="expense">Despesa</SelectItem>
            <SelectItem value="transfer">Transferência</SelectItem>
         </SelectContent>
      </Select>
   );
}

function BankAccountComboboxInner({
   value,
   onChange,
}: {
   value: string;
   onChange: (v: string) => void;
}) {
   const { data } = useSuspenseQuery(orpc.bankAccounts.getAll.queryOptions({}));
   return (
      <Combobox
         className="h-7 text-xs"
         emptyMessage="Nenhuma conta."
         onValueChange={(v) => onChange(v ?? "")}
         options={data.map((a) => ({ value: a.id, label: a.name }))}
         placeholder="Selecionar conta..."
         searchPlaceholder="Buscar conta..."
         value={value}
      />
   );
}

function CategoryComboboxInner({
   value,
   onChange,
}: {
   value: string;
   onChange: (v: string) => void;
}) {
   const { data } = useSuspenseQuery(orpc.categories.getAll.queryOptions({}));
   return (
      <Combobox
         className="h-7 text-xs"
         emptyMessage="Nenhuma categoria."
         onValueChange={(v) => onChange(v ?? "")}
         options={data.map((c) => ({ value: c.id, label: c.name }))}
         placeholder="Selecionar categoria..."
         searchPlaceholder="Buscar categoria..."
         value={value}
      />
   );
}

function ContactComboboxInner({
   value,
   onChange,
}: {
   value: string;
   onChange: (v: string) => void;
}) {
   const { data } = useSuspenseQuery(orpc.contacts.getAll.queryOptions({}));
   return (
      <Combobox
         className="h-7 text-xs"
         emptyMessage="Nenhum contato."
         onValueChange={(v) => onChange(v ?? "")}
         options={data.map((c) => ({ value: c.id, label: c.name }))}
         placeholder="Selecionar contato..."
         searchPlaceholder="Buscar contato..."
         value={value}
      />
   );
}

function FilterRowValueInput({
   def,
   value,
   onChange,
}: {
   def: PropertyDef;
   value: string;
   onChange: (v: string) => void;
}) {
   if (def.type === "number") {
      return (
         <MoneyInput
            onChange={(v) => onChange(v !== undefined ? String(v) : "")}
            value={value !== "" ? Number(value) : undefined}
         />
      );
   }

   if (def.type === "select") {
      if (def.selectType === "transactionType") {
         return <TransactionTypeSelect onChange={onChange} value={value} />;
      }
      if (def.selectType === "bankAccount") {
         return (
            <Suspense
               fallback={
                  <Input
                     className="h-7 text-xs"
                     disabled
                     placeholder="Carregando..."
                  />
               }
            >
               <BankAccountComboboxInner onChange={onChange} value={value} />
            </Suspense>
         );
      }
      if (def.selectType === "category") {
         return (
            <Suspense
               fallback={
                  <Input
                     className="h-7 text-xs"
                     disabled
                     placeholder="Carregando..."
                  />
               }
            >
               <CategoryComboboxInner onChange={onChange} value={value} />
            </Suspense>
         );
      }
      if (def.selectType === "contact") {
         return (
            <Suspense
               fallback={
                  <Input
                     className="h-7 text-xs"
                     disabled
                     placeholder="Carregando..."
                  />
               }
            >
               <ContactComboboxInner onChange={onChange} value={value} />
            </Suspense>
         );
      }
   }

   return (
      <Input
         className="h-7 text-xs"
         onChange={(e) => onChange(e.target.value)}
         placeholder="valor..."
         type="text"
         value={value}
      />
   );
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

interface DashboardFilterPopoverProps {
   dashboard: Dashboard;
   onSave: (filters: Condition[]) => void;
   isPending?: boolean;
}

export function DashboardFilterPopover({
   dashboard,
   onSave,
   isPending = false,
}: DashboardFilterPopoverProps) {
   const uid = useId();
   const [open, setOpen] = useState(false);

   const savedFilters = (dashboard.globalFilters ?? []) as Condition[];
   const filterCount = savedFilters.length;

   const [rows, setRows] = useState<FilterRow[]>([]);

   const handleOpenChange = (next: boolean) => {
      if (next) setRows(savedFilters.map(conditionToRow));
      setOpen(next);
   };

   const handleAddFilter = () => {
      const newId = `${uid}-${Date.now()}`;
      setRows((prev) => [
         ...prev,
         { id: newId, field: "type", operator: "eq", value: "" },
      ]);
   };

   const handleRemove = (id: string) => {
      setRows((prev) => prev.filter((r) => r.id !== id));
   };

   const handleFieldChange = (id: string, field: string) => {
      const def = getPropertyDef(field);
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

   const handleValueChange = (id: string, value: string) => {
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, value } : r)));
   };

   const handleApply = () => {
      const conditions = rows.map(rowToCondition);
      onSave(conditions);
      setOpen(false);
   };

   const handleClearAll = () => {
      onSave([]);
      setOpen(false);
   };

   const hasChanges =
      JSON.stringify(rows) !== JSON.stringify(savedFilters.map(conditionToRow));

   return (
      <Popover onOpenChange={handleOpenChange} open={open}>
         <PopoverTrigger asChild>
            <Button
               className={cn(
                  "h-7 text-xs gap-1",
                  filterCount > 0 ? "text-foreground" : "text-muted-foreground",
               )}
               variant="outline"
            >
               <Filter className="size-3" />
               Filtros
               {filterCount > 0 && (
                  <Badge
                     className="ml-0.5 h-4 px-1 text-xs"
                     variant="secondary"
                  >
                     {filterCount}
                  </Badge>
               )}
            </Button>
         </PopoverTrigger>

         <PopoverContent
            align="start"
            className="w-[580px] p-0"
            forceMount
            sideOffset={6}
         >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2.5 border-b">
               <span className="text-sm font-medium">Filtros do dashboard</span>
               {filterCount > 0 && (
                  <Button
                     className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
                     disabled={isPending}
                     onClick={handleClearAll}
                     variant="ghost"
                  >
                     <X className="size-3 mr-1" />
                     Limpar todos
                  </Button>
               )}
            </div>

            {/* Column labels */}
            {rows.length > 0 && (
               <div className="grid grid-cols-[160px_150px_1fr_28px] gap-1.5 px-3 pt-2.5 pb-1">
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                     Propriedade
                  </span>
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                     Condição
                  </span>
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                     Valor
                  </span>
                  <span />
               </div>
            )}

            {/* Filter rows */}
            <div className="flex flex-col gap-1.5 px-3 pt-1 pb-2.5 max-h-[320px] overflow-y-auto">
               {rows.length === 0 ? (
                  <div className="flex flex-col items-center gap-1.5 py-7 text-center">
                     <Filter className="size-6 text-muted-foreground/30" />
                     <p className="text-sm text-muted-foreground">
                        Nenhum filtro ativo
                     </p>
                     <p className="text-xs text-muted-foreground/60">
                        Filtros aplicados a todos os insights do dashboard
                     </p>
                  </div>
               ) : (
                  rows.map((row) => {
                     const def = getPropertyDef(row.field);
                     const operators =
                        def.type === "number"
                           ? NUMBER_OPERATORS
                           : def.type === "select"
                             ? SELECT_OPERATORS
                             : STRING_OPERATORS;
                     const needsValue = !NO_VALUE_OPERATORS.has(row.operator);

                     return (
                        <div
                           className="grid grid-cols-[160px_150px_1fr_28px] gap-1.5 items-center"
                           key={row.id}
                        >
                           {/* Property */}
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
                                 <SelectGroup>
                                    <SelectLabel className="text-[11px]">
                                       Categoria
                                    </SelectLabel>
                                    {FILTER_PROPERTIES.filter(
                                       (p) => p.type === "select",
                                    ).map((prop) => (
                                       <SelectItem
                                          key={prop.field}
                                          value={prop.field}
                                       >
                                          {prop.label}
                                       </SelectItem>
                                    ))}
                                 </SelectGroup>
                                 <SelectGroup>
                                    <SelectLabel className="text-[11px]">
                                       Número
                                    </SelectLabel>
                                    {FILTER_PROPERTIES.filter(
                                       (p) => p.type === "number",
                                    ).map((prop) => (
                                       <SelectItem
                                          key={prop.field}
                                          value={prop.field}
                                       >
                                          {prop.label}
                                       </SelectItem>
                                    ))}
                                 </SelectGroup>
                              </SelectContent>
                           </Select>

                           {/* Operator */}
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

                           {/* Value */}
                           {needsValue ? (
                              <FilterRowValueInput
                                 def={def}
                                 onChange={(v) => handleValueChange(row.id, v)}
                                 value={row.value}
                              />
                           ) : (
                              <div className="h-7 flex items-center px-2 text-xs text-muted-foreground italic">
                                 qualquer valor
                              </div>
                           )}

                           {/* Remove */}
                           <Button
                              className="size-7 text-muted-foreground hover:text-destructive"
                              onClick={() => handleRemove(row.id)}
                              tooltip="Remover filtro"
                              type="button"
                              variant="outline"
                           >
                              <Trash2 className="size-4" />
                           </Button>
                        </div>
                     );
                  })
               )}
            </div>

            <Separator />

            {/* Footer */}
            <div className="flex items-center justify-between gap-2 px-3 py-2">
               <Button
                  className="h-7 text-xs gap-1 text-muted-foreground"
                  onClick={handleAddFilter}
                  variant="ghost"
               >
                  <Plus className="size-3.5" />
                  Adicionar filtro
               </Button>

               <div className="flex items-center gap-1.5">
                  <Button
                     className="h-7 text-xs"
                     onClick={() => handleOpenChange(false)}
                     variant="ghost"
                  >
                     Cancelar
                  </Button>
                  <Button
                     className="h-7 text-xs"
                     disabled={isPending || !hasChanges}
                     onClick={handleApply}
                  >
                     {isPending ? "Aplicando..." : "Aplicar"}
                  </Button>
               </div>
            </div>
         </PopoverContent>
      </Popover>
   );
}
