import { MoneyInput } from "@packages/ui/components/money-input";
import { cn } from "@packages/ui/lib/utils";
import { fromPromise } from "neverthrow";
import { useEffect, useRef, useState } from "react";

interface InlineEditMoneyProps {
   value: number;
   onSave: (value: number) => Promise<unknown>;
   ariaLabel: string;
   placeholder?: string;
   className?: string;
   valueInCents?: boolean;
}

export function InlineEditMoney({
   value,
   onSave,
   ariaLabel,
   placeholder,
   className,
   valueInCents = true,
}: InlineEditMoneyProps) {
   const [editing, setEditing] = useState(false);
   const [draft, setDraft] = useState<number | undefined>(value);
   const [pending, setPending] = useState<number | null>(null);
   const lastCommittedRef = useRef(value);

   useEffect(() => {
      if (lastCommittedRef.current !== value) {
         lastCommittedRef.current = value;
         setDraft(value);
         setPending(null);
      }
   }, [value]);

   const displayed = pending ?? draft;
   const displayValue = displayed ?? 0;

   async function commit(next: number | undefined) {
      setEditing(false);
      const normalized = next ?? 0;
      if (normalized === value) return;
      setPending(normalized);
      const result = await fromPromise(onSave(normalized), (e) => e);
      if (result.isErr()) {
         setPending(null);
         setDraft(lastCommittedRef.current);
      }
   }

   const formatted = new Intl.NumberFormat("pt-BR", {
      currency: "BRL",
      style: "currency",
   }).format(valueInCents ? displayValue / 100 : displayValue);

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
            <span
               className={cn(
                  "truncate",
                  displayed == null && "text-muted-foreground",
               )}
            >
               {displayed == null ? (placeholder ?? formatted) : formatted}
            </span>
         </button>
      );
   }

   return (
      <MoneyInput
         aria-label={ariaLabel}
         autoFocus
         className={cn(
            "[&_input]:h-8 [&_input]:border-0 [&_input]:bg-transparent [&_input]:px-1 [&_input]:shadow-none focus-within:[&_input]:ring-1 focus-within:[&_input]:ring-ring",
            className,
         )}
         onBlur={() => commit(draft)}
         onChange={(next) => setDraft(next)}
         placeholder={placeholder}
         value={displayValue}
         valueInCents={valueInCents}
      />
   );
}
