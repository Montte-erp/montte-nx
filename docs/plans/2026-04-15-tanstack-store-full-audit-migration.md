# TanStack Store Full Audit & Migration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Audit all TanStack Store usage, fix anti-patterns, adopt missing features (`createAtom`, `batch`, `shallow`), improve foxact persistence integration, and complete context panel migration.

**Architecture:** Migrate from `new Store()` constructor pattern to `createStore()` functional API. Use `createAtom` for all derived/computed state. Use `shallow` comparator for object/array selectors. Replace ReactNode storage with render functions. Split monolithic hooks into focused selectors.

**Tech Stack:** `@tanstack/store@0.9.3`, `@tanstack/react-store@0.9.3`, `foxact/create-local-storage-state`, `foxact/use-isomorphic-layout-effect`

---

## Audit Results

### All TanStack Store instances in the codebase (updated 2026-04-15)

| #   | Store               | File                                             | Persisted         | Status |
| --- | ------------------- | ------------------------------------------------ | ----------------- | ------ |
| 1   | `contextPanelStore` | `features/context-panel/context-panel-store.ts`  | No                | ✅ `createStore()`, render functions (not ReactNode), derived stores (`allTabMetasStore`, `activeTabMetaStore`) |
| 2   | `sidebarStore`      | `layout/dashboard/hooks/use-sidebar-store.ts`    | Yes (`createPersistedStore`) | ✅ Narrow selectors, `createStoreEffect` for transient sync |
| 3   | `transientStore`    | `layout/dashboard/hooks/use-sidebar-store.ts`    | No                | ✅ `createStore()`, narrow selectors |
| 4   | `credenzaStore`     | `hooks/use-credenza.tsx`                         | No                | ✅ Simple stack |
| 5   | `alertDialogStore`  | `hooks/use-alert-dialog.tsx`                     | No                | ✅ `createStore()`, `shallow` on `(s) => s` |
| 6   | `surveyModalStore`  | `hooks/use-survey-modal.tsx`                     | No                | ✅ `createStore()`, `shallow` on `(s) => s` |
| 7   | `toolbarStore`      | `hooks/use-selection-toolbar.tsx`                | No                | ✅ `createStore()`, `shallow` on `(s) => s` |
| 8   | per-instance store  | `features/analytics/hooks/use-insight-config.ts` | No                | ✅ `new Store()` (per-instance — allowed), `shallow`, no `as` casts |

### TanStack Store features adoption

| Feature                           | Available in 0.9.3                 | Current status                                      |
| --------------------------------- | ---------------------------------- | --------------------------------------------------- |
| `createStore()` functional API    | Yes                                | ✅ Used everywhere (per-instance stores use `new Store()` per convention) |
| `createAtom()` derived/computed   | Yes                                | ✅ Used in context-panel (`allTabMetasStore`, `activeTabMetaStore`) |
| `createAsyncAtom()` async derived | Yes                                | Not yet needed                                      |
| `batch()` grouped updates         | Yes                                | Not yet needed                                      |
| `shallow` comparator              | Yes (from `@tanstack/react-store`) | ✅ Used on all `(s) => s` full-state selectors      |
| `ReadonlyStore`                   | Yes                                | Not yet needed                                      |
| `effect()`                        | Yes                                | ✅ `createStoreEffect` wrapper in `lib/store.ts`    |

### Anti-patterns — all resolved

1. ~~**Full-state subscriptions `(s) => s`**~~ — all now have `shallow` comparator
2. ~~**ReactNode in store state**~~ — context panel stores `() => React.ReactNode` render functions
3. ~~**Inline derived state**~~ — moved to derived stores (`allTabMetasStore`, `activeTabMetaStore`)
4. ~~**No `shallow` on object selectors**~~ — added everywhere
5. ~~**`as` casts in `mergeConfig`**~~ — removed via discriminated union narrowing

---

## ~~Task 1: Upgrade `createPersistedStore` utility~~ — COMPLETED

Already done. `apps/web/src/lib/store.ts` uses `createStore()`, returns the store directly, handles cross-tab sync via `storage` event, and uses `createClientOnlyFn` for SSR safety. No foxact hooks needed.

---

