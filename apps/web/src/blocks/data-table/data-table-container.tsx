import { ScrollArea } from "@packages/ui/components/scroll-area";
import { Table } from "@packages/ui/components/table";
import { cn } from "@packages/ui/lib/utils";
import type React from "react";

interface DataTableContainerProps {
   id?: string;
   children: React.ReactNode;
   maxHeight?: number | string;
   className?: string;
}

export function DataTableContainer({
   id,
   children,
   maxHeight,
   className,
}: DataTableContainerProps) {
   return (
      <ScrollArea
         className={cn("rounded-md border bg-card", className)}
         id={id}
         style={maxHeight ? { maxHeight } : undefined}
      >
         <Table>{children}</Table>
      </ScrollArea>
   );
}
