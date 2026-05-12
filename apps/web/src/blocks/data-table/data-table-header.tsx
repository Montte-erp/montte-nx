import {
   TableHead,
   TableHeader,
   TableRow,
} from "@packages/ui/components/table";
import { Button } from "@packages/ui/components/button";
import { cn } from "@packages/ui/lib/utils";
import {
   flexRender,
   type Column,
   type Header,
   type RowData,
   type Table,
} from "@tanstack/react-table";
import {
   DndContext,
   KeyboardSensor,
   MouseSensor,
   TouchSensor,
   closestCenter,
   useSensor,
   useSensors,
   type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";
import {
   SortableContext,
   arrayMove,
   horizontalListSortingStrategy,
   useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
   ChevronDown,
   ChevronUp,
   GripVertical,
   Pin,
   PinOff,
} from "lucide-react";
import { useId, useMemo, type CSSProperties } from "react";

declare module "@tanstack/react-table" {
   interface ColumnMeta<TData extends RowData, TValue> {
      resizable?: boolean;
      pinnable?: boolean;
      reorderable?: boolean;
      exportValue?: (row: TData, value: TValue) => string;
      exportIgnore?: boolean;
   }
}

function getPinStyles<TData>(column: Column<TData>): CSSProperties {
   const pin = column.getIsPinned();
   if (!pin) return {};
   const isLeft = pin === "left";
   const offset = isLeft ? column.getStart("left") : column.getAfter("right");
   return {
      position: "sticky",
      [isLeft ? "left" : "right"]: `${offset}px`,
      zIndex: 2,
      background: "var(--card)",
   };
}

interface DataTableHeaderProps<TData> {
   table: Table<TData>;
}

export function DataTableHeader<TData>({ table }: DataTableHeaderProps<TData>) {
   const dndId = useId();
   const sensors = useSensors(
      useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
      useSensor(TouchSensor, {}),
      useSensor(KeyboardSensor, {}),
   );

   const leafIds = useMemo(
      () => table.getAllLeafColumns().map((c) => c.id),
      [table],
   );
   const columnOrder = table.getState().columnOrder;
   const effectiveOrder =
      columnOrder && columnOrder.length > 0 ? columnOrder : leafIds;

   function handleDragEnd(event: DragEndEvent) {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = effectiveOrder.indexOf(String(active.id));
      const newIndex = effectiveOrder.indexOf(String(over.id));
      if (oldIndex === -1 || newIndex === -1) return;
      table.setColumnOrder(arrayMove(effectiveOrder, oldIndex, newIndex));
   }

   return (
      <DndContext
         id={dndId}
         collisionDetection={closestCenter}
         modifiers={[restrictToHorizontalAxis]}
         onDragEnd={handleDragEnd}
         sensors={sensors}
      >
         <TableHeader className="sticky top-0 z-10 bg-card">
            {table.getHeaderGroups().map((group) => (
               <TableRow key={group.id}>
                  <SortableContext
                     items={effectiveOrder}
                     strategy={horizontalListSortingStrategy}
                  >
                     {group.headers.map((header) => (
                        <SortableTableHead<TData>
                           key={header.id}
                           header={header}
                        />
                     ))}
                  </SortableContext>
               </TableRow>
            ))}
         </TableHeader>
      </DndContext>
   );
}

interface SortableTableHeadProps<TData> {
   header: Header<TData, unknown>;
}

function SortableTableHead<TData>({ header }: SortableTableHeadProps<TData>) {
   const col = header.column;
   const meta = col.columnDef.meta;
   const canSort = col.getCanSort();
   const sortDir = col.getIsSorted();
   const align = meta?.align ?? "left";
   const isSystemColumn = col.id.startsWith("__");
   const reorderable = !isSystemColumn && meta?.reorderable !== false;
   const resizable = !isSystemColumn && meta?.resizable !== false;

   const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
   } = useSortable({ id: col.id, disabled: !reorderable });

   const ariaSort =
      sortDir === "asc"
         ? "ascending"
         : sortDir === "desc"
           ? "descending"
           : "none";
   const toggleSort = canSort ? col.getToggleSortingHandler() : undefined;

   const sortableStyle: CSSProperties = reorderable
      ? {
           transform: CSS.Translate.toString(transform),
           transition,
           opacity: isDragging ? 0.6 : 1,
           zIndex: isDragging ? 3 : undefined,
        }
      : {};

   return (
      <TableHead
         ref={reorderable ? setNodeRef : undefined}
         colSpan={header.colSpan}
         aria-sort={canSort ? ariaSort : undefined}
         style={{
            width: header.getSize(),
            textAlign: align,
            ...getPinStyles(col),
            ...sortableStyle,
         }}
         className={cn(
            "relative",
            col.getIsPinned() && "shadow-[inset_-1px_0_0_var(--border)]",
         )}
      >
         {header.isPlaceholder ? null : (
            <div className="flex items-center gap-2">
               {reorderable && (
                  <button
                     {...attributes}
                     {...listeners}
                     type="button"
                     aria-label="Arrastar para reordenar coluna"
                     className="size-4 shrink-0 inline-flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                     <GripVertical className="size-4" />
                  </button>
               )}
               <div
                  className={cn(
                     "flex flex-1 items-center gap-2 truncate",
                     canSort &&
                        "cursor-pointer select-none rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                  onClick={toggleSort}
                  onKeyDown={(e) => {
                     if (canSort && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault();
                        toggleSort?.(e);
                     }
                  }}
                  tabIndex={canSort ? 0 : undefined}
                  role={canSort ? "button" : undefined}
               >
                  <span className="flex-1 truncate">
                     {flexRender(col.columnDef.header, header.getContext())}
                  </span>
                  {canSort && sortDir === "asc" && (
                     <ChevronUp className="size-4 shrink-0 text-muted-foreground" />
                  )}
                  {canSort && sortDir === "desc" && (
                     <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                  )}
               </div>
               {meta?.pinnable && col.getCanPin() && (
                  <Button
                     className="size-4"
                     onClick={() => col.pin(col.getIsPinned() ? false : "left")}
                     size="icon"
                     tooltip={
                        col.getIsPinned() ? "Desafixar coluna" : "Fixar coluna"
                     }
                     type="button"
                     variant="ghost"
                  >
                     {col.getIsPinned() ? (
                        <PinOff className="size-4" />
                     ) : (
                        <Pin className="size-4" />
                     )}
                  </Button>
               )}
            </div>
         )}
         {resizable && col.getCanResize() && (
            <div
               onMouseDown={header.getResizeHandler()}
               onTouchStart={header.getResizeHandler()}
               className={cn(
                  "absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none bg-transparent hover:bg-primary/50",
                  col.getIsResizing() && "bg-primary",
               )}
            />
         )}
      </TableHead>
   );
}
