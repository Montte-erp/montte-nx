import { MoneyInput } from "@packages/ui/components/money-input";
import { EditableTrigger, type EditableTriggerProps } from "./editable-trigger";

type EditableMoneyProps = Omit<EditableTriggerProps<string>, "children">;

export function EditableMoney(props: EditableMoneyProps) {
   return (
      <EditableTrigger<string> {...props}>
         {({ value, setValue, commit }) => (
            <MoneyInput
               autoFocus
               onBlur={commit}
               onChange={(v) => setValue(v !== undefined ? String(v) : "")}
               value={value ? Number(value) : undefined}
               valueInCents={false}
            />
         )}
      </EditableTrigger>
   );
}
