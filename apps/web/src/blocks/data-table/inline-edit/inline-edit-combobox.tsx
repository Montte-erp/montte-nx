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
   renderSelected?: (option: ComboboxOption) => React.ReactNode;
}

export function InlineEditCombobox({
   value,
   options,
   onSave,
   onCreate,
   ariaLabel,
   placeholder,
   className,
   startContent,
   renderSelected,
}: InlineEditComboboxProps) {
   const [editing, setEditing] = useState(false);
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
      setEditing(false);
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

   const selectedOption = options.find((option) => option.value === displayed);

   if (!editing) {
      return (
         <button
            aria-label={ariaLabel}
            className={cn(
               "flex h-8 w-full min-w-0 cursor-pointer items-center gap-2 rounded-md border border-dashed border-transparent bg-muted/20 px-2 text-left text-sm transition-colors hover:border-border hover:bg-muted/50 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none",
               className,
            )}
            onClick={() => setEditing(true)}
            type="button"
         >
            {selectedOption ? (
               (renderSelected?.(selectedOption) ?? (
                  <>
                     {startContent}
                     <span className="truncate">{selectedOption.label}</span>
                  </>
               ))
            ) : (
               <>
                  {startContent}
                  <span className="truncate text-muted-foreground">
                     {placeholder ?? "—"}
                  </span>
               </>
            )}
         </button>
      );
   }

   return (
      <Combobox
         className={cn(
            "h-8 w-full border-0 bg-transparent px-1 shadow-none focus-visible:ring-1 focus-visible:ring-ring",
            className,
         )}
         defaultOpen
         onCreate={onCreate ? handleCreate : undefined}
         onOpenChange={setEditing}
         onValueChange={commit}
         options={options}
         placeholder={placeholder ?? "—"}
         renderSelected={
            renderSelected ??
            (startContent
               ? (option) => (
                    <span className="flex items-center gap-2 min-w-0">
                       {startContent}
                       <span className="truncate">{option.label}</span>
                    </span>
                 )
               : undefined)
         }
         value={displayed}
      />
   );
}
