import { cn } from "@packages/ui/lib/utils";
import { ChevronDownIcon } from "lucide-react";
import type { FC, ReactNode } from "react";
import { memo, useState } from "react";

export const ReasoningDisplay: FC<{ text: string }> = memo(({ text }) => {
   const [isOpen, setIsOpen] = useState(false);
   if (!text?.trim()) return null;
   return (
      <div className="my-1 w-full">
         <button
            className="flex items-center gap-1.5 py-0.5 text-xs text-muted-foreground/60 transition-colors hover:text-muted-foreground"
            onClick={() => setIsOpen((v) => !v)}
            type="button"
         >
            <span>Pensando...</span>
            <ChevronDownIcon
               className={cn(
                  "size-3 transition-transform duration-150",
                  !isOpen && "-rotate-90",
               )}
            />
         </button>
         {isOpen && (
            <div className="ml-1 mt-0.5 space-y-1 border-l border-border/30 py-1 pl-3">
               <p className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground/70">
                  {text}
               </p>
            </div>
         )}
      </div>
   );
});
ReasoningDisplay.displayName = "ReasoningDisplay";

export const ReasoningGroupDisplay: FC<{ children: ReactNode }> = ({
   children,
}) => <>{children}</>;
ReasoningGroupDisplay.displayName = "ReasoningGroupDisplay";
