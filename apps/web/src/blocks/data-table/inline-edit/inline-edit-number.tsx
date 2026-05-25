import { NumberInput } from "@packages/ui/components/number-input";
import { cn } from "@packages/ui/lib/utils";
import { fromPromise } from "neverthrow";
import { useCallback, useEffect, useRef, useState } from "react";

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
   const [editing, setEditing] = useState(false);
   const [draft, setDraft] = useState(value);
   const lastCommittedRef = useRef(value);
   const latestSaveIdRef = useRef(0);

   useEffect(() => {
      if (lastCommittedRef.current !== value) {
         lastCommittedRef.current = value;
         setDraft(value);
      }
   }, [value]);

   const commit = useCallback(
      async (next: number) => {
         const saveId = latestSaveIdRef.current + 1;
         latestSaveIdRef.current = saveId;
         setDraft(next);
         if (next === value) return;
         const result = await fromPromise(onSave(next), (e) => e);
         if (latestSaveIdRef.current !== saveId) return;
         if (result.isErr()) setDraft(value);
      },
      [onSave, value],
   );

   if (!editing) {
      return (
         <button
            aria-label={ariaLabel}
            className={cn(
               "flex h-8 w-full min-w-0 cursor-pointer items-center rounded-md border border-dashed border-transparent bg-muted/20 px-2 text-left text-sm tabular-nums transition-colors hover:border-border hover:bg-muted/50 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none",
               className,
            )}
            onClick={() => setEditing(true)}
            type="button"
         >
            <span className="truncate">{draft}</span>
         </button>
      );
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
         onBlur={() => setEditing(false)}
         onChange={commit}
         step={step}
         value={draft}
      />
   );
}