## ~~Task 2: Add `shallow` comparator to all object selectors~~ — COMPLETED

Already done. All `(s) => s` subscriptions and object selectors use `shallow`.

**Files:**

- Modify: `apps/web/src/features/context-panel/context-panel.tsx`
- Modify: `apps/web/src/layout/dashboard/hooks/use-sidebar-store.ts`

**Why:** When `useStore` selector returns a new object `{ a: s.a, b: s.b }`, default `===` comparison always sees a new ref → unnecessary re-render. `shallow` from `@tanstack/react-store` does structural comparison.

**Step 1: Fix `context-panel.tsx` — InfoContent selector**

```typescript
// context-panel.tsx — add import
import { useStore, shallow } from "@tanstack/react-store";

// InfoContent component — line 82-89
const { infoContent, pageActions, pageViewSwitch } = useStore(
   contextPanelStore,
   (s) => ({
      infoContent: s.infoContent,
      pageActions: s.pageActions,
      pageViewSwitch: s.pageViewSwitch,
   }),
   shallow,
);
```

**Step 2: Fix `context-panel.tsx` — ContextPanelInner selector**

```typescript
// ContextPanelInner — line 137-140
const { activeTabId, dynamicTabs } = useStore(
   contextPanelStore,
   (s) => ({
      activeTabId: s.activeTabId,
      dynamicTabs: s.dynamicTabs,
   }),
   shallow,
);
```

**Step 3: Fix `use-sidebar-store.ts` — useSidebarNav**

`useSidebarNav` calls `useStore` 3 times for 3 separate fields. This is fine — separate primitive selectors don't need `shallow`. No change needed here.

**Step 4: Verify**

Run: `cd apps/web && bunx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors

**Step 5: Commit**

```bash
git add apps/web/src/features/context-panel/context-panel.tsx
git commit -m "perf(context-panel): add shallow comparator to object selectors"
```

---

## ~~Task 3: Fix full-state subscriptions `(s) => s`~~ — COMPLETED

**Files:**

- Modify: `apps/web/src/hooks/use-alert-dialog.tsx`
- Modify: `apps/web/src/hooks/use-survey-modal.tsx`
- Modify: `apps/web/src/hooks/use-selection-toolbar.tsx`
- Modify: `apps/web/src/features/context-panel/use-context-panel.ts`
- Modify: `apps/web/src/features/analytics/hooks/use-insight-config.ts`

**Why:** `useStore(store, (s) => s)` re-renders on ANY state change. Use narrow selectors or `shallow` for the minimum required slice.

**Step 1: Fix `GlobalAlertDialog`**

```typescript
// use-alert-dialog.tsx — GlobalAlertDialog
// The component uses all fields for rendering, so full subscription is needed here.
// But add shallow to avoid re-render when setState produces structurally equal state:
import { Store, useStore, shallow } from "@tanstack/react-store";

export function GlobalAlertDialog() {
   const state = useStore(alertDialogStore, (s) => s, shallow);
   // ... rest unchanged
}
```

**Step 2: Fix `GlobalSurveyModal`**

```typescript
// use-survey-modal.tsx
import { Store, useStore, shallow } from "@tanstack/react-store";

export function GlobalSurveyModal() {
   const state = useStore(surveyModalStore, (s) => s, shallow);
   // ... rest unchanged
}
```

**Step 3: Fix `GlobalSelectionToolbar`**

```typescript
// use-selection-toolbar.tsx — GlobalSelectionToolbar
// Uses both selectedIndices and renderActions — but shallow handles Set comparison
import { Store, useStore, shallow } from "@tanstack/react-store";

export function GlobalSelectionToolbar() {
   const { selectedIndices, renderActions } = useStore(
      toolbarStore,
      (s) => s,
      shallow,
   );
   // ... rest unchanged
}
```

**Step 4: Fix `useContextPanel` full subscription**

```typescript
// use-context-panel.ts — line 86-94
// Add shallow to useContextPanel convenience hook
import { useStore, shallow } from "@tanstack/react-store";

