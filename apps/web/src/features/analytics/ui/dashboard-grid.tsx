import { useRef } from "react";
import { closestCenter, DndContext, type DragEndEvent } from "@dnd-kit/core";
import {
   arrayMove,
   rectSortingStrategy,
   SortableContext,
} from "@dnd-kit/sortable";
import type { DashboardTile as DashboardTileType } from "@packages/database/schemas/dashboards";
import type { TileSize } from "./dashboard-tile";

const sizeToFraction: Record<TileSize, number> = {
   sm: 0.25,
   md: 0.5,
   lg: 0.75,
   full: 1.0,
};

function fractionToSize(fraction: number): TileSize {
   if (fraction < 0.375) return "sm";
   if (fraction < 0.625) return "md";
   if (fraction < 0.875) return "lg";
   return "full";
}

interface DashboardGridProps {
   tiles: DashboardTileType[];
   onReorder: (tiles: DashboardTileType[]) => void;
   onResize?: (insightId: string, size: TileSize) => void;
   renderTile: (tile: DashboardTileType) => React.ReactNode;
}

export function DashboardGrid({
   tiles,
   onReorder,
   onResize,
   renderTile,
}: DashboardGridProps) {
   const gridRef = useRef<HTMLDivElement>(null);
   const sortedTiles = [...tiles].sort((a, b) => a.order - b.order);

   const handleDragEnd = (event: DragEndEvent) => {
      const { active, over, delta } = event;
      const activeId = String(active.id);

      // Resize handle drag
      if (activeId.startsWith("resize-")) {
         const raw = active.data.current;
         if (
            !raw ||
            typeof raw.insightId !== "string" ||
            typeof raw.currentSize !== "string"
         ) return;
         const data = raw as { insightId: string; currentSize: TileSize };
         const containerWidth =
            gridRef.current?.getBoundingClientRect().width || 1000;
         const currentWidth = sizeToFraction[data.currentSize] * containerWidth;
         const newFraction = Math.max(
            0.1,
            Math.min(1.0, (currentWidth + delta.x) / containerWidth),
         );
         onResize?.(data.insightId, fractionToSize(newFraction));
         return;
      }

      // Sortable reorder drag
      if (over && active.id !== over.id) {
         const oldIndex = sortedTiles.findIndex(
            (t) => t.insightId === active.id,
         );
         const newIndex = sortedTiles.findIndex((t) => t.insightId === over.id);
         const reordered = arrayMove(sortedTiles, oldIndex, newIndex).map(
            (tile, index) => ({ ...tile, order: index }),
         );
         onReorder(reordered);
      }
   };

   return (
      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
         <SortableContext
            items={sortedTiles.map((t) => t.insightId)}
            strategy={rectSortingStrategy}
         >
            <div className="grid grid-cols-12 gap-4 auto-rows-min" ref={gridRef}>
               {sortedTiles.map((tile) => renderTile(tile))}
            </div>
         </SortableContext>
      </DndContext>
   );
}
