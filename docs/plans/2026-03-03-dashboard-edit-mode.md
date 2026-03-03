# Dashboard Edit Mode Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a PostHog-style edit mode to dashboards — triggered from the context panel Actions tab — where tiles become draggable/resizable, with Cancel/Save in the header and a toast notification on entry.

**Architecture:** `DashboardView` owns `isEditingLayout` state and registers a "Editar layout" page action via `usePageActions`. In edit mode, it renders Cancel/Save header buttons and fires a toast. `EditableDashboardGrid` accepts `isEditingLayout` and exposes save/cancel via callback refs (same pattern as `onOpenAddInsight`). `DashboardGrid` handles both sortable-reorder and resize-handle drag ends in a single `DndContext`. `DashboardTile` adds a `useDraggable` bottom-right corner resize handle visible only in edit mode.

**Tech Stack:** React, dnd-kit (`@dnd-kit/core` useDraggable + `@dnd-kit/sortable` useSortable), sonner (toast), TanStack Store (context panel pageActions), Tailwind CSS.

---

## Key File Map

| File | Role |
|------|------|
| `apps/web/src/features/analytics/ui/dashboard-view.tsx` | Owns `isEditingLayout` state, header actions, page actions, toast |
| `apps/web/src/features/analytics/ui/editable-dashboard-grid.tsx` | Accepts `isEditingLayout`, exposes save/cancel refs, removes UnsavedChangesBar |
| `apps/web/src/features/analytics/ui/dashboard-grid.tsx` | Handles resize drag end, passes `isEditing` + `onResize` down |
| `apps/web/src/features/analytics/ui/dashboard-tile.tsx` | Adds `useDraggable` resize handle at bottom-right corner |

---

## Task 1: Update `EditableDashboardGrid` — accept edit mode, remove UnsavedChangesBar, expose refs

**Files:**
- Modify: `apps/web/src/features/analytics/ui/editable-dashboard-grid.tsx`

**Step 1: Add `isEditingLayout`, `onSaveReady`, `onCancelReady` to the props interface**

Replace the `EditableDashboardGridProps` interface and the component signature:

```tsx
interface EditableDashboardGridProps {
   dashboard: Dashboard;
   onOpenAddInsight?: (handler: () => void) => void;
   isEditingLayout: boolean;
   onSaveReady?: (handler: () => void) => void;
   onCancelReady?: (handler: () => void) => void;
}

export function EditableDashboardGrid({
   dashboard,
   onOpenAddInsight: externalOnOpenAddInsight,
   isEditingLayout,
   onSaveReady,
   onCancelReady,
}: EditableDashboardGridProps) {
```

**Step 2: Expose `handleSave` and `handleCancel` to parent via refs (same pattern as `onOpenAddInsight`)**

Add these two `useEffect` calls right after the existing `onOpenAddInsight` useEffect:

```tsx
useEffect(() => {
   if (onSaveReady) onSaveReady(handleSave);
}, [onSaveReady, handleSave]);

useEffect(() => {
   if (onCancelReady) onCancelReady(handleCancel);
}, [onCancelReady, handleCancel]);
```

**Step 3: Remove the `UnsavedChangesBar` component and its usage entirely**

Delete the entire `UnsavedChangesBar` function (lines ~200–226).

In the return JSX, remove the conditional `{tilesChanged && <UnsavedChangesBar ... />}` block.

**Step 4: Pass `isEditing={isEditingLayout}` to `DashboardTile` and `onResize` to `DashboardGrid`**

Update the `DashboardGrid` call to also pass `isEditing` and `onResize`:

