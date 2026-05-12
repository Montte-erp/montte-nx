import { Combobox } from "@packages/ui/components/combobox";
import { fromPromise } from "neverthrow";
import { useCallback, useState } from "react";

interface EditableComboboxProps {
   value: string;
   options: Array<{ label: string; value: string }>;
   onSave: (value: string) => Promise<unknown>;
   onCreate?: (name: string) => Promise<string>;
   ariaLabel?: string;
   placeholder?: string;
}

export function EditableCombobox({
   value,
   options,
   onSave,
   onCreate,
   placeholder,
}: EditableComboboxProps) {
   const [displayed, setDisplayed] = useState(value);

   const handleChange = useCallback(
      async (next: string) => {
         const previous = displayed;
         setDisplayed(next);
         const result = await fromPromise(onSave(next), (e) => e);
         if (result.isErr()) setDisplayed(previous);
      },
      [displayed, onSave],
   );

   return (
      <Combobox
         emptyMessage="Nenhuma opção encontrada."
         options={options}
         placeholder={placeholder ?? "Selecionar..."}
         searchPlaceholder="Buscar..."
         value={displayed}
         onValueChange={handleChange}
         onCreate={
            onCreate
               ? (name) => {
                    onCreate(name)
                       .then((id) => handleChange(id))
                       .catch(() => undefined);
                 }
               : undefined
         }
      />
   );
}
