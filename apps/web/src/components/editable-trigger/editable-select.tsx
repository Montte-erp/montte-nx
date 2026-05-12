import {
   Select,
   SelectContent,
   SelectGroup,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
import { cn } from "@packages/ui/lib/utils";
import { fromPromise } from "neverthrow";
import { useCallback, useState } from "react";

interface EditableSelectProps {
   value: string;
   options: Array<{ label: string; value: string }>;
   onSave: (value: string) => Promise<unknown>;
   ariaLabel?: string;
   placeholder?: string;
   className?: string;
}

export function EditableSelect({
   value,
   options,
   onSave,
   ariaLabel,
   placeholder,
   className,
}: EditableSelectProps) {
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
      <Select onValueChange={handleChange} value={displayed}>
         <SelectTrigger
            aria-label={ariaLabel}
            className={cn("h-8 text-sm", className)}
         >
            <SelectValue placeholder={placeholder ?? "Selecionar..."} />
         </SelectTrigger>
         <SelectContent>
            <SelectGroup>
               {options.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                     {opt.label}
                  </SelectItem>
               ))}
            </SelectGroup>
         </SelectContent>
      </Select>
   );
}