```tsx
<DashboardGrid
   isEditing={isEditingLayout}
   onReorder={handleReorder}
   onResize={handleResizeTile}
   renderTile={(tile) => (
      <DashboardTile
         globalDateRange={dashboard.globalDateRange ?? undefined}
         globalFilters={dashboard.globalFilters ?? undefined}
         id={tile.insightId}
         insightId={tile.insightId}
         isEditing={isEditingLayout}
         key={tile.insightId}
         onDuplicate={() => handleDuplicateTile(tile.insightId)}
         onRemove={() => handleRemoveTile(tile.insightId)}
         onResize={(size) => handleResizeTile(tile.insightId, size)}
         size={tile.size}
      />
   )}
   tiles={localTiles}
/>
```

**Step 5: Update empty state guard — show empty card only when NOT editing AND no tiles**

```tsx
if (localTiles.length === 0 && !isEditingLayout) {
   return (
      <Card>...</Card>
   );
}
```

**Step 6: Verify the file compiles — no TypeScript errors**

```bash
cd /home/yorizel/Documents/montte-nx
bun run typecheck 2>&1 | grep editable-dashboard-grid
```

Expected: no errors for this file.

**Step 7: Commit**

```bash
git add apps/web/src/features/analytics/ui/editable-dashboard-grid.tsx
git commit -m "feat(dashboards): wire isEditingLayout into EditableDashboardGrid, remove UnsavedChangesBar"
```

---

## Task 2: Update `DashboardGrid` — handle resize drag end + expose isEditing

**Files:**
- Modify: `apps/web/src/features/analytics/ui/dashboard-grid.tsx`

**Step 1: Add new props and imports**

Add `TileSize` import and update the interface:

```tsx
import { closestCenter, DndContext, type DragEndEvent } from "@dnd-kit/core";
import {
   arrayMove,
   rectSortingStrategy,
   SortableContext,
} from "@dnd-kit/sortable";
import type { DashboardTile as DashboardTileType } from "@packages/database/schemas/dashboards";
import { useRef } from "react";
import type { TileSize } from "./dashboard-tile";

interface DashboardGridProps {
   tiles: DashboardTileType[];
   onReorder: (tiles: DashboardTileType[]) => void;
   onResize?: (insightId: string, size: TileSize) => void;
   isEditing?: boolean;
   renderTile: (tile: DashboardTileType) => React.ReactNode;
}
```

**Step 2: Add `gridRef` and update the component signature**

```tsx
export function DashboardGrid({
   tiles,
   onReorder,
   onResize,
   isEditing,
   renderTile,
}: DashboardGridProps) {
   const gridRef = useRef<HTMLDivElement>(null);
   const sortedTiles = [...tiles].sort((a, b) => a.order - b.order);
```

**Step 3: Replace `handleDragEnd` to handle both sortable reorder and resize**

```tsx
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

const handleDragEnd = (event: DragEndEvent) => {
   const { active, over, delta } = event;
   const activeId = String(active.id);

   // Resize handle drag
   if (activeId.startsWith("resize-")) {
      const data = active.data.current as {
         insightId: string;
         currentSize: TileSize;
      };
      const containerWidth =
         gridRef.current?.getBoundingClientRect().width ?? 1000;
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
```

**Step 4: Add `ref` to the grid container div**

```tsx
<div className="grid grid-cols-12 gap-4 auto-rows-min" ref={gridRef}>
   {sortedTiles.map((tile) => renderTile(tile))}
</div>
```

**Step 5: Verify no TypeScript errors**

```bash
bun run typecheck 2>&1 | grep dashboard-grid
```

Expected: no errors.

**Step 6: Commit**

```bash
git add apps/web/src/features/analytics/ui/dashboard-grid.tsx
git commit -m "feat(dashboards): handle resize drag end in DashboardGrid"
```

---

## Task 3: Add resize handle to `DashboardTile`

**Files:**
- Modify: `apps/web/src/features/analytics/ui/dashboard-tile.tsx`

**Step 1: Add `useDraggable` import**

```tsx
import { useDraggable, useSortable } from "@dnd-kit/sortable";
```

Wait — `useDraggable` is from `@dnd-kit/core`, not `@dnd-kit/sortable`. Fix:

