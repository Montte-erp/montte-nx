import { MoneyInput } from "@packages/ui/components/money-input";
import { EditableTrigger, type EditableTriggerProps } from "./editable-trigger";

interface EditableMoneyProps extends Omit<
   EditableTriggerProps<string>,
   "children"
> {
   currency?: "BRL" | "USD";
}

export function EditableMoney({
   currency = "BRL",
   ...rest
}: EditableMoneyProps) {
   return (
      <EditableTrigger<string> {...rest}>
         {({ value, setValue, commit }) => (
            <MoneyInput
               autoFocus
               currency={currency}
               onBlur={commit}
               onChange={(v) => setValue(v !== undefined ? String(v) : "")}
               value={value ? Number(value) : undefined}
               valueInCents={false}
            />
         )}
      </EditableTrigger>
   );
}
