import { NumberInput } from "@packages/ui/components/number-input";
import { cn } from "@packages/ui/lib/utils";
import { fromPromise } from "neverthrow";
import { useEffect, useRef, useState } from "react";

interface InlineEditNumberProps {
   value: number;
   onSave: (value: number) => Promise<unknown>;
   ariaLabel: string;
   min?: number;
   max?: number;
   step?: number;
   className?: string;
}

export function InlineEditNumber({
   value,
   onSave,
   ariaLabel,
   min,
   max,
   step,
   className,
}: InlineEditNumberProps) {
   const [draft, setDraft] = useState(value);
   const lastCommittedRef = useRef(value);

   useEffect(() => {
      if (lastCommittedRef.current !== value) {
         lastCommittedRef.current = value;
         setDraft(value);
      }
   }, [value]);

   async function commit(next: number) {
      setDraft(next);
      if (next === value) return;
      const result = await fromPromise(onSave(next), (e) => e);
      if (result.isErr()) setDraft(value);
   }

   return (
      <NumberInput
         aria-label={ariaLabel}
         className={cn(
            "h-8 border-0 bg-transparent shadow-none focus-within:ring-1 focus-within:ring-ring",
            className,
         )}
         max={max}
         min={min}
         onChange={commit}
         step={step}
         value={draft}
      />
   );
}
