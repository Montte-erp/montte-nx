# Hooks Cleanup Pt. 2 — useStatementImport, statement-import-credenza, useSelectionToolbar

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate `useState`/`useEffect` bloat across three files; move `useSelectionToolbar` to a global TanStack Store pattern identical to `useCredenza`; clean up `parseFile` to use `file.arrayBuffer()` and the plain async functions from hooks-cleanup pt.1; extract template download utilities as named functions.

**Architecture:**
- `useSelectionToolbar` becomes a global store (TanStack `Store`) with a `GlobalSelectionToolbar` component mounted in `__root.tsx`, matching `useCredenza` exactly. No `createPortal`, no `mounted` state, no `useIsomorphicLayoutEffect`.
- `useStatementImport.parseFile` drops `FileReader`/`new Promise` in favour of `file.arrayBuffer()` + the plain `readCsvFile`/`readXlsxFile` from pt.1. CSV/XLSX parsing becomes two lines.
- Template download utilities (`downloadCsvTemplate`, `downloadXlsxTemplate`) are extracted as named module-level functions in the credenza file (or a sibling `-import-templates.ts`), not inline closures inside a React component.

**Tech Stack:** TanStack Store (`@tanstack/react-store`), foxact `useSet`, `readCsvFile`/`readXlsxFile` (from pt.1 plan), `file.arrayBuffer()`, `@f-o-t/csv` `generateFromObjects`, `xlsx`.

**Prerequisite:** Hooks-cleanup pt.1 must be done first (specifically Tasks 2 & 3 — `readCsvFile` and `readXlsxFile` plain async functions must exist).

---

### Task 1: Rewrite `use-selection-toolbar.tsx` to global store pattern

**Files:**
- Modify: `apps/web/src/hooks/use-selection-toolbar.tsx`
- Modify: `apps/web/src/routes/__root.tsx` (add `GlobalSelectionToolbar`)

**Current problem:** The hook uses `useState(false)` + `useIsomorphicLayoutEffect` just to track DOM mount for `createPortal`. Every caller gets its own isolated selection state. The user wants a global store like `useCredenza` — mount one `GlobalSelectionToolbar` in root, the hook just registers/clears actions.

**Target pattern (mirror of `use-credenza.tsx`):**

```tsx
// use-selection-toolbar.tsx
import { Store, useStore } from "@tanstack/react-store";
import { useSet } from "foxact/use-set";
import type React from "react";
import {
  SelectionActionBar,
  SelectionActionButton,
} from "@packages/ui/components/selection-action-bar";

export { SelectionActionButton };

type ToolbarState = {
  renderActions: ((ctx: { selectedIndices: Set<number>; clear: () => void }) => React.ReactNode) | null;
};

const toolbarStore = new Store<ToolbarState>({ renderActions: null });

export const clearToolbar = () =>
  toolbarStore.setState(() => ({ renderActions: null }));

export function useSelectionToolbar(
  renderActions: (ctx: { selectedIndices: Set<number>; clear: () => void }) => React.ReactNode,
) {
  const [selectedIndices, addIndex, removeIndex, clearIndices, replaceIndices] = useSet<number>();

  // Register actions into the global store when this hook mounts
  // Note: we cannot call setState during render, so use a ref trick:
  // Actually the cleanest approach: just pass selectedIndices/clear as
  // a closure into the store. But closures + stores are stale.
  // Better: store only renderActions fn, pass live selectedIndices via
  // a React context or keep the portal approach but skip the mounted gate.

  // CORRECT APPROACH: The toolbar renders renderActions(ctx) where ctx
  // comes from the *hook caller's* state, not the store. So the store
  // only needs to know *whether* the toolbar is visible and *which*
  // renderActions to call. selectedIndices lives in the hook (useSet).
  // The GlobalSelectionToolbar reads the store's renderActions and
  // calls it with live ctx supplied by... problem: GlobalSelectionToolbar
  // can't see the caller's selectedIndices.
  //
  // Solution: store the full render closure that already closes over
  // selectedIndices. Re-register on every render (like useEffect with
  // deps). Use useEffect to sync:

  // Actually simplest: keep useSet in the hook, use useEffect to push
  // a render function into the store that closes over current selectedIndices.
  // BUT user hates useEffect. Alternative: push the whole thing into
  // a single store that holds selectedIndices too (Set is not plain,
  // but TanStack Store handles it).

  function toggle(index: number) {
    if (selectedIndices.has(index)) {
      removeIndex(index);
    } else {
      addIndex(index);
    }
  }

  return {
    selectedIndices,
    toggle,
    add: addIndex,
    remove: removeIndex,
    clear: clearIndices,
    replace: replaceIndices,
  };
}
```

