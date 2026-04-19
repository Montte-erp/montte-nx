"use client";

import { X } from "lucide-react";
import type * as React from "react";
import { cn } from "../lib/utils";
import { Button } from "./button";

interface SelectionActionBarProps {
   selectedCount: number;
   summary?: React.ReactNode;
   onClear: () => void;
   children: React.ReactNode;
   className?: string;
}

function SelectionActionBar({
   selectedCount,
   summary,
   onClear,
   children,
   className,
}: SelectionActionBarProps) {
   if (selectedCount === 0) {
      return null;
   }

   return (
      <div
         data-selection-toolbar
         className={cn(
            "fixed bottom-4 left-1/2 -translate-x-1/2 z-[60]",
            "flex items-center gap-2 md:gap-4 px-4 py-2 md:py-4",
            "bg-background border border-border",
            "rounded-lg shadow-lg",
            "animate-in slide-in-from-bottom-4 fade-in duration-200 motion-reduce:animate-none",
            className,
         )}
      >
         <div
            aria-atomic="true"
            aria-live="polite"
            className="flex items-center gap-2 text-sm font-medium whitespace-nowrap"
         >
            <span className="tabular-nums">{selectedCount}</span>
            <span className="hidden sm:inline">
               {selectedCount === 1 ? "selecionado" : "selecionados"}
            </span>
            {summary && (
               <span className="hidden md:inline text-muted-foreground">
                  {summary}
               </span>
            )}
         </div>

         <Button
            aria-label="Limpar seleção"
            className="h-8 gap-2 px-2"
            onClick={onClear}
            variant="outline"
         >
            <X className="size-3.5" />
            <span className="hidden sm:inline text-xs">Limpar</span>
         </Button>

         <div className="h-4 w-px bg-border" />

         <div className="flex items-center gap-2 md:gap-4">{children}</div>
      </div>
   );
}

interface SelectionActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
   variant?: "default" | "destructive";
   icon?: React.ReactNode;
}

function SelectionActionButton({
   children,
   variant = "default",
   icon,
   className,
   ...props
}: SelectionActionButtonProps) {
   return (
      <Button
         className={cn(
            "h-8 px-2 md:px-4 text-xs md:text-sm gap-2",
            variant === "destructive" &&
               "bg-destructive/10 hover:bg-destructive/20 text-destructive border-destructive/30",
            className,
         )}
         variant="outline"
         {...props}
      >
         {icon}
         <span className="hidden sm:inline">{children}</span>
      </Button>
   );
}

export { SelectionActionBar, SelectionActionButton };