export const useContextPanel = () => {
   const {
      isOpen,
      activeTabId,
      dynamicTabs,
      infoContent,
      pageActions,
      pageViewSwitch,
   } = useStore(contextPanelStore, (s) => s, shallow);
   return {
      isOpen,
      activeTabId,
      dynamicTabs,
      infoContent,
      pageActions,
      pageViewSwitch,
      openContextPanel,
      closeContextPanel,
      toggleContextPanel,
      setActiveTab,
      registerTab,
      unregisterTab,
      setInfoContent,
      clearInfoContent,
      setPageActions,
      clearPageActions,
      setPageViewSwitch,
      clearPageViewSwitch,
   };
};
```

**Step 5: Fix `useInsightConfig` full subscription**

```typescript
// use-insight-config.ts — line 85
import { Store, useStore, shallow } from "@tanstack/react-store";

const state = useStore(store, (s) => s, shallow);
```

**Step 6: Verify**

Run: `cd apps/web && bunx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors

**Step 7: Commit**

```bash
git add apps/web/src/hooks/use-alert-dialog.tsx apps/web/src/hooks/use-survey-modal.tsx apps/web/src/hooks/use-selection-toolbar.tsx apps/web/src/features/context-panel/use-context-panel.ts apps/web/src/features/analytics/hooks/use-insight-config.ts
git commit -m "perf(store): add shallow comparator to full-state subscriptions"
```

---

## ~~Task 4: Add focused sub-hooks for context panel (MON-261 prep)~~ — COMPLETED

**Files:**

- Modify: `apps/web/src/features/context-panel/use-context-panel.ts`

**Why:** `useContextPanel()` forces full-store subscription on all consumers. Most callers only need `isOpen` or tab state. Focused hooks = fewer re-renders.

**Step 1: Add focused sub-hooks**

```typescript
// use-context-panel.ts — add after existing exports, before useContextPanel

export const useContextPanelOpen = () =>
   useStore(contextPanelStore, (s) => s.isOpen);

export const useContextPanelTabs = () =>
   useStore(
      contextPanelStore,
      (s) => ({
         activeTabId: s.activeTabId,
         dynamicTabs: s.dynamicTabs,
      }),
      shallow,
   );

export const useContextPanelActiveTabId = () =>
   useStore(contextPanelStore, (s) => s.activeTabId);
```

**Step 2: Verify**

Run: `cd apps/web && bunx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/web/src/features/context-panel/use-context-panel.ts
git commit -m "feat(context-panel): add focused sub-hooks for narrow subscriptions"
```

---

## ~~Task 5: Introduce `createAtom` for context panel derived state (MON-257)~~ — COMPLETED

**Files:**

- Modify: `apps/web/src/features/context-panel/context-panel-store.ts`
- Modify: `apps/web/src/features/context-panel/context-panel.tsx`

**Why:** `allTabs` and `activeTab` are pure derivations from store state. `createAtom` recomputes only when dependencies change. Multiple consumers share the derived value without recomputing.

**Step 1: Add derived atoms to `context-panel-store.ts`**

The `INFO_TAB` constant includes `content: React.ReactNode` — this cannot go into an atom. The atom tracks tab metadata only (id, icon, label, order). We create a static INFO_TAB_META for the atom and keep the full INFO_TAB with content in the component file.

```typescript
// context-panel-store.ts — add at top
import { Store, createAtom } from "@tanstack/react-store";

// Add a metadata-only type for atoms (no ReactNode)
export interface ContextPanelTabMeta {
   id: string;
   icon: React.ElementType;
   label: string;
   order?: number;
}

// Static info tab metadata (content stays in context-panel.tsx)
const INFO_TAB_META: ContextPanelTabMeta = {
   id: "info",
   icon: Info, // import Info from lucide-react
   label: "Informações",
   order: 0,
};

// Derived: all tab metadata sorted
export const allTabMetasAtom = createAtom(() => {
   const { dynamicTabs } = contextPanelStore.state;
   const dynamicMetas: ContextPanelTabMeta[] = dynamicTabs.map((t) => ({
      id: t.id,
      icon: t.icon,
      label: t.label,
      order: t.order,
   }));
   return [
      INFO_TAB_META,
      ...dynamicMetas.sort((a, b) => (a.order ?? 99) - (b.order ?? 99)),
   ];
});

// Derived: active tab ID resolved against actual tabs
export const activeTabMetaAtom = createAtom(() => {
   const allMetas = allTabMetasAtom.get();
   const { activeTabId } = contextPanelStore.state;
   return allMetas.find((t) => t.id === activeTabId) ?? allMetas[0] ?? null;
});
```

