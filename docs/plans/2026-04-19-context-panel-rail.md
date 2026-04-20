# Context Panel Rail Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move context panel tab icons from the panel header into a permanent vertical rail on the right edge of the content area, so tabs are always visible regardless of panel state.

**Architecture:** A new `ContextPanelRail` component reads from the existing `allTabMetasStore` and `contextPanelStore` and renders a narrow icon strip. The rail is placed inside `SidebarInset` as a row sibling to `main`. The panel header loses tab buttons; only the close button remains. On mobile the rail is hidden and the existing `ContextPanelHeaderActions` stays for mobile users.

**Tech Stack:** TanStack React Store, Tailwind CSS, Lucide icons, `@packages/ui/components/button` (has `tooltip` / `tooltipSide` props), existing context panel store + mutators.

---

## Context — Current Structure

```
SidebarProvider
├── SidebarManager (main) → AppSidebar
├── SidebarInset
│   ├── SidebarSubPanel
│   ├── div.flex.flex-col (rounded bg-background)   ← CHANGE THIS
│   │   └── main (flex-1, overflow-y-auto)
│   ├── AutoBugReporter
│   └── MonthlySatisfactionSurvey
└── GlobalContextPanel (SidebarManager right panel)
     └── ContextPanelInner
          ├── SidebarHeader  ← tab buttons live here NOW → REMOVE
          └── SidebarContent → active tab content
```

Target:

```
SidebarInset
├── SidebarSubPanel
├── div.flex.flex-row (rounded bg-background)   ← flex-row now
│   ├── main (flex-1)
│   └── ContextPanelRail (w-10, hidden on mobile)  ← NEW
```

---

## Task 1: Create `ContextPanelRail` component

**Files:**
- Create: `apps/web/src/features/context-panel/context-panel-rail.tsx`

No tests needed — pure UI, no logic to unit-test in isolation.

**Step 1: Create the file**

```tsx
import { Button } from "@packages/ui/components/button";
import { useStore } from "@tanstack/react-store";
import { cn } from "@packages/ui/lib/utils";
import {
   allTabMetasStore,
   contextPanelStore,
} from "./context-panel-store";
import {
   closeContextPanel,
   openContextPanel,
   setActiveTab,
} from "./use-context-panel";

export function ContextPanelRail() {
   const allTabMetas = useStore(allTabMetasStore, (s) => s);
   const isOpen = useStore(contextPanelStore, (s) => s.isOpen);
   const activeTabId = useStore(contextPanelStore, (s) => s.activeTabId);

   const handleTabClick = (tabId: string) => {
      if (isOpen && activeTabId === tabId) {
         closeContextPanel();
      } else if (isOpen) {
         setActiveTab(tabId);
      } else {
         setActiveTab(tabId);
         openContextPanel();
      }
   };

   return (
      <div className="hidden md:flex flex-col items-center py-2 w-10 shrink-0 gap-1 border-l">
         {allTabMetas.map((tab) => (
            <Button
               className={cn(
                  "size-8 p-0",
                  isOpen &&
                     activeTabId === tab.id &&
                     "bg-accent text-accent-foreground",
               )}
               key={tab.id}
               onClick={() => handleTabClick(tab.id)}
               size="icon"
               tooltip={tab.label}
               tooltipSide="left"
               type="button"
               variant="ghost"
            >
               <tab.icon className="size-4" />
            </Button>
         ))}
      </div>
   );
}
```

**Step 2: Verify TypeScript compiles**

```bash
cd apps/web && bun run typecheck 2>&1 | grep "context-panel-rail"
```

Expected: no errors for this file.

**Step 3: Commit**

```bash
git add apps/web/src/features/context-panel/context-panel-rail.tsx
git commit -m "feat(context-panel): add ContextPanelRail component"
```

---

## Task 2: Update `ContextPanelInner` — strip tab buttons from panel header

**Files:**
- Modify: `apps/web/src/features/context-panel/context-panel.tsx`

