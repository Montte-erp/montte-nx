import { TableBody, TableCell, TableRow } from "@packages/ui/components/table";
import { Button } from "@packages/ui/components/button";
import { cn } from "@packages/ui/lib/utils";
import {
   flexRender,
   type Column,
   type Row,
   type Table,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
   Fragment,
   useCallback,
   useLayoutEffect,
   useMemo,
   useState,
} from "react";
import type { CSSProperties, ReactNode } from "react";

function getPinStyles<TData>(column: Column<TData>): CSSProperties {
   const pin = column.getIsPinned();
   if (!pin) return {};
   const isLeft = pin === "left";
   const offset = isLeft ? column.getStart("left") : column.getAfter("right");
   return {
      position: "sticky",
      [isLeft ? "left" : "right"]: `${offset}px`,
      zIndex: 1,
      background: "var(--card)",
   };
}

interface DataTableBodyProps<TData> {
   table: Table<TData>;
   getRowClassName?: (props: { row: Row<TData> }) => string | undefined;
   renderRow?: (props: { row: Row<TData> }) => React.ReactNode;
   renderExpandedRow?: (props: { row: Row<TData> }) => ReactNode;
   renderGroupLabel?: (props: { row: Row<TData> }) => ReactNode;
   showGroupToggle?: boolean;
   virtualized?: boolean;
   estimateRowHeight?: number;
   overscan?: number;
}

type RenderItem<TData> =
   | { kind: "row"; row: Row<TData> }
   | { kind: "expanded"; row: Row<TData> };

function defaultGroupLabel<TData>(row: Row<TData>): ReactNode {
   const groupingColumnId = row.groupingColumnId;
   const groupColumn = groupingColumnId
      ? row.getAllCells().find((c) => c.column.id === groupingColumnId)?.column
      : undefined;
   const formatter = groupColumn?.columnDef.meta?.formatGroupLabel;
   const value = row.groupingValue;
   const label = formatter
      ? formatter(value)
      : value === null || value === undefined || value === ""
        ? "—"
        : String(value);
   const columnLabel = groupColumn?.columnDef.meta?.label;
   const count = row.subRows.length;
   return (
      <div className="flex items-center gap-2">
         {columnLabel ? (
            <span className="text-muted-foreground text-xs uppercase tracking-wide">
               {columnLabel}
            </span>
         ) : null}
         <span className="font-medium">{label}</span>
         <span className="text-muted-foreground text-xs">
            {count} {count === 1 ? "item" : "itens"}
         </span>
      </div>
   );
}

