import { closestCenter, DndContext, type DragEndEvent } from "@dnd-kit/core";
import {
   arrayMove,
   rectSortingStrategy,
   SortableContext,
} from "@dnd-kit/sortable";
import type { DashboardTile as DashboardTileType } from "@core/database/schemas/dashboards";
import { useCallback, useRef, useState } from "react";
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

export interface TileResizeProps {
   isResizing: boolean;
   onResizePreview: (deltaX: number, startSize: TileSize) => void;
   onResizeCommit: () => void;
}

interface DashboardGridProps {
   tiles: DashboardTileType[];
   onReorder: (tiles: DashboardTileType[]) => void;
   onResize?: (insightId: string, size: TileSize) => void;
   renderTile: (
      tile: DashboardTileType,
      resizeProps: TileResizeProps,
   ) => React.ReactNode;
}

export function DashboardGrid({
   tiles,
   onReorder,
   onResize,
   renderTile,
}: DashboardGridProps) {
   const gridRef = useRef<HTMLDivElement>(null);
   const sortedTiles = [...tiles].sort((a, b) => a.order - b.order);

   // Resize state — ref for stable access in callbacks, state for re-renders
   const resizePreviewRef = useRef<{
      insightId: string;
      size: TileSize;
   } | null>(null);
   const [resizePreview, setResizePreview] = useState<{
      insightId: string;
      size: TileSize;
   } | null>(null);

   const handleResizePreview = useCallback(
      (insightId: string, deltaX: number, startSize: TileSize) => {
         const containerWidth =
            gridRef.current?.getBoundingClientRect().width ?? 1000;
         const newFrac = Math.max(
            0.1,
            Math.min(1.0, sizeToFraction[startSize] + deltaX / containerWidth),
         );
         const newSize = fractionToSize(newFrac);
         const current = resizePreviewRef.current;
         if (current?.insightId === insightId && current.size === newSize)
            return;
         resizePreviewRef.current = { insightId, size: newSize };
         setResizePreview({ insightId, size: newSize });
      },
      [],
   );

   const handleResizeCommit = useCallback(
      (insightId: string) => {
         const preview = resizePreviewRef.current;
         resizePreviewRef.current = null;
         setResizePreview(null);
         if (preview?.insightId === insightId) {
            onResize?.(insightId, preview.size);
         }
      },
      [onResize],
   );

   const handleDragEnd = (event: DragEndEvent) => {
      const { active, over } = event;

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
            <div
               className="grid grid-cols-12 gap-4 auto-rows-min"
               ref={gridRef}
            >
               {sortedTiles.map((tile) => {
                  const effectiveTile =
                     resizePreview?.insightId === tile.insightId
                        ? { ...tile, size: resizePreview.size }
                        : tile;
                  return renderTile(effectiveTile, {
                     isResizing: resizePreview?.insightId === tile.insightId,
                     onResizePreview: (deltaX, startSize) =>
                        handleResizePreview(tile.insightId, deltaX, startSize),
                     onResizeCommit: () => handleResizeCommit(tile.insightId),
                  });
               })}
            </div>
         </SortableContext>
      </DndContext>
   );
}
