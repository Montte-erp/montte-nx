import { MultiSelect } from "@packages/ui/components/multi-select";
import { EditableTrigger, type EditableTriggerProps } from "./editable-trigger";

interface EditableTagsProps extends Omit<
   EditableTriggerProps<string[]>,
   "children"
> {
   placeholder?: string;
}

export function EditableTags({ placeholder, ...rest }: EditableTagsProps) {
   return (
      <EditableTrigger<string[]> {...rest}>
         {({ value, setValue }) => (
            <MultiSelect
               aria-label={rest.ariaLabel}
               onChange={(v) => setValue(v)}
               onCreate={(name) => setValue([...value, name])}
               options={value.map((t) => ({ label: t, value: t }))}
               placeholder={placeholder ?? "Adicionar..."}
               selected={value}
            />
         )}
      </EditableTrigger>
   );
}