The `SidebarHeader` currently renders all tab buttons in a row. Replace with just the active tab label + close button (or just the close button).

**Step 1: Edit `ContextPanelInner` in `context-panel.tsx`**

Find this block (lines 156–185):

```tsx
<SidebarHeader className="bg-background rounded-t-xl">
   <div className="flex-row flex items-center gap-2">
      {allTabMetas.map((tab) => (
         <Button
            className={cn(
               "",
               activeTabMeta?.id === tab.id &&
                  "bg-accent text-accent-foreground",
            )}
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            tooltip={tab.label}
            tooltipSide="bottom"
            type="button"
            variant="outline"
         >
            <tab.icon className="" />
         </Button>
      ))}
      <div className="flex-1" />
      <Button
         onClick={closeContextPanel}
         tooltip="Fechar painel"
         type="button"
         variant="outline"
      >
         <X className="" />
      </Button>
   </div>
</SidebarHeader>
```

Replace with:

```tsx
<SidebarHeader className="bg-background rounded-t-xl">
   <div className="flex items-center gap-2">
      {activeTabMeta && (
         <div className="flex items-center gap-2 flex-1 min-w-0">
            <activeTabMeta.icon className="size-4 shrink-0 text-muted-foreground" />
            <span className="text-sm font-medium truncate">
               {activeTabMeta.label}
            </span>
         </div>
      )}
      <Button
         className="shrink-0 ml-auto"
         onClick={closeContextPanel}
         tooltip="Fechar painel"
         type="button"
         variant="ghost"
      >
         <X className="" />
      </Button>
   </div>
</SidebarHeader>
```

**Step 2: Remove now-unused imports**

`allTabMetas` is no longer used inside `ContextPanelInner`. Remove:
- `const allTabMetas = useStore(allTabMetasStore, (s) => s);` from `ContextPanelInner`
- Remove `openContextPanel` from imports at top (line 36) if unused elsewhere in the file
- Remove `setActiveTab` from imports (line 37) if unused elsewhere in the file

Check: `openContextPanel` and `setActiveTab` are imported at line 36–38. After this change they are no longer called inside `context-panel.tsx`. Remove them from the import.

**Step 3: Verify TypeScript**

```bash
cd apps/web && bun run typecheck 2>&1 | grep "context-panel"
```

Expected: no errors.

**Step 4: Commit**

```bash
git add apps/web/src/features/context-panel/context-panel.tsx
git commit -m "feat(context-panel): remove tab buttons from panel header, show active tab label"
```

---

## Task 3: Update `dashboard-layout.tsx` — place rail in content area

**Files:**
- Modify: `apps/web/src/layout/dashboard/ui/dashboard-layout.tsx`

**Step 1: Add import for `ContextPanelRail`**

At line 14 (after `GlobalContextPanel` import), add:

```tsx
import { ContextPanelRail } from "@/features/context-panel/context-panel-rail";
```

**Step 2: Restructure content div**

Find (lines 92–103):

```tsx
<div className=" flex flex-1 flex-col overflow-hidden rounded-xl bg-background">
   <main
      className={cn(
         "relative flex-1",
         isSettingsPage
            ? "overflow-hidden p-4"
            : "overflow-y-auto p-4",
      )}
   >
      {children}
   </main>
</div>
```

Replace with:

```tsx
<div className="flex flex-1 overflow-hidden rounded-xl bg-background">
   <main
      className={cn(
         "relative flex-1",
         isSettingsPage
            ? "overflow-hidden p-4"
            : "overflow-y-auto p-4",
      )}
   >
      {children}
   </main>
   <ContextPanelRail />
</div>
```

Note: removing `flex-col` makes this a row (default flex-direction). `main` still has `flex-1` so it fills remaining width. `ContextPanelRail` is `w-10 shrink-0` so it takes exactly 40px.

**Step 3: Verify TypeScript**

```bash
cd apps/web && bun run typecheck 2>&1 | grep "dashboard-layout"
```

