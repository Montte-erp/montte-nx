# Foxact Hooks Migration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace custom SSR-safe hook wrappers and `@uidotdev/usehooks` with the foxact library, deleting dead code and reducing maintenance surface.

**Architecture:** Install foxact, migrate each hook usage to the equivalent foxact export, then delete the custom wrapper files that are no longer needed. Each task is isolated — no cross-task dependencies except Task 1 (install).

**Tech Stack:** foxact, React 18+, Vite/SSR, Bun

---

## What we're replacing

| Current                                                | Foxact equivalent                     | Files to delete after |
| ------------------------------------------------------ | ------------------------------------- | --------------------- |
| `apps/web/src/hooks/use-local-storage.ts`              | `foxact/use-local-storage`            | ✅ delete             |
| `packages/ui/src/hooks/use-media-query.ts`             | `foxact/use-media-query`              | ✅ delete             |
| `packages/ui/src/hooks/use-debounce.ts`                | `foxact/use-debounced-value`          | ✅ delete             |
| `@uidotdev/usehooks` (useDebounce)                     | `foxact/use-debounced-value`          | ✅ uninstall          |
| `useIsomorphicLayoutEffect` from `@dnd-kit/utilities`  | `foxact/use-isomorphic-layout-effect` | —                     |
| `navigator.clipboard` manual patterns                  | `foxact/use-clipboard`                | —                     |
| `createThreadRef.current = ...` stable handler pattern | `foxact/use-stable-handler`           | —                     |

**Keep unchanged:**

- `packages/ui/src/hooks/use-mobile.ts` — project-specific wrapper, keep it wrapping foxact's `useMediaQuery`
- `packages/ui/src/hooks/use-event-listener.ts` — foxact has no equivalent
- `apps/web/src/hooks/use-standalone.ts` — keep, just update import inside

---

## Task 1: Install foxact, remove @uidotdev/usehooks

**Files:**

- Modify: `apps/web/package.json`
- Modify: `packages/ui/package.json`
- Modify: `bun.lock` (auto-updated)

**Step 1: Add foxact to both packages**

```bash
cd /path/to/montte-nx
bun add foxact --filter @apps/web
bun add foxact --filter @packages/ui
```

**Step 2: Remove @uidotdev/usehooks**

```bash
bun remove @uidotdev/usehooks --filter @apps/web
```

**Step 3: Verify install**

```bash
bun run typecheck 2>&1 | head -40
```

Expected: errors only about missing hook replacements (not foxact itself).

**Step 4: Commit**

```bash
git add apps/web/package.json packages/ui/package.json bun.lock
git commit -m "build(deps): add foxact, remove @uidotdev/usehooks"
```

---

## Task 2: Migrate useDebounce (@uidotdev) → foxact/use-debounced-value

**Files:**

- Modify: `apps/web/src/features/analytics/hooks/use-insight-config.ts:7,50`

**Step 1: Open the file and verify current usage**

File: `apps/web/src/features/analytics/hooks/use-insight-config.ts`
Line 7: `import { useDebounce } from "@uidotdev/usehooks";`
Line 50: `const debouncedUpdates = useDebounce(pendingUpdates, 500);`

**Step 2: Replace import**

Old:

```typescript
import { useDebounce } from "@uidotdev/usehooks";
```

New:

```typescript
import { useDebouncedValue } from "foxact/use-debounced-value";
```

**Step 3: Replace usage**

Old:

```typescript
const debouncedUpdates = useDebounce(pendingUpdates, 500);
```

New:

```typescript
const debouncedUpdates = useDebouncedValue(pendingUpdates, 500);
```

**Step 4: Typecheck**

```bash
bun run typecheck 2>&1 | grep use-insight-config
```

Expected: no errors for this file.

**Step 5: Commit**

```bash
git add apps/web/src/features/analytics/hooks/use-insight-config.ts
git commit -m "refactor: migrate use-insight-config debounce to foxact"
```

---

## Task 3: Migrate packages/ui useDebounce hook → foxact/use-debounced-value

**Files:**

- Modify: `apps/web/src/routes/_authenticated/-onboarding/cnpj-step.tsx`
- Delete: `packages/ui/src/hooks/use-debounce.ts`

**Step 1: Find all usages of the local useDebounce**

```bash
grep -r "use-debounce" apps/web/src packages/ui/src --include="*.ts" --include="*.tsx" -l
```

