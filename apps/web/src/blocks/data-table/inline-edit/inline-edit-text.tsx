import { Input } from "@packages/ui/components/input";
import {
   InputGroup,
   InputGroupAddon,
   InputGroupInput,
} from "@packages/ui/components/input-group";
import { cn } from "@packages/ui/lib/utils";
import { fromPromise } from "neverthrow";
import {
   useCallback,
   useEffect,
   useRef,
   useState,
   type FocusEvent,
   type KeyboardEvent,
} from "react";

interface InlineEditTextProps {
   value: string;
   onSave: (value: string) => Promise<unknown>;
   ariaLabel: string;
   placeholder?: string;
   className?: string;
   startContent?: React.ReactNode;
}

export function InlineEditText({
   value,
   onSave,
   ariaLabel,
   placeholder,
   className,
   startContent,
}: InlineEditTextProps) {
   const [draft, setDraft] = useState(value);
   const [pending, setPending] = useState<string | null>(null);
   const lastCommittedRef = useRef(value);
   const cancelledRef = useRef(false);

   useEffect(() => {
      if (lastCommittedRef.current !== value) {
         lastCommittedRef.current = value;
         setDraft(value);
         setPending(null);
      }
   }, [value]);

   const displayed = pending ?? draft;

   const commit = useCallback(
      async (next: string) => {
         const trimmed = next.trim();
         if (trimmed === value.trim()) return;
         setPending(trimmed);
         const result = await fromPromise(onSave(trimmed), (e) => e);
         if (result.isErr()) {
            setPending(null);
            setDraft(lastCommittedRef.current);
         }
      },
      [onSave, value],
   );

   function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
      if (e.key === "Enter") {
         e.preventDefault();
         e.currentTarget.blur();
         return;
      }
      if (e.key === "Escape") {
         cancelledRef.current = true;
         setDraft(value);
         e.currentTarget.blur();
      }
   }

   const handleBlur = useCallback(
      (e: FocusEvent<HTMLInputElement>) => {
         if (cancelledRef.current) {
            cancelledRef.current = false;
            return;
         }
         commit(e.target.value);
      },
      [commit],
   );

   if (startContent) {
      return (
         <InputGroup
            className={cn(
               "h-8 border-0 bg-transparent shadow-none focus-within:ring-1 focus-within:ring-ring",
               className,
            )}
         >
            <InputGroupAddon align="inline-start">
               {startContent}
            </InputGroupAddon>
            <InputGroupInput
               aria-label={ariaLabel}
               onBlur={handleBlur}
               onChange={(e) => setDraft(e.target.value)}
               onKeyDown={handleKeyDown}
               placeholder={placeholder}
               value={displayed}
            />
         </InputGroup>
      );
   }

   return (
      <Input
         aria-label={ariaLabel}
         className={cn(
            "h-8 w-full border-0 bg-transparent px-1 shadow-none focus-visible:ring-1 focus-visible:ring-ring",
            className,
         )}
         onBlur={handleBlur}
         onChange={(e) => setDraft(e.target.value)}
         onKeyDown={handleKeyDown}
         placeholder={placeholder}
         value={displayed}
      />
   );
}
