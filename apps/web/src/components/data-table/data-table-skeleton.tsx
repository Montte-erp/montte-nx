import type { ColumnDef } from "@tanstack/react-table";

import { Skeleton } from "@packages/ui/components/skeleton";
import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
} from "@packages/ui/components/table";

interface DataTableSkeletonProps {
   columns: ColumnDef<any, any>[];
   rows?: number;
}

export function DataTableSkeleton({
   columns,
   rows = 5,
}: DataTableSkeletonProps) {
   return (
      <div className="rounded-md border overflow-hidden">
         <Table className="border-separate border-spacing-0">
            <TableHeader>
               <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="w-[40px] px-2">
                     <Skeleton className="h-4 w-4" />
                  </TableHead>
                  {columns.map((_, i) => (
                     <TableHead key={`skeleton-head-${i + 1}`}>
                        <Skeleton className="h-4 w-24" />
                     </TableHead>
                  ))}
                  <TableHead className="w-0" />
               </TableRow>
            </TableHeader>
            <TableBody>
               {Array.from({ length: rows }, (_, rowIdx) => (
                  <TableRow
                     key={`skeleton-row-${rowIdx + 1}`}
                     className="bg-card"
                  >
                     <TableCell className="w-[40px] px-2">
                        <Skeleton className="size-4" />
                     </TableCell>
                     {columns.map((_, colIdx) => (
                        <TableCell
                           key={`skeleton-cell-${rowIdx + 1}-${colIdx + 1}`}
                        >
                           <Skeleton className="h-4 w-full" />
                        </TableCell>
                     ))}
                     <TableCell className="w-0" />
                  </TableRow>
               ))}
            </TableBody>
         </Table>
      </div>
   );
}