**Step 2: Use atoms in `context-panel.tsx` — ContextPanelInner**

```typescript
// context-panel.tsx
import { useStore, shallow } from "@tanstack/react-store";
import {
   type ContextPanelTab,
   contextPanelStore,
   allTabMetasAtom,
   activeTabMetaAtom,
   type PageViewSwitchConfig,
} from "./context-panel-store";

// ContextPanelInner — replace inline derivation
function ContextPanelInner() {
   const allTabMetas = useStore(allTabMetasAtom);
   const activeTabMeta = useStore(activeTabMetaAtom);

   // Resolve full tab (with content) for the active tab
   const dynamicTabs = useStore(contextPanelStore, (s) => s.dynamicTabs);
   const activeTab: ContextPanelTab | undefined =
      activeTabMeta?.id === "info"
         ? INFO_TAB
         : dynamicTabs.find((t) => t.id === activeTabMeta?.id);

   return (
      <Sidebar className="px-0" collapsible="offcanvas" side="right" variant="inset">
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
         <SidebarContent className="h-full overflow-hidden rounded-b-xl bg-muted">
            {activeTab?.content}
         </SidebarContent>
      </Sidebar>
   );
}
```

**Step 3: Verify**

Run: `cd apps/web && bunx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors

**Step 4: Commit**

```bash
git add apps/web/src/features/context-panel/context-panel-store.ts apps/web/src/features/context-panel/context-panel.tsx
git commit -m "perf(context-panel): use createAtom for derived allTabs/activeTab state"
```

---

## ~~Task 6: Replace ReactNode with render functions in context panel (MON-261)~~ — COMPLETED

**Files:**

- Modify: `apps/web/src/features/context-panel/context-panel-store.ts`
- Modify: `apps/web/src/features/context-panel/use-context-panel.ts`
- Modify: `apps/web/src/features/context-panel/context-panel.tsx`
- Modify: All files calling `useContextPanelInfo` (3 files)

**Why:** Storing `React.ReactNode` in non-React store causes stale closures, non-serializable state, and potential memory leaks. Render functions defer JSX creation to render time.

**Step 1: Update store types**

```typescript
// context-panel-store.ts — update interfaces

export interface ContextPanelTab {
   id: string;
   icon: React.ElementType;
   label: string;
   renderContent: () => React.ReactNode; // was: content: React.ReactNode
   order?: number;
}

interface ContextPanelState {
   isOpen: boolean;
   activeTabId: string;
   dynamicTabs: ContextPanelTab[];
   renderInfoContent: (() => React.ReactNode) | null; // was: infoContent: React.ReactNode
   pageActions: PanelAction[] | null;
   pageViewSwitch: PageViewSwitchConfig | null;
}

export const contextPanelStore = new Store<ContextPanelState>({
   isOpen: false,
   activeTabId: "info",
   dynamicTabs: [],
   renderInfoContent: null,
   pageActions: null,
   pageViewSwitch: null,
});
```

**Step 2: Update `use-context-panel.ts` — actions and hooks**

```typescript
// use-context-panel.ts

export const setInfoContent = (render: (() => React.ReactNode) | null) =>
   contextPanelStore.setState((s) => ({ ...s, renderInfoContent: render }));

export const clearInfoContent = () =>
   contextPanelStore.setState((s) => ({ ...s, renderInfoContent: null }));

export const useContextPanelInfo = (render: () => React.ReactNode) => {
   // oxlint-ignore exhaustive-deps
   useEffect(() => {
      setInfoContent(render);
      return () => clearInfoContent();
   }, []);
};

