import { Input } from "@packages/ui/components/input";
import { cn } from "@packages/ui/lib/utils";
import { fromPromise } from "neverthrow";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";

interface InlineEditTextProps {
   value: string;
   onSave: (value: string) => Promise<unknown>;
   ariaLabel: string;
   placeholder?: string;
   className?: string;
}

export function InlineEditText({
   value,
   onSave,
   ariaLabel,
   placeholder,
   className,
}: InlineEditTextProps) {
   const [draft, setDraft] = useState(value);
   const [pending, setPending] = useState<string | null>(null);
   const lastCommittedRef = useRef(value);

   useEffect(() => {
      if (!Object.is(lastCommittedRef.current, value)) {
         lastCommittedRef.current = value;
         setDraft(value);
         setPending(null);
      }
   }, [value]);

   const displayed = pending ?? draft;

   async function commit(next: string) {
      const trimmed = next.trim();
      if (trimmed === value.trim()) return;
      setPending(trimmed);
      const result = await fromPromise(onSave(trimmed), (e) => e);
      if (result.isErr()) {
         setPending(null);
         setDraft(value);
      }
   }

   function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
      if (e.key === "Enter") {
         e.preventDefault();
         (e.target as HTMLInputElement).blur();
         return;
      }
      if (e.key === "Escape") {
         setDraft(value);
         (e.target as HTMLInputElement).blur();
      }
   }

   return (
      <Input
         aria-label={ariaLabel}
         className={cn(
            "h-8 w-full border-0 bg-transparent px-1 shadow-none focus-visible:ring-1 focus-visible:ring-ring",
            className,
         )}
         onBlur={(e) => commit(e.target.value)}
         onChange={(e) => setDraft(e.target.value)}
         onKeyDown={handleKeyDown}
         placeholder={placeholder}
         value={displayed}
      />
   );
}