```tsx
import { useDraggable } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
```

**Step 2: Add `GripHorizontal` to the lucide imports**

The file already imports from `lucide-react`. Add `GripHorizontal` to the existing import:

```tsx
import {
   AlertCircle,
   Copy,
   Ellipsis,
   GripHorizontal,
   GripVertical,
   Maximize2,
   Pencil,
   RefreshCw,
   Settings2,
   Trash2,
} from "lucide-react";
```

**Step 3: Add `useDraggable` for the resize handle inside `DashboardTile`**

After the existing `useSortable` call, add:

```tsx
const {
   attributes: resizeAttributes,
   listeners: resizeListeners,
   setNodeRef: setResizeRef,
   isDragging: isResizing,
} = useDraggable({
   id: `resize-${id}`,
   data: { insightId: id, currentSize: size },
   disabled: !isEditing,
});
```

**Step 4: Add `relative` to the card container + `ring` when resizing**

Change the inner card div from:

```tsx
<div className="h-full rounded-lg border bg-card text-card-foreground">
```

To:

```tsx
<div
   className={cn(
      "h-full rounded-lg border bg-card text-card-foreground relative",
      isResizing && "ring-2 ring-primary/50",
   )}
>
```

**Step 5: Add the resize handle element at the bottom of the card, before the closing `</div>`**

Place it just before the closing `</div>` of the card (after the chart content area):

```tsx
{/* Resize handle — only in edit mode */}
{isEditing && (
   <div
      ref={setResizeRef}
      {...resizeListeners}
      {...resizeAttributes}
      className={cn(
         "absolute bottom-1 right-1 size-5 flex items-center justify-center rounded cursor-ew-resize opacity-30 hover:opacity-100 transition-opacity select-none",
         isResizing && "opacity-100",
      )}
   >
      <GripHorizontal className="size-3 text-muted-foreground" />
   </div>
)}
```

**Step 6: Verify no TypeScript errors**

```bash
bun run typecheck 2>&1 | grep dashboard-tile
```

Expected: no errors.

**Step 7: Commit**

```bash
git add apps/web/src/features/analytics/ui/dashboard-tile.tsx
git commit -m "feat(dashboards): add resize handle to DashboardTile using useDraggable"
```

---

## Task 4: Orchestrate edit mode in `DashboardView`

**Files:**
- Modify: `apps/web/src/features/analytics/ui/dashboard-view.tsx`

**Step 1: Add new imports**

```tsx
import { toast } from "sonner";
import { Layout } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { usePageActions } from "@/features/context-panel/use-context-panel";
```

Also add `Check`, `Loader2`, `RotateCcw` to existing lucide imports (they move from `editable-dashboard-grid.tsx`):

```tsx
import { Check, Clock, Layout, Loader2, Plus, RefreshCw, RotateCcw, X } from "lucide-react";
```

**Step 2: Add `isEditingLayout` state and save/cancel refs to `DashboardView`**

```tsx
export function DashboardView({ dashboard, children }: DashboardViewProps) {
   const addInsightRef = useRef<(() => void) | null>(null);
   const saveRef = useRef<(() => void) | null>(null);
   const cancelRef = useRef<(() => void) | null>(null);
   const [isEditingLayout, setIsEditingLayout] = useState(false);
   const [isSaving, setIsSaving] = useState(false);
```

**Step 3: Register context panel page action**

```tsx
usePageActions([
   {
      icon: Layout,
      label: "Editar layout",
      onClick: () => {
         if (!isEditingLayout) {
            setIsEditingLayout(true);
            toast.info("Editando o dashboard — salve para persistir as alterações", {
               id: "dashboard-edit-mode",
               duration: Number.POSITIVE_INFINITY,
            });
         }
      },
   },
]);
```

**Step 4: Add `handleSave` and `handleCancel` wrappers that manage mode state**

