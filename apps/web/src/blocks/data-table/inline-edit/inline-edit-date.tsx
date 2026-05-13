import { DatePicker } from "@packages/ui/components/date-picker";
import { cn } from "@packages/ui/lib/utils";
import dayjs from "dayjs";
import { fromPromise } from "neverthrow";
import { useEffect, useRef, useState } from "react";

interface InlineEditDateProps {
   value: string | null;
   onSave: (value: string) => Promise<unknown>;
   ariaLabel: string;
   placeholder?: string;
   className?: string;
}

export function InlineEditDate({
   value,
   onSave,
   placeholder,
   className,
}: InlineEditDateProps) {
   const [pending, setPending] = useState<string | null>(null);
   const lastCommittedRef = useRef(value);

   useEffect(() => {
      if (lastCommittedRef.current !== value) {
         lastCommittedRef.current = value;
         setPending(null);
      }
   }, [value]);

   const displayed = pending ?? value;
   const dateValue = displayed ? dayjs(displayed).toDate() : undefined;

   async function commit(next: Date | undefined) {
      const formatted = next ? dayjs(next).format("YYYY-MM-DD") : "";
      if (formatted === (value ?? "")) return;
      setPending(formatted);
      const result = await fromPromise(onSave(formatted), (e) => e);
      if (result.isErr()) setPending(null);
   }

   return (
      <DatePicker
         className={cn(
            "h-8 w-full border-0 bg-transparent px-1 shadow-none focus-visible:ring-1 focus-visible:ring-ring",
            className,
         )}
         date={dateValue}
         onSelect={commit}
         placeholder={placeholder ?? "—"}
      />
   );
}
