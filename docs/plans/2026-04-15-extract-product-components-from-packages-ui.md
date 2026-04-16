# Extract Product-Specific Components from packages/ui

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move Montte-domain-specific components out of `packages/ui` into `apps/web/src/components/blocks/` and update all imports.

**Architecture:** Each component file gets copied to `apps/web/src/components/blocks/`, all `@packages/ui/components/<name>` imports across `apps/web` are rewritten to `@/components/blocks/<name>`, then the originals are deleted from `packages/ui`. The `feature-stage-badge-showcase.tsx` is also removed (showcase/test file, not needed in production layer).

**Tech Stack:** TypeScript, React, TanStack Start, Bun

---

## Component inventory

| Component                          | Source                        | Consumers                                                                |
| ---------------------------------- | ----------------------------- | ------------------------------------------------------------------------ |
| `announcement.tsx`                 | `packages/ui/src/components/` | 4 files                                                                  |
| `banner.tsx`                       | `packages/ui/src/components/` | 0 direct `@packages/ui` imports (already used via feature wrappers only) |
| `quick-access-card.tsx`            | `packages/ui/src/components/` | 2 files                                                                  |
| `feature-stage-badge.tsx`          | `packages/ui/src/components/` | 5 files                                                                  |
| `feature-stage-badge-showcase.tsx` | `packages/ui/src/components/` | showcase — delete outright                                               |
| `stats-card.tsx`                   | `packages/ui/src/components/` | 0 `@packages/ui` imports found — may be unused externally                |
| `time-period-chips.tsx`            | `packages/ui/src/components/` | 0 `@packages/ui` imports found — used via url search / route files       |

> Verify consumers for `stats-card` and `time-period-chips` before deleting from `packages/ui` in Tasks 6-7.

---

### Task 1: Create `apps/web/src/components/blocks/` and copy `announcement.tsx`

**Files:**

- Create: `apps/web/src/components/blocks/announcement.tsx`

**Step 1: Copy component**

Create `apps/web/src/components/blocks/announcement.tsx` with this content (replace `@packages/ui` internal imports with relative `@packages/ui` since the component only uses `cn` and `Badge` — keep referencing `@packages/ui` for those generic primitives):

```tsx
import type { ComponentProps, HTMLAttributes } from "react";
import { cn } from "@packages/ui/lib/utils";
import { Badge } from "@packages/ui/components/badge";

export type AnnouncementProps = ComponentProps<typeof Badge> & {
   themed?: boolean;
};

export const Announcement = ({
   variant = "outline",
   themed = false,
   className,
   ...props
}: AnnouncementProps) => (
   <Badge
      className={cn(
         "group max-w-full gap-2 rounded-full bg-background px-3 py-0.5 font-medium shadow-sm transition-all",
         "hover:shadow-md",
         themed && "announcement-themed border-foreground/5",
         className,
      )}
      variant={variant}
      {...props}
   />
);

export type AnnouncementTagProps = HTMLAttributes<HTMLDivElement>;

export const AnnouncementTag = ({
   className,
   ...props
}: AnnouncementTagProps) => (
   <div
      className={cn(
         "-ml-2.5 shrink-0 truncate rounded-full bg-foreground/5 px-2.5 py-1 text-xs",
         "group-[.announcement-themed]:bg-background/60",
         className,
      )}
      {...props}
   />
);

export type AnnouncementTitleProps = HTMLAttributes<HTMLDivElement>;

export const AnnouncementTitle = ({
   className,
   ...props
}: AnnouncementTitleProps) => (
   <div
      className={cn("flex items-center gap-1 truncate py-1", className)}
      {...props}
   />
);
```

**Step 2: Update all 4 consumers**

Files to update (change `from "@packages/ui/components/announcement"` → `from "@/components/blocks/announcement"`):

- `apps/web/src/features/transactions/ui/transactions-list.tsx:5`
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-categories/categories-columns.tsx:6`
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-bank-accounts/bank-accounts-columns.tsx:6`
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-transactions/statement-import-credenza.tsx:7`
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-credit-cards/credit-cards-columns.tsx:7`

**Step 3: Delete original from packages/ui**

```bash
rm packages/ui/src/components/announcement.tsx
```

**Step 4: Typecheck**

```bash
bun run typecheck
```

Expected: no errors related to `announcement`.

**Step 5: Commit**

