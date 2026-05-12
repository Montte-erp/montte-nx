import { Switch } from "@packages/ui/components/switch";
import { fromPromise } from "neverthrow";
import { useCallback, useState } from "react";

interface EditableToggleProps {
   value: boolean;
   onSave: (value: boolean) => Promise<unknown>;
   ariaLabel?: string;
}

export function EditableToggle({
   value,
   onSave,
   ariaLabel,
}: EditableToggleProps) {
   const [displayed, setDisplayed] = useState(value);

   const handleChange = useCallback(
      async (next: boolean) => {
         const previous = displayed;
         setDisplayed(next);
         const result = await fromPromise(onSave(next), (e) => e);
         if (result.isErr()) setDisplayed(previous);
      },
      [displayed, onSave],
   );

   return (
      <Switch
         aria-label={ariaLabel}
         checked={displayed}
         onCheckedChange={handleChange}
      />
   );
}
