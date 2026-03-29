# Feedback → PostHog Native Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove custom feedback UI wrappers and `@packages/feedback`, use PostHog native surveys directly, properly link surveys to feature flags, and make sidebar stage badges dynamically driven by PostHog early access features.

**Architecture:**
- PostHog JS SDK renders surveys natively based on targeting rules in the PostHog dashboard — no custom form UI needed.
- Stage badges in the sidebar read stage from the already-fetched `posthog.getEarlyAccessFeatures()` data; static stage definitions are removed so PostHog is the single source of truth.
- Feature-specific feedback is triggered via `posthog.capture(...)` events, which PostHog uses to target and show the matching survey.

**Tech Stack:** `posthog-js` (already installed), PostHog dashboard for survey & feature flag config, oRPC for enrollment queries.

---

### Task 1: Remove oRPC feedback router + root router entry

**Files:**
- Delete: `apps/web/src/integrations/orpc/router/feedback.ts`
- Modify: `apps/web/src/integrations/orpc/router/index.ts`

**Step 1: Remove feedback entry from root router**

Open `apps/web/src/integrations/orpc/router/index.ts`. Delete:
```typescript
// Remove import:
import * as feedback from "./feedback";

// Remove from router object:
feedback: { ...feedback },
```

**Step 2: Delete the feedback router file**

```bash
rm apps/web/src/integrations/orpc/router/feedback.ts
```

**Step 3: Typecheck**