```bash
git add apps/web/src/components/blocks/announcement.tsx \
  apps/web/src/features/transactions/ui/transactions-list.tsx \
  "apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/-categories/categories-columns.tsx" \
  "apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/-bank-accounts/bank-accounts-columns.tsx" \
  "apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/-transactions/statement-import-credenza.tsx" \
  "apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/-credit-cards/credit-cards-columns.tsx" \
  packages/ui/src/components/announcement.tsx
git commit -m "refactor: move announcement component to apps/web blocks"
```

---

### Task 2: Move `banner.tsx`

**Files:**

- Create: `apps/web/src/components/blocks/banner.tsx`

**Step 1: Verify no direct `@packages/ui/components/banner` imports remain**

```bash
grep -rn 'from "@packages/ui/components/banner"' apps/web/src
```

Expected: no output (the banner is already consumed only through `EarlyAccessBanner` wrappers in `apps/web`).

**Step 2: Copy component**

Create `apps/web/src/components/blocks/banner.tsx` — exact content of `packages/ui/src/components/banner.tsx` but change the internal import:

```
- import { cn } from "../lib/utils";
- import { Button } from "./button";
+ import { cn } from "@packages/ui/lib/utils";
+ import { Button } from "@packages/ui/components/button";
```

Everything else stays identical.

**Step 3: Update `early-access-banner.tsx`** (if it imports from `@packages/ui/components/banner`; verify first)

```bash
grep -n 'banner' apps/web/src/features/billing/ui/early-access-banner.tsx
```

If it imports from `@packages/ui/components/banner`, change to `@/components/blocks/banner`.

**Step 4: Delete original**

```bash
rm packages/ui/src/components/banner.tsx
```

**Step 5: Typecheck**

```bash
bun run typecheck
```

**Step 6: Commit**

```bash
git add apps/web/src/components/blocks/banner.tsx packages/ui/src/components/banner.tsx
git commit -m "refactor: move banner component to apps/web blocks"
```

---

### Task 3: Move `quick-access-card.tsx`

**Files:**

- Create: `apps/web/src/components/blocks/quick-access-card.tsx`

**Step 1: Copy component**

Create `apps/web/src/components/blocks/quick-access-card.tsx` with content from `packages/ui/src/components/quick-access-card.tsx`. Change internal card import:

```
- } from "./card";
+ } from "@packages/ui/components/card";
```

**Step 2: Update 2 consumers**

Files (change `from "@packages/ui/components/quick-access-card"` → `from "@/components/blocks/quick-access-card"`):

- `apps/web/src/layout/dashboard/ui/settings-mobile-nav.tsx:2`
- `apps/web/src/layout/dashboard/ui/data-management-mobile-nav.tsx:2`

**Step 3: Delete original**

```bash
rm packages/ui/src/components/quick-access-card.tsx
```

**Step 4: Typecheck**

```bash
bun run typecheck
```

**Step 5: Commit**

```bash
git add apps/web/src/components/blocks/quick-access-card.tsx \
  apps/web/src/layout/dashboard/ui/settings-mobile-nav.tsx \
  apps/web/src/layout/dashboard/ui/data-management-mobile-nav.tsx \
  packages/ui/src/components/quick-access-card.tsx
git commit -m "refactor: move quick-access-card component to apps/web blocks"
```

---

### Task 4: Move `feature-stage-badge.tsx` and delete `feature-stage-badge-showcase.tsx`

**Files:**

- Create: `apps/web/src/components/blocks/feature-stage-badge.tsx`

**Step 1: Copy component**

Create `apps/web/src/components/blocks/feature-stage-badge.tsx` with content from `packages/ui/src/components/feature-stage-badge.tsx`. Change imports:

```
- import { cn } from "@packages/ui/lib/utils";
  (keep as-is — already absolute)
- import { Badge } from "./badge";
+ import { Badge } from "@packages/ui/components/badge";
```

**Step 2: Update 5 consumers**

Change `from "@packages/ui/components/feature-stage-badge"` → `from "@/components/blocks/feature-stage-badge"`:

- `apps/web/src/features/billing/ui/early-access-banner.tsx:6`
- `apps/web/src/layout/dashboard/ui/settings-sidebar.tsx:6`
- `apps/web/src/layout/dashboard/ui/sidebar-nav-config-form.tsx:9`
- `apps/web/src/layout/dashboard/ui/sidebar-nav.tsx:3`
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/settings/feature-previews.tsx:11`

**Step 3: Delete originals**

```bash
rm packages/ui/src/components/feature-stage-badge.tsx
rm packages/ui/src/components/feature-stage-badge-showcase.tsx
```

**Step 4: Typecheck**

```bash
bun run typecheck
```

**Step 5: Commit**

```bash
git add apps/web/src/components/blocks/feature-stage-badge.tsx \
  apps/web/src/features/billing/ui/early-access-banner.tsx \
  apps/web/src/layout/dashboard/ui/settings-sidebar.tsx \
  apps/web/src/layout/dashboard/ui/sidebar-nav-config-form.tsx \
  apps/web/src/layout/dashboard/ui/sidebar-nav.tsx \
  "apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/settings/feature-previews.tsx" \
  packages/ui/src/components/feature-stage-badge.tsx \
  packages/ui/src/components/feature-stage-badge-showcase.tsx