**Real target (no useEffect, store holds Set):**

The cleanest no-`useEffect` solution is: store holds `selectedIndices: Set<number>` + `renderActions` + exposes imperative setters. The hook is thin sugar over the store. Only one active toolbar at a time (which is already the case in the app).

```tsx
import { Store, useStore } from "@tanstack/react-store";
import type React from "react";
import {
  SelectionActionBar,
  SelectionActionButton,
} from "@packages/ui/components/selection-action-bar";

export { SelectionActionButton };

type ToolbarState = {
  selectedIndices: Set<number>;
  renderActions: ((ctx: { selectedIndices: Set<number>; clear: () => void }) => React.ReactNode) | null;
};

const toolbarStore = new Store<ToolbarState>({
  selectedIndices: new Set(),
  renderActions: null,
});

export const clearSelectionToolbar = () =>
  toolbarStore.setState(() => ({ selectedIndices: new Set(), renderActions: null }));

const addIndex = (i: number) =>
  toolbarStore.setState((s) => ({ selectedIndices: new Set([...s.selectedIndices, i]) }));

const removeIndex = (i: number) =>
  toolbarStore.setState((s) => {
    const next = new Set(s.selectedIndices);
    next.delete(i);
    return { selectedIndices: next };
  });

const replaceIndices = (next: Set<number>) =>
  toolbarStore.setState(() => ({ selectedIndices: next }));

export function useSelectionToolbar(
  renderActions: (ctx: { selectedIndices: Set<number>; clear: () => void }) => React.ReactNode,
) {
  const selectedIndices = useStore(toolbarStore, (s) => s.selectedIndices);

  // Register this toolbar's renderActions (no useEffect — just write to store
  // synchronously if renderActions reference changed; TanStack Store is fine
  // with synchronous setState outside React render)
  // NOTE: calling setState during render is problematic. Use a layout effect
  // only for the registration of renderActions (not for mount gating).
  // This is a one-time concern per hook instance, and the user said
  // "only if super needed" — registering renderActions into a global store
  // IS a side effect that genuinely needs useEffect/useLayoutEffect.
  // Keep useIsomorphicLayoutEffect ONLY for renderActions registration.

  useIsomorphicLayoutEffect(() => {
    toolbarStore.setState((s) => ({ ...s, renderActions }));
    return () => toolbarStore.setState(() => ({ selectedIndices: new Set(), renderActions: null }));
  }, []); // renderActions is stable if defined at module scope or via useCallback

  function toggle(index: number) {
    if (selectedIndices.has(index)) removeIndex(index);
    else addIndex(index);
  }

  return {
    selectedIndices,
    toggle,
    add: addIndex,
    remove: removeIndex,
    clear: clearSelectionToolbar,
    replace: replaceIndices,
  };
}

export function GlobalSelectionToolbar() {
  const { selectedIndices, renderActions } = useStore(toolbarStore, (s) => s);
  if (!renderActions) return null;
  return (
    <SelectionActionBar
      selectedCount={selectedIndices.size}
      onClear={clearSelectionToolbar}
    >
      {renderActions({ selectedIndices, clear: clearSelectionToolbar })}
    </SelectionActionBar>
  );
}
```

**Key insight:** `useIsomorphicLayoutEffect` with empty deps `[]` is kept only for *registering/unregistering* the renderActions closure. This is a genuine external system sync (the global store) — exactly the case where `useEffect` is warranted. No `useState(false)` for mount-gating, no `createPortal`.

The caller no longer needs to render `toolbar` — it's gone from the return value.

**Callers to update:**

