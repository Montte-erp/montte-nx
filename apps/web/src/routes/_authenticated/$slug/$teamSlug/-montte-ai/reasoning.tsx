import { useScrollLock } from "@assistant-ui/react";
import {
   Collapsible,
   CollapsibleContent,
   CollapsibleTrigger,
} from "@packages/ui/components/collapsible";
import { cn } from "@packages/ui/lib/utils";
import { Brain, Check, ChevronDown, Loader2 } from "lucide-react";
import { useCallback, useRef, useState, type ReactNode } from "react";

const ANIMATION_DURATION_MS = 200;

interface ReasoningRootProps {
   children: ReactNode;
   className?: string;
   defaultOpen?: boolean;
}

export function ReasoningRoot({
   children,
   className,
   defaultOpen = false,
}: ReasoningRootProps) {
   const rootRef = useRef<HTMLDivElement>(null);
   const [open, setOpen] = useState(defaultOpen);
   const lockScroll = useScrollLock(rootRef, ANIMATION_DURATION_MS);

   const handleOpenChange = useCallback(
      (nextOpen: boolean) => {
         if (!nextOpen) lockScroll();
         setOpen(nextOpen);
      },
      [lockScroll],
   );

   return (
      <Collapsible
         className={cn(
            "group/reasoning w-full overflow-hidden rounded-lg text-sm text-muted-foreground",
            className,
         )}
         onOpenChange={handleOpenChange}
         open={open}
         ref={rootRef}
      >
         {children}
      </Collapsible>
   );
}

interface ReasoningTriggerProps {
   active?: boolean;
}

export function ReasoningTrigger({ active = false }: ReasoningTriggerProps) {
   return (
      <CollapsibleTrigger className="flex w-full items-center gap-2 p-2 text-left text-foreground/90 hover:bg-muted/30">
         <ChevronDown className="size-4 shrink-0 transition-transform group-data-[state=closed]/reasoning:-rotate-90" />
         <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Brain className="size-2" />
         </span>
         <span className="flex-1 font-medium">Raciocínio</span>
         {active ? (
            <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
         ) : (
            <Check className="size-4 shrink-0 text-emerald-500" />
         )}
      </CollapsibleTrigger>
   );
}

interface ReasoningContentProps {
   children: ReactNode;
   active?: boolean;
}

export function ReasoningContent({
   children,
   active = false,
}: ReasoningContentProps) {
   return (
      <CollapsibleContent
         aria-busy={active}
         className="flex flex-col gap-2 p-2"
      >
         {children}
      </CollapsibleContent>
   );
}

export function ReasoningText({ children }: { children: ReactNode }) {
   return (
      <div className="min-w-0 flex-1 italic leading-relaxed">{children}</div>
   );
}