```tsx
const handleSave = useCallback(() => {
   setIsSaving(true);
   saveRef.current?.();
   // isSaving is reset after mutation resolves — handled via onSaveComplete
}, []);

const handleCancel = useCallback(() => {
   cancelRef.current?.();
   setIsEditingLayout(false);
   toast.dismiss("dashboard-edit-mode");
}, []);
```

For `handleSave`, the grid's mutation has its own `isPending`. To keep it simple, pass an `onSaveComplete` callback to `EditableDashboardGrid` that resets edit mode:

Add `onSaveComplete?: () => void` to `EditableDashboardGridProps` (in Task 1 file — add it now).

In `EditableDashboardGrid.handleSave`:
```tsx
const handleSave = useCallback(() => {
   saveMutation.mutate(
      { id: dashboard.id, tiles: localTiles },
      { onSuccess: () => onSaveComplete?.() }
   );
}, [saveMutation, dashboard.id, localTiles, onSaveComplete]);
```

In `DashboardView`, pass:
```tsx
onSaveComplete={() => {
   setIsEditingLayout(false);
   setIsSaving(false);
   toast.dismiss("dashboard-edit-mode");
}}
```

**Step 5: Update `DashboardHeader` to accept edit mode props**

Change `DashboardHeader` props:

```tsx
function DashboardHeader({
   dashboard,
   onAddInsight,
   isEditingLayout,
   isSaving,
   onSave,
   onCancel,
}: {
   dashboard: Dashboard;
   onAddInsight: () => void;
   isEditingLayout: boolean;
   isSaving: boolean;
   onSave: () => void;
   onCancel: () => void;
}) {
```

Change the `actions` prop passed to `PageHeader`:

```tsx
actions={
   isEditingLayout ? (
      <div className="flex items-center gap-2">
         <Button onClick={onCancel} variant="ghost">
            <RotateCcw className="size-4" />
            Cancelar
         </Button>
         <Button disabled={isSaving} onClick={onSave}>
            {isSaving ? (
               <Loader2 className="size-4 animate-spin" />
            ) : (
               <Check className="size-4" />
            )}
            Salvar
         </Button>
      </div>
   ) : (
      <Button onClick={onAddInsight}>
         <Plus className="size-3.5" />
         Adicionar insight
      </Button>
   )
}
```

**Step 6: Wire everything in the `DashboardView` return**

```tsx
return (
   <main className="flex flex-col gap-0">
      <DashboardHeader
         dashboard={dashboard}
         isEditingLayout={isEditingLayout}
         isSaving={isSaving}
         onAddInsight={() => addInsightRef.current?.()}
         onCancel={handleCancel}
         onSave={handleSave}
      />
      <DashboardFilterBar dashboard={dashboard} />
      <div className="flex flex-col gap-4 pt-4">
         {children}
         <EditableDashboardGrid
            dashboard={dashboard}
            isEditingLayout={isEditingLayout}
            onCancelReady={(fn) => { cancelRef.current = fn; }}
            onOpenAddInsight={(fn) => { addInsightRef.current = fn; }}
            onSaveComplete={() => {
               setIsEditingLayout(false);
               setIsSaving(false);
               toast.dismiss("dashboard-edit-mode");
            }}
            onSaveReady={(fn) => { saveRef.current = fn; }}
         />
      </div>
   </main>
);
```

**Step 7: Verify no TypeScript errors across all modified files**

```bash
bun run typecheck 2>&1 | grep -E "dashboard-(view|grid|tile)|editable-dashboard"
```

Expected: no errors.

**Step 8: Commit**

```bash
git add apps/web/src/features/analytics/ui/dashboard-view.tsx
git commit -m "feat(dashboards): add edit mode toggle with Cancel/Save header buttons and toast notification"
```

---

## Task 5: Fix `EditableDashboardGrid` — add `onSaveComplete` prop (missed in Task 1)

