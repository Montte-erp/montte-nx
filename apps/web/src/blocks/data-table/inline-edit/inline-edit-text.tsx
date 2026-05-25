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
   const [editing, setEditing] = useState(false);
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
         setEditing(false);
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
            setEditing(false);
            return;
         }
         commit(e.target.value);
      },
      [commit],
   );

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
            <span
               className={cn("truncate", !displayed && "text-muted-foreground")}
            >
               {displayed || placeholder || "—"}
            </span>
         </button>
      );
   }

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
               autoFocus
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
         autoFocus
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