git commit -m "refactor: move feature-stage-badge to apps/web blocks, remove showcase"
```

---

### Task 5: Move `stats-card.tsx`

**Step 1: Verify current consumers**

```bash
grep -rn 'stats-card\|StatsCard' apps/web/src --include="*.tsx" --include="*.ts"
```

- If consumers found importing from `@packages/ui`: follow same copy+update+delete pattern as Tasks 1-4.
- If no consumers found: still move to blocks (to keep boundary clean) with no import updates needed.

**Step 2: Copy component**

Create `apps/web/src/components/blocks/stats-card.tsx`:

```tsx
import {
   Card,
   CardDescription,
   CardHeader,
   CardTitle,
} from "@packages/ui/components/card";

type Values = {
   title: string;
   description: string;
   value: number | string;
};
interface StatsCardProps {
   className?: string;
   title: Values["title"];
   description: Values["description"];
   value: Values["value"];
}

export function StatsCard({
   className,
   title,
   description,
   value,
}: StatsCardProps) {
   return (
      <Card className={className ?? "col-span-1 h-full w-full"}>
         <CardHeader>
            <CardDescription>{title}</CardDescription>
            <CardTitle>{value}</CardTitle>
            <CardDescription>{description}</CardDescription>
         </CardHeader>
      </Card>
   );
}
```

**Step 3: Update consumers** (if any from Step 1).

**Step 4: Delete original**

```bash
rm packages/ui/src/components/stats-card.tsx
```

**Step 5: Typecheck**

```bash
bun run typecheck
```

**Step 6: Commit**

```bash
git add apps/web/src/components/blocks/stats-card.tsx packages/ui/src/components/stats-card.tsx
git commit -m "refactor: move stats-card component to apps/web blocks"
```

---

### Task 6: Move `time-period-chips.tsx`

**Step 1: Verify current consumers**

```bash
grep -rn 'time-period-chips\|TimePeriodChips\|TimePeriod\b\|getDateRangeForPeriod\|TIME_PERIODS' apps/web/src --include="*.tsx" --include="*.ts"
```

Note which files import from `@packages/ui/components/time-period-chips`.

**Step 2: Copy component**

Create `apps/web/src/components/blocks/time-period-chips.tsx` — exact content of `packages/ui/src/components/time-period-chips.tsx`. Change:

```
- import { cn } from "@packages/ui/lib/utils";
  (keep — already absolute)
- } from "./toggle-group";
+ } from "@packages/ui/components/toggle-group";
```

**Step 3: Update consumers** (if any from Step 1 import from `@packages/ui`).

**Step 4: Delete original**

```bash
rm packages/ui/src/components/time-period-chips.tsx
```

**Step 5: Typecheck**

```bash
bun run typecheck
```

**Step 6: Commit**

```bash
git add apps/web/src/components/blocks/time-period-chips.tsx packages/ui/src/components/time-period-chips.tsx
git commit -m "refactor: move time-period-chips component to apps/web blocks"
```

---

### Task 7: Final verification

**Step 1: Confirm no stale `@packages/ui` references to moved components**

```bash
grep -rn 'from "@packages/ui/components/announcement"\|from "@packages/ui/components/banner"\|from "@packages/ui/components/quick-access-card"\|from "@packages/ui/components/feature-stage-badge"\|from "@packages/ui/components/stats-card"\|from "@packages/ui/components/time-period-chips"' apps/web/src
```

Expected: zero results.

**Step 2: Confirm moved files exist in blocks**

```bash
ls apps/web/src/components/blocks/
```

Expected: `announcement.tsx  banner.tsx  feature-stage-badge.tsx  quick-access-card.tsx  stats-card.tsx  time-period-chips.tsx` plus any pre-existing files.

**Step 3: Full typecheck**

```bash
bun run typecheck
```

Expected: zero errors.

**Step 4: Lint**

```bash
bun run check
```

Expected: zero errors.
