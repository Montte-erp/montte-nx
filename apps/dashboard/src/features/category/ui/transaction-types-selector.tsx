import {
   ToggleGroup,
   ToggleGroupItem,
} from "@packages/ui/components/toggle-group";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight } from "lucide-react";

type TransactionType = "income" | "expense" | "transfer";

type TransactionTypesSelectorProps = {
   disabled?: boolean;
   onChange: (value: TransactionType[]) => void;
   value: TransactionType[];
};

export function TransactionTypesSelector({
   disabled,
   onChange,
   value,
}: TransactionTypesSelectorProps) {
   return (
      <ToggleGroup
         className="justify-start"
         disabled={disabled}
         onValueChange={(val) => onChange(val as TransactionType[])}
         size="sm"
         spacing={2}
         type="multiple"
         value={value}
         variant="outline"
      >
         <ToggleGroupItem
            className="gap-1.5 data-[state=on]:bg-emerald-50 data-[state=on]:border-emerald-500 data-[state=on]:text-emerald-600"
            value="income"
         >
            <ArrowDownLeft className="size-3.5" />
            Receita
         </ToggleGroupItem>
         <ToggleGroupItem
            className="gap-1.5 data-[state=on]:bg-red-50 data-[state=on]:border-red-500 data-[state=on]:text-red-600"
            value="expense"
         >
            <ArrowUpRight className="size-3.5" />
            Despesa
         </ToggleGroupItem>
         <ToggleGroupItem
            className="gap-1.5 data-[state=on]:bg-blue-50 data-[state=on]:border-blue-500 data-[state=on]:text-blue-600"
            value="transfer"
         >
            <ArrowLeftRight className="size-3.5" />
            Transferência
         </ToggleGroupItem>
      </ToggleGroup>
   );
}
