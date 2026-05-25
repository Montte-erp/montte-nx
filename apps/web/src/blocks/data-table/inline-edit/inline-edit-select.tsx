import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
import { cn } from "@packages/ui/lib/utils";
import { fromPromise } from "neverthrow";
import { useEffect, useRef, useState } from "react";

interface InlineEditSelectOption {
   value: string;
   label: string;
}

interface InlineEditSelectProps {
   value: string;
   options: InlineEditSelectOption[];
   onSave: (value: string) => Promise<unknown>;
   ariaLabel: string;
   placeholder?: string;
   className?: string;
   startContent?: React.ReactNode;
   hideValue?: boolean;
}

export function InlineEditSelect({
   value,
   options,
   onSave,
   ariaLabel,
   placeholder,
   className,
   startContent,
   hideValue,
}: InlineEditSelectProps) {
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
            {startContent}
            {!hideValue && (
               <span
                  className={cn(
                     "truncate",
                     !selectedOption && "text-muted-foreground",
                  )}
               >
                  {selectedOption?.label ?? placeholder ?? "—"}
               </span>
            )}
         </button>
      );
   }

   return (
      <Select
         onOpenChange={(open) => setEditing(open)}
         onValueChange={commit}
         open={editing}
         value={displayed}
      >
         <SelectTrigger
            aria-label={ariaLabel}
            className={cn(
               "h-8 w-full border-0 bg-transparent px-1 shadow-none focus:ring-1 focus:ring-ring",
               className,
            )}
         >
            {startContent ? (
               <span className="flex items-center gap-2 min-w-0">
                  {startContent}
                  {!hideValue && <SelectValue placeholder={placeholder} />}
               </span>
            ) : (
               <SelectValue placeholder={placeholder} />
            )}
         </SelectTrigger>
         <SelectContent>
            {options.map((opt) => (
               <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
               </SelectItem>
            ))}
         </SelectContent>
      </Select>
   );
}