> If you completed Task 4 and realize `onSaveComplete` was not added in Task 1, do it now.

**Files:**
- Modify: `apps/web/src/features/analytics/ui/editable-dashboard-grid.tsx`

**Step 1: Add `onSaveComplete` to the interface**

```tsx
interface EditableDashboardGridProps {
   dashboard: Dashboard;
   onOpenAddInsight?: (handler: () => void) => void;
   isEditingLayout: boolean;
   onSaveReady?: (handler: () => void) => void;
   onCancelReady?: (handler: () => void) => void;
   onSaveComplete?: () => void;
}
```

**Step 2: Destructure and use in `handleSave`**

```tsx
export function EditableDashboardGrid({
   dashboard,
   onOpenAddInsight: externalOnOpenAddInsight,
   isEditingLayout,
   onSaveReady,
   onCancelReady,
   onSaveComplete,
}: EditableDashboardGridProps) {
```

Update `handleSave`:

```tsx
const handleSave = useCallback(() => {
   saveMutation.mutate(
      { id: dashboard.id, tiles: localTiles },
      { onSuccess: () => onSaveComplete?.() },
   );
}, [saveMutation, dashboard.id, localTiles, onSaveComplete]);
```

> Note: The existing `saveMutation` uses `mutationOptions` with an `onSuccess`. The inline `onSuccess` in `mutate()` fires AFTER the options-level one. Both run — this is correct behavior.

**Step 3: Verify and commit**

```bash
bun run typecheck 2>&1 | grep editable-dashboard-grid
git add apps/web/src/features/analytics/ui/editable-dashboard-grid.tsx
git commit -m "feat(dashboards): add onSaveComplete callback to EditableDashboardGrid"
```

---

## Task 6: Manual verification

**Step 1: Start the dev server**

```bash
bun dev
```

**Step 2: Navigate to a dashboard**

Open `http://localhost:5173` → navigate to any dashboard.

**Step 3: Verify view mode**

- [ ] Tiles render normally — no drag handles visible, no resize handles at corners
- [ ] The context panel "Ações" tab shows "Editar layout" action

**Step 4: Enter edit mode via context panel**

- [ ] Click "Editar layout" in the context panel
- [ ] Toast appears: *"Editando o dashboard — salve para persistir as alterações"*
- [ ] Header shows Cancel + Save buttons (replacing "Adicionar insight")
- [ ] Tiles show drag handle (GripVertical) on the left
- [ ] Tiles show resize handle (GripHorizontal dots) at bottom-right corner

**Step 5: Drag to reorder**

- [ ] Drag a tile by its grip handle — tile moves to new position
- [ ] Release — order updates in local state

**Step 6: Drag resize handle**

- [ ] Drag the bottom-right corner handle horizontally
- [ ] Tile size snaps to new size on release (sm/md/lg/full)

**Step 7: Save**

- [ ] Click Save — spinner appears, then modal closes, toast dismisses, returns to view mode
- [ ] Refresh page — tile order and sizes persist

**Step 8: Cancel**

- [ ] Enter edit mode, make changes, click Cancel
- [ ] Tiles revert to original state, view mode restored, toast dismisses

---

## Notes

- `isSaving` in `DashboardView` is set to `true` when `handleSave` is called and reset via `onSaveComplete`. If the mutation fails, `isSaving` stays `true`. To handle this, also hook into `onError` from `EditableDashboardGrid` — or add `onSaveError?: () => void` prop following the same pattern.
- The `usePageActions` hook has no dep array by design (see comment in `use-context-panel.ts`) — the `onClick` closes over the latest `isEditingLayout` value correctly.
- The toast uses `id: "dashboard-edit-mode"` so multiple clicks on "Editar layout" don't stack multiple toasts.
- `useDraggable` and `useSortable` both register with the same parent `DndContext` in `DashboardGrid`. They use different ID namespaces (`resize-${id}` vs `${id}`) so there's no conflict.
