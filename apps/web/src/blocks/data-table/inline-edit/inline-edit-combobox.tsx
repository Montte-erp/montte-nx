import {
   Combobox,
   type ComboboxOption,
} from "@packages/ui/components/combobox";
import { cn } from "@packages/ui/lib/utils";
import { fromPromise } from "neverthrow";
import { useEffect, useRef, useState } from "react";

interface InlineEditComboboxProps {
   value: string;
   options: ComboboxOption[];
   onSave: (value: string) => Promise<unknown>;
   onCreate?: (name: string) => Promise<string>;
   ariaLabel: string;
   placeholder?: string;
   className?: string;
   startContent?: React.ReactNode;
}

export function InlineEditCombobox({
   value,
   options,
   onSave,
   onCreate,
   placeholder,
   className,
   startContent,
}: InlineEditComboboxProps) {
   const [pending, setPending] = useState<string | null>(null);
   const lastCommittedRef = useRef(value);

   useEffect(() => {
      if (lastCommittedRef.current !== value) {
         lastCommittedRef.current = value;
         setPending(null);
      }
   }, [value]);

   const displayed = pending ?? value;

   async function commit(next: string) {
      if (next === value) return;
      setPending(next);
      const result = await fromPromise(onSave(next), (e) => e);
      if (result.isErr()) setPending(null);
   }

   async function handleCreate(name: string) {
      if (!onCreate) return;
      const result = await fromPromise(onCreate(name), (e) => e);
      if (result.isOk()) commit(result.value);
   }

   return (
      <Combobox
         className={cn(
            "h-8 w-full border-0 bg-transparent px-1 shadow-none focus-visible:ring-1 focus-visible:ring-ring",
            className,
         )}
         onCreate={onCreate ? handleCreate : undefined}
         onValueChange={commit}
         options={options}
         placeholder={placeholder ?? "—"}
         renderSelected={
            startContent
               ? (option) => (
                    <span className="flex items-center gap-2 min-w-0">
                       {startContent}
                       <span className="truncate">{option.label}</span>
                    </span>
                 )
               : undefined
         }
         value={displayed}
      />
   );
}