The hook currently returns `toolbar` which callers render. After this change `toolbar` is removed — callers just call `useSelectionToolbar(renderActions)` and `GlobalSelectionToolbar` in root handles rendering.

Check all callers:
```bash
grep -rn "useSelectionToolbar\|\.toolbar" apps/web/src --include="*.tsx"
```

The only current caller of the hook is `statement-import-credenza.tsx` (line ~548). It renders `{toolbar}` somewhere — remove that render call.

**Steps:**

1. Rewrite `use-selection-toolbar.tsx` per the pattern above.

2. Add `GlobalSelectionToolbar` to `__root.tsx` next to `GlobalCredenza`:
   ```tsx
   // apps/web/src/routes/__root.tsx
   import { GlobalSelectionToolbar } from "@/hooks/use-selection-toolbar";
   // ...
   <GlobalCredenza />
   <GlobalSelectionToolbar />
   ```

3. In `statement-import-credenza.tsx`: remove `toolbar` from the `useSelectionToolbar` destructure and remove `{toolbar}` render call (find it — likely near the preview step return).

4. Commit:
   ```bash
   git add apps/web/src/hooks/use-selection-toolbar.tsx apps/web/src/routes/__root.tsx apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-transactions/statement-import-credenza.tsx
   git commit -m "refactor(hooks): useSelectionToolbar — global store pattern, GlobalSelectionToolbar in root"
   ```

---

### Task 2: Rewrite `parseFile` in `useStatementImport` — drop FileReader

**Files:**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-transactions/use-statement-import.ts`

**Current problem:** `parseFile` uses `new Promise` + `FileReader` boilerplate (lines 355–411). After pt.1, `useCsvFile().parse` / `useXlsxFile().parse` use `file.arrayBuffer()` internally. OFX can also use `file.arrayBuffer()` directly.

`const csv = useCsvFile()` and `const xlsx = useXlsxFile()` stay at the top of `useStatementImport`. `parseFile` becomes:

```ts
async function parseFile(file: File): Promise<void> {
  const ext = file.name.split(".").pop()?.toLowerCase();

  if (ext === "ofx") {
    const parsed = parseOfxBuffer(await file.arrayBuffer(), minImportDate);
    setFormat("ofx");
    await applyRows(parsed);
    return;
  }

  const raw =
    ext === "xlsx" || ext === "xls"
      ? await xlsx.parse(file)
      : await csv.parse(file);

  setFormat(ext === "xlsx" || ext === "xls" ? "xlsx" : "csv");
  setRawData(raw);

  const saved = localStorage.getItem(mappingStorageKey(raw.headers));
  if (saved) {
    try {
      setMapping((prev) => ({ ...prev, ...(JSON.parse(saved) as ColumnMapping) }));
      setSavedMappingApplied(true);
    } catch {
      setMapping((prev) => ({ ...prev, ...guessColumns(raw.headers) }));
    }
  } else {
    setMapping((prev) => ({ ...prev, ...guessColumns(raw.headers) }));
  }
}
```

No `new Promise`, no `FileReader`, no intermediate `parsed` variable for the mapping JSON.

Also remove the `dayjs.extend(customParseFormat)` module-level call if it's now present in app bootstrap (check first).

**Steps:**

1. Replace `parseFile` body in `use-statement-import.ts`.
2. Commit:
   ```bash
   git add apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-transactions/use-statement-import.ts
   git commit -m "refactor(import): parseFile — drop FileReader, use file.arrayBuffer() + hook parse methods"
   ```

---

### Task 3: Simplify `TemplateCredenza` — use hook `generate` methods

**Files:**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-transactions/statement-import-credenza.tsx`

**Current problem:** `TemplateCredenza` has inline `downloadCsv`/`downloadXlsx` closures that duplicate blob construction logic. After pt.1, `useCsvFile().generate` and `useXlsxFile().generate` already return the right `Blob`. Also remove the `generateFromObjects` import and the `xlsx` write imports from this file — they're now encapsulated in the hooks.

**New `TemplateCredenza`:**

