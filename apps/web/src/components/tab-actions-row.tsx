import { cn } from "@packages/ui/lib/utils";
import type React from "react";

interface Props {
   children?: React.ReactNode;
   className?: string;
}

export function TabActionsRow({ children, className }: Props) {
   return (
      <div
         className={cn(
            "flex h-9 items-center justify-end gap-2 px-1",
            className,
         )}
      >
         {children}
      </div>
   );
}
