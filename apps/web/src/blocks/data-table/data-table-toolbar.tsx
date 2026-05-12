import { cn } from "@packages/ui/lib/utils";
import type React from "react";

interface DataTableToolbarProps {
   children: React.ReactNode;
   className?: string;
}

export function DataTableToolbar({
   children,
   className,
}: DataTableToolbarProps) {
   return (
      <div
         className={cn(
            "flex flex-wrap items-center gap-2 justify-between",
            className,
         )}
      >
         {children}
      </div>
   );
}

export function DataTableToolbarGroup({
   children,
   className,
}: DataTableToolbarProps) {
   return (
      <div className={cn("flex flex-wrap items-center gap-2", className)}>
         {children}
      </div>
   );
}