**Step 2: Update cnpj-step.tsx**

File: `apps/web/src/routes/_authenticated/-onboarding/cnpj-step.tsx`

Old import:

```typescript
import { useDebounce } from "@packages/ui/hooks/use-debounce";
```

New import:

```typescript
import { useDebouncedValue } from "foxact/use-debounced-value";
```

Old usage (line ~62):

```typescript
const debouncedDigits = useDebounce(rawValue, 400);
```

New usage:

```typescript
const debouncedDigits = useDebouncedValue(rawValue, 400);
```

**Step 3: Delete the local hook file**

```bash
rm packages/ui/src/hooks/use-debounce.ts
```

**Step 4: Verify no remaining imports**

```bash
grep -r "use-debounce\|useDebounce" apps/web/src packages/ui/src --include="*.ts" --include="*.tsx"
```

Expected: no results.

**Step 5: Typecheck**

```bash
bun run typecheck 2>&1 | grep -E "use-debounce|cnpj"
```

Expected: no errors.

**Step 6: Commit**

```bash
git add -A
git commit -m "refactor: replace local useDebounce with foxact/use-debounced-value"
```

---

## Task 4: Migrate useIsomorphicLayoutEffect from @dnd-kit/utilities → foxact

**Context:** `useIsomorphicLayoutEffect` is currently imported from `@dnd-kit/utilities` in three places. foxact exports its own — this removes the accidental DnD coupling.

**Files to update:**

- `packages/ui/src/hooks/use-media-query.ts` (line 12)
- `apps/web/src/hooks/use-local-storage.ts` (line 18)
- `apps/web/src/hooks/use-standalone.ts` (line 12)

**Step 1: Update use-media-query.ts**

Old:

```typescript
import { useIsomorphicLayoutEffect } from "@dnd-kit/utilities";
```

New:

```typescript
import { useIsomorphicLayoutEffect } from "foxact/use-isomorphic-layout-effect";
```

**Step 2: Update use-local-storage.ts**

Same swap — old `@dnd-kit/utilities`, new `foxact/use-isomorphic-layout-effect`.

**Step 3: Update use-standalone.ts**

Same swap.

**Step 4: Typecheck**

```bash
bun run typecheck 2>&1 | grep -E "use-media-query|use-local-storage|use-standalone"
```

Expected: no errors.

**Step 5: Commit**

```bash
git add packages/ui/src/hooks/use-media-query.ts apps/web/src/hooks/use-local-storage.ts apps/web/src/hooks/use-standalone.ts
git commit -m "refactor: replace @dnd-kit/utilities useIsomorphicLayoutEffect with foxact"
```

---

## Task 5: Migrate useSafeMediaQuery → foxact/use-media-query

**Context:** `packages/ui/src/hooks/use-media-query.ts` is a custom SSR-safe wrapper. foxact's `useMediaQuery` is SSR-safe out of the box (uses `useSyncExternalStore`). We replace the wrapper and update all callsites to import from foxact directly. The `useSafeMediaQuery` alias is kept as a re-export briefly to ease migration, then deleted.

**Files:**

- Modify: `packages/ui/src/hooks/use-media-query.ts` → replace implementation, then delete
- Modify: `packages/ui/src/hooks/use-mobile.ts`
- Modify: `apps/web/src/hooks/use-standalone.ts`
- Modify: any file importing `useSafeMediaQuery`

**Step 1: Find all callsites**

```bash
grep -r "useSafeMediaQuery\|use-media-query" apps/web/src packages/ui/src --include="*.ts" --include="*.tsx" -n
```

**Step 2: Update use-mobile.ts**

Old:

```typescript
import { useSafeMediaQuery } from "@packages/ui/hooks/use-media-query";
export const useIsMobile = () => useSafeMediaQuery("(max-width: 767px)");
```

New:

```typescript
import { useMediaQuery } from "foxact/use-media-query";
export const useIsMobile = () => useMediaQuery("(max-width: 767px)");
```

**Step 3: Update use-standalone.ts**

Old:

```typescript
import { useSafeMediaQuery } from "@packages/ui/hooks/use-media-query";
const isStandaloneMedia = useSafeMediaQuery("(display-mode: standalone)");
const isWindowControlsOverlay = useSafeMediaQuery(
   "(display-mode: window-controls-overlay)",
);
```

New:

```typescript
import { useMediaQuery } from "foxact/use-media-query";
const isStandaloneMedia = useMediaQuery("(display-mode: standalone)");
const isWindowControlsOverlay = useMediaQuery(
   "(display-mode: window-controls-overlay)",
);
```

**Step 4: Update any remaining callsites found in Step 1**

For each file: swap `useSafeMediaQuery` → `useMediaQuery`, update import to `foxact/use-media-query`.

**Step 5: Delete the wrapper file**

```bash
rm packages/ui/src/hooks/use-media-query.ts
```

**Step 6: Verify no remaining usages**

```bash
grep -r "useSafeMediaQuery\|use-media-query" apps/web/src packages/ui/src --include="*.ts" --include="*.tsx"
```

Expected: no results.

**Step 7: Typecheck**

```bash
bun run typecheck 2>&1 | grep -i media
```

Expected: no errors.

**Step 8: Commit**

```bash
git add -A
git commit -m "refactor: replace useSafeMediaQuery wrapper with foxact/use-media-query"
```

---

## Task 6: Migrate useSafeLocalStorage → foxact/use-local-storage

**Context:** `apps/web/src/hooks/use-local-storage.ts` is a custom SSR-safe localStorage hook. foxact's `useLocalStorage` is SSR-safe and handles hydration. We replace all 3 callsites and delete the wrapper.

**Files:**

- Modify: `apps/web/src/routes/auth/callback.tsx:19-21`
- Modify: `apps/web/src/layout/dashboard/ui/dashboard-layout.tsx:57-60`
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/home/-home/quick-start-checklist.tsx:34-37`
- Delete: `apps/web/src/hooks/use-local-storage.ts`

**Step 1: Update callback.tsx**

Old:

```typescript
import { useSafeLocalStorage } from "@/hooks/use-local-storage";
const [pendingInvitation, setPendingInvitation] = useSafeLocalStorage<
   string | null
>(PENDING_INVITATION_KEY, null);
```

New:

```typescript
import { useLocalStorage } from "foxact/use-local-storage";
const [pendingInvitation, setPendingInvitation] = useLocalStorage<
   string | null
>(PENDING_INVITATION_KEY, null);
```

**Step 2: Update dashboard-layout.tsx**

Old:

```typescript
import { useSafeLocalStorage } from "@/hooks/use-local-storage";
const [sidebarCollapsed, setSidebarCollapsed] = useSafeLocalStorage<boolean>(
   "montte:sidebar-collapsed",
   false,
);
```

New:

```typescript
import { useLocalStorage } from "foxact/use-local-storage";
const [sidebarCollapsed, setSidebarCollapsed] = useLocalStorage<boolean>(
   "montte:sidebar-collapsed",
   false,
);
```

**Step 3: Update quick-start-checklist.tsx**

Old:

```typescript
import { useSafeLocalStorage } from "@/hooks/use-local-storage";
const [hiddenBySlug, setHiddenBySlug] = useSafeLocalStorage<
   Record<string, boolean>
>("montte:checklist_hidden", {});
```

New:

```typescript
import { useLocalStorage } from "foxact/use-local-storage";
const [hiddenBySlug, setHiddenBySlug] = useLocalStorage<
   Record<string, boolean>
