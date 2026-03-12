# PlateJS Hard Delete Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove PlateJS and all editor-related shared UI code from the monorepo so the ERP no longer ships or maintains rich-editor infrastructure.

**Architecture:** PlateJS is concentrated in `packages/ui`, with app-level references already absent in `apps/*`. The safest approach is to remove the full editor surface from `packages/ui`, delete PlateJS dependencies from `packages/ui`, `apps/web`, and the root catalog, then run focused type/build verification to catch any remaining transitive references.

**Tech Stack:** Bun workspaces, Nx monorepo, React 19, Vite 8 beta, TypeScript, oxlint, `@packages/ui`

---

### Task 1: Freeze the removal surface

**Files:**
- Inspect: `packages/ui/package.json`
- Inspect: `apps/web/package.json`
- Inspect: `package.json`

**Step 1: Capture PlateJS dependency declarations**

Record all `platejs` and `@platejs/*` entries from:
- `packages/ui/package.json`
- `apps/web/package.json`
- root `package.json` workspace catalog `editor`

**Step 2: Capture PlateJS source footprint**

Run searches for:
- direct imports from `platejs` / `@platejs/*`
- imports of editor-related `@packages/ui/components/*` files

**Step 3: Verify app usage is already absent**

Run a search limited to `apps/` and confirm there are no remaining app imports of the editor surface.

### Task 2: Remove editor source from `packages/ui`

**Files:**
- Delete: `packages/ui/src/components/editor/editor-base-kit.tsx`
- Delete: `packages/ui/src/components/editor/plugins/*.tsx`
- Delete: `packages/ui/src/components/ai-chat-editor.tsx`
- Delete: `packages/ui/src/components/ai-menu.tsx`
- Delete: `packages/ui/src/components/block-discussion.tsx`
- Delete: `packages/ui/src/components/block-list.tsx`
- Delete: `packages/ui/src/components/block-list-static.tsx`
- Delete: `packages/ui/src/components/block-suggestion.tsx`
- Delete: `packages/ui/src/components/blockquote-node.tsx`
- Delete: `packages/ui/src/components/blockquote-node-static.tsx`
- Delete: `packages/ui/src/components/callout-node.tsx`
- Delete: `packages/ui/src/components/callout-node-static.tsx`
- Delete: `packages/ui/src/components/caption.tsx`
- Delete: `packages/ui/src/components/code-block-node.tsx`
- Delete: `packages/ui/src/components/code-block-node-static.tsx`
- Delete: `packages/ui/src/components/code-drawing-node.tsx`
- Delete: `packages/ui/src/components/code-drawing-node-static.tsx`
- Delete: `packages/ui/src/components/code-node.tsx`
- Delete: `packages/ui/src/components/code-node-static.tsx`
- Delete: `packages/ui/src/components/column-node.tsx`
- Delete: `packages/ui/src/components/column-node-static.tsx`
- Delete: `packages/ui/src/components/comment.tsx`
- Delete: `packages/ui/src/components/comment-node.tsx`
- Delete: `packages/ui/src/components/comment-node-static.tsx`
- Delete: `packages/ui/src/components/comment-toolbar-button.tsx`
- Delete: `packages/ui/src/components/cursor-overlay.tsx`
- Delete: `packages/ui/src/components/date-node.tsx`
- Delete: `packages/ui/src/components/date-node-static.tsx`
- Delete: `packages/ui/src/components/editor.tsx`
- Delete: `packages/ui/src/components/editor-static.tsx`
- Delete: `packages/ui/src/components/emoji-node.tsx`
- Delete: `packages/ui/src/components/emoji-toolbar-button.tsx`
- Delete: `packages/ui/src/components/equation-node.tsx`
- Delete: `packages/ui/src/components/equation-node-static.tsx`
- Delete: `packages/ui/src/components/font-color-toolbar-button.tsx`
- Delete: `packages/ui/src/components/ghost-text.tsx`
- Delete: `packages/ui/src/components/heading-node.tsx`
- Delete: `packages/ui/src/components/heading-node-static.tsx`
- Delete: `packages/ui/src/components/highlight-node.tsx`
- Delete: `packages/ui/src/components/highlight-node-static.tsx`
- Delete: `packages/ui/src/components/hr-node.tsx`
- Delete: `packages/ui/src/components/hr-node-static.tsx`
- Delete: `packages/ui/src/components/inline-combobox.tsx`
- Delete: `packages/ui/src/components/kbd-node.tsx`
- Delete: `packages/ui/src/components/kbd-node-static.tsx`
- Delete: `packages/ui/src/components/link-node.tsx`
- Delete: `packages/ui/src/components/link-node-static.tsx`
- Delete: `packages/ui/src/components/mark-toolbar-button.tsx`
- Delete: `packages/ui/src/components/media-audio-node.tsx`
- Delete: `packages/ui/src/components/media-audio-node-static.tsx`
- Delete: `packages/ui/src/components/media-file-node.tsx`
- Delete: `packages/ui/src/components/media-file-node-static.tsx`
- Delete: `packages/ui/src/components/media-image-node.tsx`
- Delete: `packages/ui/src/components/media-image-node-static.tsx`
- Delete: `packages/ui/src/components/media-toolbar.tsx`
- Delete: `packages/ui/src/components/media-video-node.tsx`
- Delete: `packages/ui/src/components/media-video-node-static.tsx`
- Delete: `packages/ui/src/components/mention-node.tsx`
- Delete: `packages/ui/src/components/mention-node-static.tsx`
- Delete: `packages/ui/src/components/paragraph-node.tsx`
- Delete: `packages/ui/src/components/paragraph-node-static.tsx`
- Delete: `packages/ui/src/components/resize-handle.tsx`
- Delete: `packages/ui/src/components/suggestion-node.tsx`
- Delete: `packages/ui/src/components/suggestion-node-static.tsx`
- Delete: `packages/ui/src/components/suggestion-toolbar-button.tsx`
- Delete: `packages/ui/src/components/table-icons.tsx`
- Delete: `packages/ui/src/components/table-node.tsx`
- Delete: `packages/ui/src/components/table-node-static.tsx`
- Delete: `packages/ui/src/components/toc-node.tsx`
- Delete: `packages/ui/src/components/toc-node-static.tsx`
- Delete: `packages/ui/src/components/toggle-node.tsx`
- Delete: `packages/ui/src/components/toggle-node-static.tsx`
- Delete: `packages/ui/src/components/toolbar.tsx`

