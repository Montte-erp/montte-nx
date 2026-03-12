import {
   Popover,
   PopoverContent,
   PopoverTrigger,
} from "@packages/ui/components/popover";
import { cn } from "@packages/ui/lib/utils";
import { AtSign, FileText } from "lucide-react";
import { useState } from "react";

export interface ContextItem {
   type: "current-document";
   id: string;
   label: string;
}

interface ContextPickerProps {
   onSelect: (item: ContextItem) => void;
   currentDocumentId?: string;
   currentDocumentLabel?: string;
}

function ContextPickerInner({
   onSelect,
   currentDocumentId,
   currentDocumentLabel,
}: ContextPickerProps) {
   const [open, setOpen] = useState(false);

   const handleSelect = (item: ContextItem) => {
      onSelect(item);
      setOpen(false);
   };

   const handleOpenChange = (next: boolean) => {
      setOpen(next);
   };

   if (!currentDocumentId) {
      return null;
   }

   return (
      <Popover onOpenChange={handleOpenChange} open={open}>
         <PopoverTrigger asChild>
            <button
               className="flex h-7 items-center gap-1 rounded px-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
               type="button"
            >
               <AtSign className="size-3" />
               Contexto
            </button>
         </PopoverTrigger>
         <PopoverContent align="start" className="w-[320px] p-2" side="top">
            <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
               Documento atual
            </p>
            <button
               className={cn(
                  "flex w-full items-center gap-2 rounded px-2 py-2 text-left text-xs hover:bg-accent",
               )}
               onClick={() =>
                  handleSelect({
                     type: "current-document",
                     id: currentDocumentId,
                     label: currentDocumentLabel ?? "Documento atual",
                  })
               }
               type="button"
            >
               <FileText className="size-3.5 shrink-0 text-muted-foreground" />
               <span className="truncate">
                  {currentDocumentLabel ?? "Documento atual"}
               </span>
            </button>
         </PopoverContent>
      </Popover>
   );
}

export { ContextPickerInner as ContextPicker };
