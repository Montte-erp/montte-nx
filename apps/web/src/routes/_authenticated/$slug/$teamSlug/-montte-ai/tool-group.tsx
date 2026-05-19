import { useScrollLock } from "@assistant-ui/react";
import {
   Collapsible,
   CollapsibleContent,
   CollapsibleTrigger,
} from "@packages/ui/components/collapsible";
import { cn } from "@packages/ui/lib/utils";
import { ChevronDown, Loader2 } from "lucide-react";
import { useCallback, useRef, useState, type ReactNode } from "react";

const ANIMATION_DURATION_MS = 200;

interface ToolGroupRootProps {
   children: ReactNode;
   className?: string;
   defaultOpen?: boolean;
}

export function ToolGroupRoot({
   children,
   className,
   defaultOpen = false,
}: ToolGroupRootProps) {
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
            "group/tool-group w-full rounded-lg border p-2",
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

interface ToolGroupTriggerProps {
   active?: boolean;
   count: number;
}

export function ToolGroupTrigger({
   active = false,
   count,
}: ToolGroupTriggerProps) {
   const label = `${count} ${count === 1 ? "ferramenta" : "ferramentas"}`;

   return (
      <CollapsibleTrigger className="flex w-full items-center gap-2 text-left text-sm text-muted-foreground transition-colors hover:text-foreground">
         {active ? <Loader2 className="size-4 shrink-0 animate-spin" /> : null}
         <span className="flex-1 font-medium">{label}</span>
         <ChevronDown className="size-4 shrink-0 transition-transform group-data-[state=closed]/tool-group:-rotate-90" />
      </CollapsibleTrigger>
   );
}

export function ToolGroupContent({ children }: { children: ReactNode }) {
   return (
      <CollapsibleContent className="flex flex-col gap-2 pt-2">
         {children}
      </CollapsibleContent>
   );
}
