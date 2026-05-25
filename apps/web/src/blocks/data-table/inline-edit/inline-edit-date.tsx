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
   ariaLabel,
   placeholder,
   className,
}: InlineEditDateProps) {
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
   const dateValue = displayed ? dayjs(displayed).toDate() : undefined;

   async function commit(next: Date | undefined) {
      setEditing(false);
      const formatted = next ? dayjs(next).format("YYYY-MM-DD") : "";
      if (formatted === (value ?? "")) return;
      setPending(formatted);
      const result = await fromPromise(onSave(formatted), (e) => e);
      if (result.isErr()) setPending(null);
   }

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
               className={cn("truncate", !displayed && "text-muted-foreground")}
            >
               {displayed
                  ? dayjs(displayed).format("DD/MM/YYYY")
                  : placeholder || "—"}
            </span>
         </button>
      );
   }

   return (
      <DatePicker
         className={cn(
            "h-8 w-full border-0 bg-transparent px-1 shadow-none focus-visible:ring-1 focus-visible:ring-ring",
            className,
         )}
         date={dateValue}
         onOpenChange={setEditing}
         onSelect={commit}
         open={editing}
         placeholder={placeholder ?? "—"}
      />
   );
}