export function DataTableBody<TData>({
   table,
   getRowClassName,
   renderRow,
   renderExpandedRow,
   renderGroupLabel,
   showGroupToggle = true,
   virtualized = false,
   estimateRowHeight = 48,
   overscan = 5,
}: DataTableBodyProps<TData>) {
   const rows = table.getRowModel().rows;
   const colSpan = table.getVisibleLeafColumns().length;
   const [scrollElement, setScrollElement] = useState<HTMLElement | null>(null);
   const [bodyElement, setBodyElement] =
      useState<HTMLTableSectionElement | null>(null);
   const [scrollMargin, setScrollMargin] = useState(0);

   const renderItems = useMemo(() => {
      const items: RenderItem<TData>[] = [];
      for (const row of rows) {
         items.push({ kind: "row", row });
         if (!row.getIsGrouped() && row.getIsExpanded() && renderExpandedRow) {
            items.push({ kind: "expanded", row });
         }
      }
      return items;
   }, [renderExpandedRow, rows]);

   const handleBodyRef = useCallback((node: HTMLTableSectionElement | null) => {
      setBodyElement(node);
      if (!node) {
         setScrollElement(null);
         return;
      }
      const viewport = node.closest('[data-slot="scroll-area-viewport"]');
      setScrollElement(viewport instanceof HTMLElement ? viewport : null);
   }, []);

   const updateScrollMargin = useCallback(() => {
      if (!bodyElement || !scrollElement) return;
      const bodyRect = bodyElement.getBoundingClientRect();
      const scrollRect = scrollElement.getBoundingClientRect();
      const next = Math.max(
         0,
         bodyRect.top - scrollRect.top + scrollElement.scrollTop,
      );
      setScrollMargin((current) =>
         Math.abs(current - next) > 1 ? next : current,
      );
   }, [bodyElement, scrollElement]);

   useLayoutEffect(() => {
      if (!virtualized || !bodyElement || !scrollElement) return;
      updateScrollMargin();
      const frame = window.requestAnimationFrame(updateScrollMargin);
      const resizeObserver = new ResizeObserver(updateScrollMargin);
      resizeObserver.observe(bodyElement);
      if (scrollElement.firstElementChild) {
         resizeObserver.observe(scrollElement.firstElementChild);
      }
      return () => {
         window.cancelAnimationFrame(frame);
         resizeObserver.disconnect();
      };
   }, [bodyElement, scrollElement, updateScrollMargin, virtualized]);

   const rowVirtualizer = useVirtualizer({
      count: virtualized ? renderItems.length : 0,
      estimateSize: (index) =>
         renderItems[index]?.kind === "expanded" ? 160 : estimateRowHeight,
      getItemKey: (index) => {
         const item = renderItems[index];
         if (!item) return index;
         return item.kind === "expanded"
            ? `${item.row.id}__expanded`
            : item.row.id;
      },
      getScrollElement: () => scrollElement,
      overscan,
      scrollMargin,
   });

   const renderGroupRow = useCallback(
      (row: Row<TData>) => (
         <TableRow
            key={row.id}
            className="border-y border-border bg-accent/50 hover:bg-accent/60"
         >
            <TableCell className="py-2 text-foreground" colSpan={colSpan}>
               <div className="flex items-center gap-2">
                  {showGroupToggle ? (
                     <Button
                        aria-label={
                           row.getIsExpanded()
                              ? "Recolher grupo"
                              : "Expandir grupo"
                        }
                        onClick={row.getToggleExpandedHandler()}
                        size="icon-sm"
                        variant="ghost"
                     >
                        {row.getIsExpanded() ? (
                           <ChevronDown />
                        ) : (
                           <ChevronRight />
                        )}
                     </Button>
                  ) : null}
                  {renderGroupLabel
                     ? renderGroupLabel({ row })
                     : defaultGroupLabel(row)}
               </div>
            </TableCell>
         </TableRow>
      ),
      [colSpan, renderGroupLabel, showGroupToggle],
   );

   const renderDataRow = useCallback(
      (row: Row<TData>) => {
         if (row.getIsGrouped()) return renderGroupRow(row);
         if (renderRow) return renderRow({ row });
         return (
            <TableRow
               className={getRowClassName?.({ row })}
               data-selected={row.getIsSelected()}
               data-state={row.getIsSelected() ? "selected" : undefined}
               key={row.id}
            >
               {row.getVisibleCells().map((cell) => {
                  const col = cell.column;
                  const align = col.columnDef.meta?.align ?? "left";
                  return (
                     <TableCell
                        key={cell.id}
                        style={{
                           width: cell.column.getSize(),
                           textAlign: align,
                           ...getPinStyles(col),
                        }}
                        className={cn(
                           col.getIsPinned() &&
                              "shadow-[inset_-1px_0_0_var(--border)]",
                        )}
                     >
                        {flexRender(col.columnDef.cell, cell.getContext())}
                     </TableCell>
                  );
               })}
            </TableRow>
         );
      },
      [getRowClassName, renderGroupRow, renderRow],
   );

   const renderExpanded = useCallback(
      (row: Row<TData>) => {
         if (!renderExpandedRow) return null;
         return (
            <TableRow data-expanded key={`${row.id}__expanded`}>
               <TableCell
                  className="bg-muted/20"
                  colSpan={row.getVisibleCells().length}
               >
                  {renderExpandedRow({ row })}
               </TableCell>
            </TableRow>
         );
      },
      [renderExpandedRow],
   );

   const renderItem = useCallback(
      (item: RenderItem<TData>) =>
         item.kind === "expanded"
            ? renderExpanded(item.row)
            : renderDataRow(item.row),
      [renderDataRow, renderExpanded],
   );

   if (!virtualized) {
      return (
         <TableBody>
            {rows.map((row) => (
               <Fragment key={row.id}>
                  {renderDataRow(row)}
                  {!row.getIsGrouped() &&
                     row.getIsExpanded() &&
                     renderExpanded(row)}
               </Fragment>
            ))}
         </TableBody>
      );
   }

   const virtualRows = rowVirtualizer.getVirtualItems();
   const firstVirtualRow = virtualRows[0];
   const lastVirtualRow = virtualRows[virtualRows.length - 1];
   const topPadding = Math.max(
      0,
      firstVirtualRow ? firstVirtualRow.start - scrollMargin : 0,
   );
   const bottomPadding = Math.max(
      0,
      lastVirtualRow
         ? rowVirtualizer.getTotalSize() - (lastVirtualRow.end - scrollMargin)
         : 0,
   );

   return (
      <TableBody ref={handleBodyRef}>
         {topPadding > 0 ? (
            <TableRow
               aria-hidden="true"
               className="border-0 hover:bg-transparent"
            >
               <TableCell
                  className="border-0 p-0"
                  colSpan={colSpan}
                  style={{ height: topPadding }}
               />
            </TableRow>
         ) : null}
         {virtualRows.map((virtualRow) => {
            const item = renderItems[virtualRow.index];
            if (!item) return null;
            return <Fragment key={virtualRow.key}>{renderItem(item)}</Fragment>;
         })}
         {bottomPadding > 0 ? (
            <TableRow
               aria-hidden="true"
               className="border-0 hover:bg-transparent"
            >
               <TableCell
                  className="border-0 p-0"
                  colSpan={colSpan}
                  style={{ height: bottomPadding }}
               />
            </TableRow>
         ) : null}
      </TableBody>
   );
}