```tsx
function TemplateCredenza({ onClose }: { onClose?: () => void }) {
  const csv = useCsvFile();
  const xlsx = useXlsxFile();

  return (
    <>
      {/* CSV button onClick: */}
      triggerDownload(csv.generate(TEMPLATE_ROWS, [...TEMPLATE_HEADERS]), "modelo-importacao.csv");
      onClose?.();

      {/* XLSX button onClick: */}
      triggerDownload(xlsx.generate(TEMPLATE_ROWS, [...TEMPLATE_HEADERS]), "modelo-importacao.xlsx");
      onClose?.();
    </>
  );
}
```

Remove `generateFromObjects` import and `xlsxWrite`/`xlsxUtils.json_to_sheet`/`xlsxUtils.book_new`/`xlsxUtils.book_append_sheet` from this file — they now live in the hooks. Keep `xlsxUtils` only if still used elsewhere in the file (check).

**Steps:**

1. Update `TemplateCredenza` to call `csv.generate`/`xlsx.generate`.
2. Remove now-unused imports from `statement-import-credenza.tsx`.
3. Commit:
   ```bash
   git add apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-transactions/statement-import-credenza.tsx
   git commit -m "refactor(import): TemplateCredenza — use hook generate methods, remove blob construction"
   ```

---

### Task 4: Verify callers that still use `SelectionActionBar` directly

**Context:** Several routes render `SelectionActionBar` manually (contacts, credit-cards, tags, categories, transactions-list) instead of using `useSelectionToolbar`. After this refactor `GlobalSelectionToolbar` handles rendering — but these components are NOT using `useSelectionToolbar` hook, they manage their own selection state independently. They should eventually migrate to `useSelectionToolbar` but that's out of scope for this plan.

**Only verify:** that no existing manual `SelectionActionBar` usage breaks (they render their own `<SelectionActionBar>` in JSX — that still works fine since `GlobalSelectionToolbar` only renders when `renderActions` in the store is non-null).

```bash
grep -rn "SelectionActionBar" apps/web/src --include="*.tsx" -l
```

Confirm these files all render `<SelectionActionBar>` directly in JSX (not via portal/store) — they're unaffected.

---

### Task 5: Create `use-file-download.ts` hook

**Files:**
- Create: `apps/web/src/hooks/use-file-download.ts`
- Update: `statement-import-credenza.tsx` — replace `triggerDownload` calls with the hook

**What it does:** Wraps the blob→anchor download pattern behind a hook. Uses:
- `createClientOnlyFn` from `@tanstack/react-start` — SSR safety (no `typeof window` checks)
- `useThrottledCallback` from `@tanstack/react-pacer` — prevents double-trigger (user clicks CSV twice rapidly)

```ts
import { createClientOnlyFn } from "@tanstack/react-start";
import { useThrottledCallback } from "@tanstack/react-pacer";

const triggerDownload = createClientOnlyFn((blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
});

export function useFileDownload() {
  const download = useThrottledCallback(
    (blob: Blob, filename: string) => triggerDownload(blob, filename),
    { wait: 1000 },
  );

  return { download };
}
```

In `statement-import-credenza.tsx`:
- Remove the `triggerDownload` module-level function entirely
- Call `const { download } = useFileDownload()` in `TemplateCredenza`
- Replace `triggerDownload(blob, filename)` → `download(blob, filename)`

**Steps:**

1. Create `apps/web/src/hooks/use-file-download.ts`.
2. Update `TemplateCredenza` in `statement-import-credenza.tsx` — add `useFileDownload`, remove `triggerDownload`.
3. Commit:
   ```bash
   git add apps/web/src/hooks/use-file-download.ts apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-transactions/statement-import-credenza.tsx
   git commit -m "feat(hooks): useFileDownload — SSR-safe blob download with throttle"
   ```

---

### Task 7: Typecheck

```bash
bun run typecheck
```

Fix any type errors. Common ones:
- `renderActions` closure passed to `useSelectionToolbar` — if defined inline in JSX, it recreates every render, causing the `useIsomorphicLayoutEffect` to re-run on every render (since `[]` deps means only on mount). This is intentional — the closure closes over stable refs. If stale closure is a concern, the caller should `useCallback` wrap their `renderActions`. Note this in the plan but don't over-engineer.
- `Set<number>` serialization in TanStack Store — `Store` accepts any value, `Set` is fine.
