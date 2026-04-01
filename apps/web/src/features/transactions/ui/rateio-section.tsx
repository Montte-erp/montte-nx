import { Button } from "@packages/ui/components/button";
import type { ComboboxOption } from "@packages/ui/components/combobox";
import { Combobox } from "@packages/ui/components/combobox";
import { MoneyInput } from "@packages/ui/components/money-input";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { orpc } from "@/integrations/orpc/client";

export interface RateioLine {
   categoryId: string;
   tagId: string | null;
   amount: number | undefined;
}

interface RateioSectionProps {
   transactionAmount: number | undefined;
   value: RateioLine[];
   onChange: (lines: RateioLine[]) => void;
}

function RateioLineRow({
   line,
   index,
   onChange,
   onRemove,
}: {
   line: RateioLine;
   index: number;
   onChange: (line: RateioLine) => void;
   onRemove: () => void;
}) {
   const { data: categories } = useSuspenseQuery(
      orpc.categories.getAll.queryOptions({}),
   );
   const { data: tags } = useSuspenseQuery(orpc.tags.getAll.queryOptions({}));

   const categoryOptions: ComboboxOption[] = categories.map((c) => ({
      value: c.id,
      label: c.name,
   }));
   const tagOptions: ComboboxOption[] = tags.map((t) => ({
      value: t.id,
      label: t.name,
   }));

   return (
      <div className="flex flex-col gap-2 rounded-md border p-3">
         <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Linha {index + 1}</span>
            <Button onClick={onRemove} size="sm" type="button" variant="ghost">
               <Trash2 className="size-4" />
            </Button>
         </div>
         <div className="flex flex-col gap-2">
            <Combobox
               className="w-full"
               emptyMessage="Nenhuma categoria encontrada."
               onValueChange={(v) => onChange({ ...line, categoryId: v || "" })}
               options={categoryOptions}
               placeholder="Selecionar categoria..."
               searchPlaceholder="Buscar categoria..."
               value={line.categoryId}
            />
            <Combobox
               className="w-full"
               emptyMessage="Nenhum centro de custo encontrado."
               onValueChange={(v) => onChange({ ...line, tagId: v || null })}
               options={tagOptions}
               placeholder="Centro de custo (opcional)..."
               searchPlaceholder="Buscar centro de custo..."
               value={line.tagId ?? ""}
            />
            <MoneyInput
               onChange={(v) => onChange({ ...line, amount: v })}
               placeholder="Valor"
               value={line.amount}
            />
         </div>
      </div>
   );
}

export function RateioSection({
   transactionAmount,
   value,
   onChange,
}: RateioSectionProps) {
   const total = transactionAmount ?? 0;
   const allocated = value.reduce((acc, l) => acc + (l.amount ?? 0), 0);
   const remaining = total - allocated;

   function addLine() {
      onChange([...value, { categoryId: "", tagId: null, amount: undefined }]);
   }

   function updateLine(index: number, line: RateioLine) {
      onChange(value.map((l, i) => (i === index ? line : l)));
   }

   function removeLine(index: number) {
      onChange(value.filter((_, i) => i !== index));
   }

   return (
      <div className="flex flex-col gap-4">
         <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Rateio</span>
            <Button onClick={addLine} size="sm" type="button" variant="outline">
               <Plus className="size-4" />
               Adicionar linha
            </Button>
         </div>
         {value.length > 0 && (
            <div className="flex flex-col gap-2">
               {value.map((line, i) => (
                  <RateioLineRow
                     index={i}
                     key={`rateio-${i + 1}`}
                     line={line}
                     onChange={(updated) => updateLine(i, updated)}
                     onRemove={() => removeLine(i)}
                  />
               ))}
               <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Alocado: R$ {(allocated / 100).toFixed(2)}</span>
                  <span className={remaining < 0 ? "text-destructive" : ""}>
                     Restante: R$ {(remaining / 100).toFixed(2)}
                  </span>
               </div>
            </div>
         )}
      </div>
   );
}