// Update useContextPanel return shape
export const useContextPanel = () => {
   const {
      isOpen,
      activeTabId,
      dynamicTabs,
      renderInfoContent,
      pageActions,
      pageViewSwitch,
   } = useStore(contextPanelStore, (s) => s, shallow);
   return {
      isOpen,
      activeTabId,
      dynamicTabs,
      renderInfoContent,
      pageActions,
      pageViewSwitch,
      openContextPanel,
      closeContextPanel,
      toggleContextPanel,
      setActiveTab,
      registerTab,
      unregisterTab,
      setInfoContent,
      clearInfoContent,
      setPageActions,
      clearPageActions,
      setPageViewSwitch,
      clearPageViewSwitch,
   };
};
```

**Step 3: Update `context-panel.tsx` — InfoContent rendering**

```typescript
// context-panel.tsx — InfoContent component
function InfoContent() {
   const { renderInfoContent, pageActions, pageViewSwitch } = useStore(
      contextPanelStore,
      (s) => ({
         renderInfoContent: s.renderInfoContent,
         pageActions: s.pageActions,
         pageViewSwitch: s.pageViewSwitch,
      }),
      shallow,
   );

   const infoContent = renderInfoContent?.() ?? null;

   // ... rest stays the same but use `infoContent` local variable
}

// INFO_TAB — update to renderContent
const INFO_TAB: ContextPanelTab = {
   id: "info",
   icon: Info,
   label: "Informações",
   renderContent: () => <InfoContent />,
   order: 0,
};

// ContextPanelInner — use renderContent
<SidebarContent className="h-full overflow-hidden rounded-b-xl bg-muted">
   {activeTab?.renderContent()}
</SidebarContent>
```

**Step 4: Update all `useContextPanelInfo` call sites**

Find with: `grep -rn "useContextPanelInfo" apps/web/src/routes/`

Each call site changes from:

```typescript
// Before:
useContextPanelInfo(<SomeComponent prop={value} />);

// After:
useContextPanelInfo(() => <SomeComponent prop={value} />);
```

Files to update:

- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/analytics/insights/index.tsx`
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/analytics/insights/$insightId.tsx`
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/analytics/dashboards/index.tsx`

**Step 5: Verify**

Run: `cd apps/web && bunx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors

**Step 6: Commit**

```bash
git add apps/web/src/features/context-panel/ apps/web/src/routes/
git commit -m "refactor(context-panel): replace ReactNode storage with render functions"
```

---

## Task 7: Add `batch()` to multi-field store updates

**Files:**

- Modify: `apps/web/src/features/context-panel/use-context-panel.ts`
- Modify: `apps/web/src/layout/dashboard/hooks/use-sidebar-store.ts`

**Why:** `unregisterTab` updates `dynamicTabs` AND `activeTabId` in a single `setState` — this is fine (single call). But `setActiveSection` in sidebar resets `searchQuery` too — also a single call. Review shows current code already batches via single `setState`. No changes needed for existing code.

However, document `batch()` usage for future multi-store updates:

```typescript
// Example: when resetting multiple stores simultaneously
import { batch } from "@tanstack/react-store";

batch(() => {
   contextPanelStore.setState((s) => ({ ...s, isOpen: false }));
   sidebarStore.setState((s) => ({ ...s, isCollapsed: true }));
});
// Subscribers notified once with final state
```

**Step 1: No code changes — batch is already implicit in single setState calls**

**Step 2: Commit**

No commit needed — this task is documentation/awareness only.

---

## Task 8: Fix `as` casts in `use-insight-config.ts`

**Files:**

- Modify: `apps/web/src/features/analytics/hooks/use-insight-config.ts`

**Why:** CLAUDE.md: "No `as` casts — fix source types." Lines 65-78 use `as KpiConfig`, `as TimeSeriesConfig`, `as BreakdownConfig`.

**Step 1: Fix mergeConfig with proper discriminated union handling**

```typescript
function mergeConfig(
   state: InsightState,
   updates: Partial<InsightConfig>,
): InsightState {
   if (state.type === "kpi")
      return {
         type: "kpi",
         config: { ...state.config, ...updates, type: "kpi" },
      };
   if (state.type === "time_series")
      return {
         type: "time_series",
         config: { ...state.config, ...updates, type: "time_series" },
      };
   return {
      type: "breakdown",
      config: { ...state.config, ...updates, type: "breakdown" },
   };
}
```

The key fix: spread `updates` but force `type` back to the correct literal. This preserves the discriminated union without `as` casts. If TypeScript still complains, the `InsightConfig` union type in `@packages/analytics/types` may need adjustment — each branch config type should have `type` as a literal.

**Step 2: Verify**

Run: `cd apps/web && bunx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/web/src/features/analytics/hooks/use-insight-config.ts
git commit -m "fix(analytics): remove as casts from mergeConfig using discriminated union"
```

---

## Task 9: Migrate remaining stores from `new Store()` to `createStore()`

**Files:**

- Modify: `apps/web/src/features/context-panel/context-panel-store.ts`
- Modify: `apps/web/src/hooks/use-credenza.tsx`
- Modify: `apps/web/src/hooks/use-alert-dialog.tsx`
- Modify: `apps/web/src/hooks/use-survey-modal.tsx`
- Modify: `apps/web/src/hooks/use-selection-toolbar.tsx`
- Modify: `apps/web/src/layout/dashboard/hooks/use-sidebar-store.ts`

**Why:** `createStore()` is the functional API — it returns `Store` for mutable and `ReadonlyStore` for derived. Consistent API surface, matches TanStack conventions.

**Step 1: Update imports and constructors**

Each file: replace `import { Store } from "@tanstack/react-store"` with `import { createStore } from "@tanstack/react-store"` and `new Store<T>(init)` with `createStore<T>(init)`.

Example for `context-panel-store.ts`:

```typescript
// Before:
import { Store } from "@tanstack/react-store";
export const contextPanelStore = new Store<ContextPanelState>({...});