Expected: no errors.

**Step 4: Commit**

```bash
git add apps/web/src/layout/dashboard/ui/dashboard-layout.tsx
git commit -m "feat(dashboard): add ContextPanelRail to right side of content area"
```

---

## Task 4: Update `page-header.tsx` — hide desktop `ContextPanelHeaderActions`

**Files:**
- Modify: `apps/web/src/components/page-header.tsx`

The `ContextPanelHeaderActions` buttons (Info + AI chat) open the panel. On desktop the rail replaces this affordance. On mobile the rail is hidden, so keep the buttons there.

**Step 1: Remove desktop `ContextPanelHeaderActions` render**

In `PageHeader`, find the desktop actions section (lines 244–259):

```tsx
{/* Desktop: actions */}
<div className="hidden sm:flex items-center gap-2 shrink-0">
   {!isOpen &&
      panelActions?.map((action) => (
         <Button
            key={action.label}
            onClick={action.onClick}
            tooltip={action.label}
            type="button"
            variant="outline"
         >
            <action.icon className="size-4" />
         </Button>
      ))}
   {actions}
   {!isOpen && <ContextPanelHeaderActions />}  {/* ← REMOVE this line */}
</div>
```

Remove the last line: `{!isOpen && <ContextPanelHeaderActions />}`.

Also remove the `panelActions` desktop render since those actions are now always in the panel (panel is always accessible via rail):

```tsx
{/* Desktop: actions */}
<div className="hidden sm:flex items-center gap-2 shrink-0">
   {actions}
</div>
```

Wait — the panelActions on desktop are a "show in toolbar when panel is closed" affordance. With the rail always visible, users open the panel to access those actions. Remove the desktop panelActions toolbar render too.

**Step 2: Keep mobile `ContextPanelHeaderActions` unchanged**

Mobile section (lines 181–208) already conditionally shows `ContextPanelHeaderActions`. Leave it as-is — rail is hidden on mobile so users still need the mobile open button.

**Step 3: Check if `isOpen` is still needed in `PageHeader`**

After removal, `isOpen` is used:
- line 171: `const hasMobileOverflow = !isOpen && (panelActions?.length ?? 0) > 0;`
- line 187: `{!isOpen && <ContextPanelHeaderActions />}` (mobile)
- line 245–248: desktop panelActions — removed
- line 258: desktop `ContextPanelHeaderActions` — removed

`isOpen` is still needed for mobile rendering. Keep the `useStore` call.

**Step 4: Verify TypeScript**

```bash
cd apps/web && bun run typecheck 2>&1 | grep "page-header"
```

Expected: no errors.

**Step 5: Commit**

```bash
git add apps/web/src/components/page-header.tsx
git commit -m "feat(page-header): remove desktop ContextPanelHeaderActions (replaced by rail)"
```

---

## Task 5: Visual verification

No automated tests for layout — verify manually in browser.

**Step 1: Start dev server**

```bash
bun dev
```

**Step 2: Verify checklist**

Open a dashboard page (e.g. `/transactions`) and check:

- [ ] Narrow rail (~40px) visible on right edge of content area
- [ ] Rail shows correct icons (Info icon + any dynamic tabs for the page)
- [ ] Clicking a rail icon opens panel on that tab
- [ ] Clicking the active tab icon while panel is open closes the panel
- [ ] Clicking a different tab icon switches tab without closing
- [ ] Panel header shows: active tab icon + tab label + X close button (no row of tab buttons)
- [ ] Clicking X in panel header closes panel
- [ ] After close, rail still shows icons (always visible)
- [ ] Tooltip appears to the LEFT of each rail icon on hover
- [ ] On mobile viewport (< 640px): rail is hidden, mobile header still shows open button
- [ ] Settings page layout not broken (rail still appears but panel may not have dynamic tabs)

**Step 3: Final commit (if any polish needed)**

```bash
git add -p
git commit -m "fix(context-panel): polish rail and panel header styles"
```
