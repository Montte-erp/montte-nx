import { Button } from "@packages/ui/components/button";
import {
   Popover,
   PopoverContent,
   PopoverTrigger,
} from "@packages/ui/components/popover";
import { cn } from "@packages/ui/lib/utils";
import { Pencil } from "lucide-react";
import { fromPromise } from "neverthrow";
import { useCallback, useState } from "react";
import type React from "react";

export interface EditableApi<T> {
   value: T;
   setValue: (next: T) => void;
   commit: () => void;
   cancel: () => void;
}

export interface EditableTriggerProps<T> {
   value: T;
   onSave: (value: T) => Promise<unknown>;
   renderDisplay?: (value: T) => React.ReactNode;
   children: (api: EditableApi<T>) => React.ReactNode;
   ariaLabel?: string;
   className?: string;
   align?: "start" | "center" | "end";
   popoverClassName?: string;
}

export function EditableTrigger<T>({
   value: committed,
   onSave,
   renderDisplay,
   children,
   ariaLabel = "Editar",
   className,
   align = "start",
   popoverClassName,
}: EditableTriggerProps<T>) {
   const [open, setOpen] = useState(false);
   const [draft, setDraft] = useState<T>(committed);
   const [displayed, setDisplayed] = useState<T>(committed);

   const beginEdit = useCallback(() => {
      setDraft(committed);
      setOpen(true);
   }, [committed]);

   const cancel = useCallback(() => {
      setOpen(false);
   }, []);

   const commit = useCallback(async () => {
      setOpen(false);
      const previous = displayed;
      setDisplayed(draft);
      const result = await fromPromise(onSave(draft), (e) => e);
      if (result.isErr()) setDisplayed(previous);
   }, [draft, displayed, onSave]);

   const renderedDisplay = renderDisplay
      ? renderDisplay(displayed)
      : displayed == null || displayed === ""
        ? null
        : String(displayed);

   return (
      <Popover open={open} onOpenChange={setOpen}>
         <PopoverTrigger asChild>
            <Button
               aria-label={ariaLabel}
               className={cn(
                  "group/cell h-auto min-h-[1.5rem] w-full justify-start gap-2 px-0 text-sm font-normal cursor-pointer",
                  className,
               )}
               onClick={beginEdit}
               type="button"
               variant="ghost"
            >
               <span className="flex-1 truncate">
                  {renderedDisplay ?? (
                     <span className="text-muted-foreground/40">—</span>
                  )}
               </span>
               <Pencil className="size-3 shrink-0 text-muted-foreground opacity-0 group-hover/cell:opacity-100 transition-opacity" />
            </Button>
         </PopoverTrigger>
         <PopoverContent
            align={align}
            className={cn(
               "min-w-64 w-max max-w-[min(420px,90vw)] p-2",
               popoverClassName,
            )}
            sideOffset={4}
         >
            {children({ value: draft, setValue: setDraft, commit, cancel })}
         </PopoverContent>
      </Popover>
   );
}