// After:
import { createStore } from "@tanstack/react-store";
export const contextPanelStore = createStore<ContextPanelState>({...});
```

Repeat for all 6 files. The `use-insight-config.ts` per-instance store stays as `new Store()` inside `useState` since `createStore` returns the same thing.

**Step 2: Verify**

Run: `cd apps/web && bunx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/web/src/features/context-panel/context-panel-store.ts apps/web/src/hooks/use-credenza.tsx apps/web/src/hooks/use-alert-dialog.tsx apps/web/src/hooks/use-survey-modal.tsx apps/web/src/hooks/use-selection-toolbar.tsx apps/web/src/layout/dashboard/hooks/use-sidebar-store.ts
git commit -m "refactor(store): migrate all stores from new Store() to createStore()"
```

---

## Task 10: Final typecheck + lint

**Step 1: Full typecheck**

Run: `cd apps/web && bunx tsc --noEmit --pretty`
Expected: No errors

**Step 2: Lint**

Run: `bun run check`
Expected: No errors

**Step 3: Format**

Run: `bun run format`

**Step 4: Final commit if formatting changed**

```bash
git add -A
git commit -m "chore: format after store migration"
```

---

## Execution Order & Dependencies

```
Task 1 (createPersistedStore) ─────────────────────────────┐
Task 2 (shallow on object selectors) ──────────────────────┤
Task 3 (fix full-state subscriptions) ─────────────────────┤
Task 4 (focused sub-hooks) ────────────────────────────────┤
Task 8 (fix as casts) ────────────────────────────────────┤
                                                            ▼
Task 5 (createAtom derived state) ◄── depends on Tasks 2,4
                                                            │
Task 6 (ReactNode → render functions) ◄── depends on Task 5
                                                            │
Task 9 (new Store → createStore) ◄── depends on Tasks 1-6
                                                            │
Task 10 (final verification) ◄── depends on all
```

Tasks 1, 2, 3, 4, 8 can run in parallel.
Task 5 depends on 2 and 4.
Task 6 depends on 5.
Task 9 depends on 1-6 (avoid merge conflicts).
Task 10 is always last.

---

## Notes

- `useContextPanel()` full hook stays as convenience — don't delete. Focused sub-hooks are additions.
- `batch()` is not needed for current code since all multi-field updates happen in single `setState` calls. Document for future use.
- `createAsyncAtom` is available but no current use case — skip for now.
- `effect()` is available but `useEffect` + `subscribe` pattern is fine for React — skip.
- The `INFO_TAB` with its `content: ReactNode` (or `renderContent` after Task 6) stays in `context-panel.tsx` — React nodes don't belong in atoms.
- After Task 6, `registerTab` call sites (currently none found outside context-panel itself) need updating if they pass `content` → `renderContent`.
