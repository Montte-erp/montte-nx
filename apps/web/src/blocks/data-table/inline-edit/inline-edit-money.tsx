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

   const displayed = pending ?? draft ?? 0;

   async function commit(next: number | undefined) {
      const normalized = next ?? 0;
      if (normalized === value) return;
      setPending(normalized);
      const result = await fromPromise(onSave(normalized), (e) => e);
      if (result.isErr()) {
         setPending(null);
         setDraft(lastCommittedRef.current);
      }
   }

   return (
      <MoneyInput
         aria-label={ariaLabel}
         className={cn(
            "[&_input]:h-8 [&_input]:border-0 [&_input]:bg-transparent [&_input]:px-1 [&_input]:shadow-none focus-within:[&_input]:ring-1 focus-within:[&_input]:ring-ring",
            className,
         )}
         onBlur={() => commit(draft)}
         onChange={(next) => setDraft(next)}
         placeholder={placeholder}
         value={displayed}
         valueInCents={valueInCents}
      />
   );
}
