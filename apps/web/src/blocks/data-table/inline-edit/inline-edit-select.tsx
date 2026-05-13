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

   return (
      <Select onValueChange={commit} value={displayed}>
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