**Step 1: Delete only the PlateJS/editor surface**

Do not touch unrelated UI primitives such as `button`, `input`, `dialog`, `data-table`, `calendar`, `select`, `dropdown-menu`, `popover`, or `checkbox`.

**Step 2: Remove empty editor directories if they become unused**

If `packages/ui/src/components/editor/` is empty after deletion, remove the directory.

### Task 3: Remove dependency declarations

**Files:**
- Modify: `packages/ui/package.json`
- Modify: `apps/web/package.json`
- Modify: `package.json`

**Step 1: Remove all PlateJS dependencies from `packages/ui/package.json`**

Delete every `platejs` / `@platejs/*` dependency.

**Step 2: Remove all PlateJS dependencies from `apps/web/package.json`**

Delete every `platejs` / `@platejs/*` dependency.

**Step 3: Remove the root workspace `editor` catalog if it becomes unused**

Delete the `editor` catalog block from root `package.json` once no workspace references remain.

### Task 4: Clean remaining broken references

**Files:**
- Modify: any remaining files reported by search/typecheck

**Step 1: Search for leftover source imports**

Search for:
- `platejs`
- `@platejs`
- removed `@packages/ui/components/*` editor files

**Step 2: Delete or replace any stale imports**

If a non-editor file still imports the deleted editor surface, remove the import and the dependent code path. Do not add compatibility wrappers.

### Task 5: Refresh the lockfile

**Files:**
- Modify: `bun.lock`

**Step 1: Run install**

Run: `bun install`

**Step 2: Confirm PlateJS packages are gone from the lockfile**

Search the updated lockfile for `platejs` / `@platejs` references.

### Task 6: Verify the workspace still typechecks and builds

**Files:**
- Verify only

**Step 1: Verify `@packages/ui` typecheck**

Run: `bun run --filter=@packages/ui typecheck`

**Step 2: Verify `apps/web` build**

Run: `bun run --filter=web build`

**Step 3: Verify no PlateJS strings remain in source package manifests**

Search:
- `package.json`
- `packages/ui/package.json`
- `apps/web/package.json`
- `packages/ui/src`
- `apps/`

**Step 4: Report unrelated failures separately**

If verification fails for non-PlateJS reasons, report them as pre-existing or newly surfaced issues instead of masking them.