```bash
bun run typecheck
```
Expected: no errors related to feedback.

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: remove oRPC feedback router"
```

---

### Task 2: Remove feedbackSender singleton

**Files:**
- Modify: `apps/web/src/integrations/singletons.ts`

**Step 1: Remove feedbackSender**

Open `singletons.ts`. Remove:
- `import { createFeedbackSender } from "@packages/feedback/sender"`
- `export const feedbackSender = createFeedbackSender({...})`

**Step 2: Typecheck**

```bash
bun run typecheck
```

**Step 3: Commit**

```bash
git add apps/web/src/integrations/singletons.ts
git commit -m "feat: remove feedbackSender singleton"
```

---

### Task 3: Delete all custom feedback UI components

**Files:**
- Delete: `apps/web/src/features/feedback/` (entire directory)

**Step 1: Delete directory**

```bash
rm -rf apps/web/src/features/feedback/
```

**Step 2: Commit**

```bash
git add -A
git commit -m "feat: delete custom feedback UI components"
```

---

### Task 4: Remove AutoBugReporter from dashboard layout

**Files:**
- Modify: `apps/web/src/layout/dashboard/ui/dashboard-layout.tsx`

**Step 1: Remove AutoBugReporter**

Open `dashboard-layout.tsx`. Delete:
- Any import from `@/features/feedback`
- The `<AutoBugReporter />` JSX element and its surrounding logic
- The `useApiErrorTracker` call (if present here)

**Step 2: Typecheck**

```bash
bun run typecheck
```

**Step 3: Commit**

```bash
git add apps/web/src/layout/dashboard/ui/dashboard-layout.tsx
git commit -m "feat: remove AutoBugReporter from dashboard layout"
```

---

### Task 5: Replace sidebar feedback button with PostHog survey trigger

**Files:**
- Modify: `apps/web/src/layout/dashboard/ui/app-sidebar.tsx`

**Step 1: Replace SidebarFeedbackButton with direct posthog capture**

The current button opens a popover with "Bug Report" / "Feature Request" options. Replace with a simple button that captures an event — PostHog surveys will be targeted to fire on this event from the dashboard.

Import posthog:
```typescript
import posthog from "posthog-js";
```

Replace `SidebarFeedbackButton` body:
```typescript
function SidebarFeedbackButton() {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        onClick={() => posthog.capture("feedback_button_clicked")}
        tooltip="Feedback"
      >
        <MessageSquarePlus className="size-4" />
        <span>Feedback</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
```

Remove all now-unused imports (Popover, popover-related, bug/feature form imports, dialog stack, etc.).

**Step 2: Typecheck**

```bash
bun run typecheck
```

**Step 3: Commit**

```bash
git add apps/web/src/layout/dashboard/ui/app-sidebar.tsx
git commit -m "feat: replace sidebar feedback popover with posthog capture"
```

---

### Task 6: Update early-access-banner to use PostHog survey capture

**Files:**
- Modify: `apps/web/src/features/billing/ui/early-access-banner.tsx`

**Step 1: Remove custom form integrations**

Open `early-access-banner.tsx`. Remove:
- Imports for `FeatureFeedbackForm`, `FeatureRequestForm`
- Any `useSheet`/`useCredenza` calls that opened those forms

**Step 2: Replace CTAs with posthog.capture calls**

For "give feedback" and "request feature" CTAs, replace `onClick` handlers:

```typescript
import posthog from "posthog-js";

// For feature feedback CTA:
onClick={() =>
  posthog.capture("early_access_feature_feedback", { feature: featureName })
}

// For feature request CTA:
onClick={() =>
  posthog.capture("early_access_feature_request", { feature: featureName })
}
```

PostHog surveys targeting these events will appear automatically based on dashboard config.

**Step 3: Typecheck**

```bash
bun run typecheck
```

**Step 4: Commit**

```bash
git add apps/web/src/features/billing/ui/early-access-banner.tsx
git commit -m "feat: replace early-access feedback forms with posthog capture"
```

---

### Task 7: Fix sidebar stage badge — PostHog as single source of truth

**Problem:** `STATIC_FEATURES` in `use-early-access.tsx` hardcodes `stage` values. The sidebar's `FeatureStageBadge` calls `getFeatureStage(flagKey)` which merges static + PostHog data. If PostHog doesn't return a feature, the static stage is used — but stage should be owned exclusively by PostHog.

**Fix:** Remove hardcoded `stage` from `STATIC_FEATURES`. Keep static features only for `flagKey`, `name`, and `description` (fallback text). Stage always comes from PostHog's `getEarlyAccessFeatures()` response. If PostHog hasn't returned yet (loading), stage is `null` — badge renders nothing.

**Files:**
- Modify: `apps/web/src/hooks/use-early-access.tsx`

**Step 1: Remove `stage` from STATIC_FEATURES**

Open `use-early-access.tsx`. Update `STATIC_FEATURES` to remove `stage` from each entry:

```typescript
const STATIC_FEATURES: Omit<EarlyAccessFeature, "stage">[] = [
  { flagKey: "contacts", name: "Contatos", description: "...", documentationUrl: null },
  { flagKey: "inventory", name: "Produtos (Estoque)", description: "...", documentationUrl: null },
  { flagKey: "services", name: "Gestão de Serviços", description: "...", documentationUrl: null },
  { flagKey: "advanced-analytics", name: "Análises Avançadas", description: "...", documentationUrl: null },
  { flagKey: "data-management", name: "Dados", description: "...", documentationUrl: null },
];
```

Keep the original description strings intact, just remove the `stage` field from each.

**Step 2: Update merge logic to always prefer PostHog stage**

In the `features` useMemo, update the merge so:
- Base = static feature (name, description, flagKey, documentationUrl)
- PostHog feature overrides everything it has (including stage, name, description)
- `stage` is `null` if PostHog hasn't returned it yet

```typescript
const features = useMemo<EarlyAccessFeature[]>(() => {
  const posthogByKey = new Map(
    posthogFeatures.filter((f) => f.flagKey).map((f) => [f.flagKey, f]),
  );

  const merged = STATIC_FEATURES.map((f) => {
    const fromPosthog = f.flagKey ? posthogByKey.get(f.flagKey) : undefined;
    return {
      ...f,
      stage: fromPosthog?.stage ?? null,   // null until PostHog responds
      ...(fromPosthog && {
        name: fromPosthog.name,
        description: fromPosthog.description,
        documentationUrl: fromPosthog.documentationUrl,
      }),
    } satisfies EarlyAccessFeature;
  });

  const extra = posthogFeatures.filter(
    (f) => f.flagKey && !STATIC_FLAG_KEYS.has(f.flagKey),
  );

  return [...merged, ...extra];
}, [posthogFeatures]);
```

**Step 3: Verify type — EarlyAccessFeature.stage must allow null**

Check `apps/web/src/integrations/posthog/client.tsx` for `EarlyAccessFeature` type. Ensure `stage: EarlyAccessStage | null` is the declared type. If it currently disallows null, update it:

```typescript
export type EarlyAccessFeature = {
  flagKey: string | null;
  name: string;
  description: string;
  stage: EarlyAccessStage | null;   // null = not yet loaded from PostHog
  documentationUrl: string | null;
};
```

**Step 4: Typecheck**

```bash
bun run typecheck
```
Expected: clean. `FeatureStageBadge` already handles `stage={null}` by not rendering (check `sidebar-nav.tsx` — the badge is conditionally rendered with `stage &&`).

**Step 5: Commit**

```bash
git add apps/web/src/hooks/use-early-access.tsx apps/web/src/integrations/posthog/client.tsx
git commit -m "feat: make sidebar stage badges dynamic from posthog earlyAccessFeatures"
```

---

### Task 8: Delete @packages/feedback package

**Files:**
- Delete: `packages/feedback/` (entire directory)
- Modify: any `package.json` that depends on `@packages/feedback`

**Step 1: Find all dependents**

```bash
grep -r "@packages/feedback" --include="package.json" .
```

Remove `@packages/feedback` from every `package.json` that lists it.

**Step 2: Delete the package**

```bash
rm -rf packages/feedback/
```

**Step 3: Sync lockfile**

```bash
bun install
```

**Step 4: Typecheck**

```bash
bun run typecheck
```
Expected: clean.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: delete @packages/feedback package"
```

---

### Task 9: Final verification

**Step 1: Full typecheck + lint**

```bash
bun run typecheck && bun run check
```
Expected: clean.

**Step 2: Smoke test**

```bash
bun dev
```

- App loads without errors
- Sidebar feedback button fires `feedback_button_clicked` event (check PostHog Live Events)
- Sidebar stage badges show the stage from PostHog (or nothing if not yet loaded)
- No custom feedback dialogs appear anywhere
- PostHog native surveys render when triggered from the dashboard

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: migrate feedback to posthog native surveys, dynamic stage badges"
```