>("montte:checklist_hidden", {});
```

**Step 4: Delete the wrapper**

```bash
rm apps/web/src/hooks/use-local-storage.ts
```

**Step 5: Verify**

```bash
grep -r "useSafeLocalStorage\|use-local-storage" apps/web/src --include="*.ts" --include="*.tsx"
```

Expected: no results.

**Step 6: Typecheck**

```bash
bun run typecheck 2>&1 | grep -i local-storage
```

Expected: no errors.

**Step 7: Commit**

```bash
git add -A
git commit -m "refactor: replace useSafeLocalStorage wrapper with foxact/use-local-storage"
```

---

## Task 7: Migrate navigator.clipboard patterns → foxact/use-clipboard

**Files:**

- Modify: `packages/ui/src/components/code-block.tsx:16-20`
- Modify: `packages/ui/src/components/assistant-ui/markdown-text.tsx:54-71`

**Step 1: Update code-block.tsx**

Old (lines 16-20):

```typescript
const [copied, setCopied] = useState(false);
const handleCopy = useCallback(async () => {
   await navigator.clipboard.writeText(code);
   setCopied(true);
   setTimeout(() => setCopied(false), 2000);
}, [code]);
```

New:

```typescript
import { useClipboard } from "foxact/use-clipboard";
// ...
const [copied, copyToClipboard] = useClipboard({ timeout: 2000 });
const handleCopy = useCallback(
   () => copyToClipboard(code),
   [code, copyToClipboard],
);
```

Remove the `useState` for `copied` and the `setTimeout` — foxact handles the timeout internally. The `copied` boolean is now the first element of the tuple from `useClipboard`.

**Step 2: Update markdown-text.tsx**

The local `useCopyToClipboard` inline hook (lines 54-71) can be deleted entirely. Replace with foxact:

Old:

```typescript
const useCopyToClipboard = ({ copiedDuration = 3000 } = {}) => {
   const [isCopied, setIsCopied] = useState<boolean>(false);
   const copyToClipboard = (value: string) => {
      if (!value) return;
      navigator.clipboard.writeText(value).then(() => {
         setIsCopied(true);
         setTimeout(() => setIsCopied(false), copiedDuration);
      });
   };
   return { isCopied, copyToClipboard };
};
// usage inside component:
const { isCopied, copyToClipboard } = useCopyToClipboard({
   copiedDuration: 3000,
});
```

New (at usage site):

```typescript
import { useClipboard } from "foxact/use-clipboard";
// inside component:
const [isCopied, copyToClipboard] = useClipboard({ timeout: 3000 });
```

Delete the inline `useCopyToClipboard` function entirely.

**Step 3: Typecheck**

```bash
bun run typecheck 2>&1 | grep -E "code-block|markdown-text"
```

Expected: no errors.

**Step 4: Commit**

```bash
git add packages/ui/src/components/code-block.tsx packages/ui/src/components/assistant-ui/markdown-text.tsx
git commit -m "refactor: replace manual clipboard patterns with foxact/use-clipboard"
```

---

## Task 8: Migrate stable handler pattern → foxact/use-stable-handler

**Context:** In `apps/web/src/routes/.../chat/index.tsx` there's a manual stable-handler pattern:

```typescript
const createThreadRef = useRef(createThread.mutateAsync);
createThreadRef.current = createThread.mutateAsync;
```

This is exactly what `useStableHandler` does.

**Files:**

- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/chat/index.tsx:48-52`

**Step 1: Read the file to understand full context around lines 48-52**

**Step 2: Replace the pattern**

Old:

```typescript
const createThreadRef = useRef(createThread.mutateAsync);
createThreadRef.current = createThread.mutateAsync;
```

New:

```typescript
import { useStableHandler } from "foxact/use-stable-handler-only-when-you-know-what-you-are-doing-or-you-will-be-fired";

const stableCreateThread = useStableHandler(createThread.mutateAsync);
```

Update all references to `createThreadRef.current(...)` → `stableCreateThread(...)`.

**Step 3: Typecheck**

```bash
bun run typecheck 2>&1 | grep chat
```

Expected: no errors.

**Step 4: Commit**

```bash
git add apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/chat/index.tsx
git commit -m "refactor: replace manual stable-handler ref pattern with foxact/use-stable-handler"
```

---

## Task 9: Final cleanup — verify @uidotdev/usehooks is gone

**Step 1: Confirm no remaining usages**

```bash
grep -r "@uidotdev/usehooks" apps/ packages/ --include="*.ts" --include="*.tsx"
```

Expected: no results.

**Step 2: Check package.json entries**

```bash
grep -r "@uidotdev" apps/ packages/ --include="package.json"
```

Expected: no results (already removed in Task 1).

**Step 3: Typecheck full project**

```bash
bun run typecheck
```

Expected: no errors related to hook migrations.

**Step 4: Run tests**

```bash
bun run test
```

Expected: all pass.

**Step 5: Final commit if any leftover changes**

```bash
git add -A
git commit -m "chore: finalize foxact migration, remove @uidotdev/usehooks"
```

---

## Summary of deleted files

After completing all tasks:

- `apps/web/src/hooks/use-local-storage.ts` — deleted ✅
- `packages/ui/src/hooks/use-media-query.ts` — deleted ✅
- `packages/ui/src/hooks/use-debounce.ts` — deleted ✅

## Summary of removed dependencies

- `@uidotdev/usehooks` — uninstalled from `apps/web`
- `foxact` — added to `apps/web` and `packages/ui`
