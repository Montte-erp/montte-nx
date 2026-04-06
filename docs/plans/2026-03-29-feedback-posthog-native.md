# Feedback → PostHog Native Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove custom feedback UI wrappers and `@packages/feedback`. Use PostHog native surveys directly via `posthog.renderSurvey(id)`. Keep the early-access banner but drive its CTA from a typed `POSTHOG_SURVEYS` config. Make sidebar stage badges dynamically driven by PostHog `earlyAccessFeatures` — no hardcoded stages.

**Architecture:**

- `core/posthog` owns three config files: `surveys.ts` (survey ID map), `feature-flags.ts` (flag key const + type). Both server and client import from there.
- `EarlyAccessBannerTemplate` gets a `surveyId` field instead of `form`. Clicking the CTA calls `posthog.renderSurvey(surveyId)` directly — no wrapper helper.
- Feature flag hooks (`useFeatureFlagEnabled`, `useFeatureFlagVariantKey`, etc.) are imported directly from `posthog-js/react` at the call site — never re-exported via `client.tsx`.
- Stage badges read stage exclusively from `posthog.getEarlyAccessFeatures()` — no hardcoded stages in static feature definitions.
- `@packages/feedback` is deleted entirely.

**Tech Stack:** `posthog-js` (already installed via `catalog:analytics-client`), PostHog dashboard for survey & feature flag config.

---

### Task 0: Slim down client.tsx — delete unnecessary wrappers and the router tracker

`client.tsx` currently has: a router pageview tracker, thin wrappers (`identifyClient`, `setClientGroup`, `captureClientEvent`) over `posthog.identify/group/capture`, and a `usePostHog` re-export. None of these belong — PostHog React provider handles pageviews, and thin wrappers over a public API add no value. When code needs PostHog, it uses `posthog-js` or `posthog-js/react` directly.

**Files:**

- Modify: `apps/web/src/integrations/posthog/client.tsx`
- Modify: `apps/web/src/routes/__root.tsx` (remove `PosthogRouterTracker`)
- Modify: `apps/web/src/layout/dashboard/ui/dashboard-layout.tsx` (replace helper calls with a colocated hook)
- Create: `apps/web/src/layout/dashboard/-dashboard/use-posthog-identity.ts`

**Step 1: Delete from client.tsx**

Remove entirely:

- `identifyClient` function
- `setClientGroup` function
- `captureClientEvent` function
- `usePosthogRouterTracking` function
- `PosthogRouterTracker` component
- `RouterLocation` type
- `export { usePostHog }` re-export
- The `useState` and `useEffect` imports (if now unused)

Keep:

- `PostHogWrapper` provider component
- `EarlyAccessFeature`, `EarlyAccessStage`, `normalizeEarlyAccessStage` types (still consumed by `use-early-access.tsx`)

Also replace the entire `PostHogWrapper` config with the best possible tracking setup. Remove `hasConsent` prop — consent is handled via PostHog's own localStorage-persisted opt-out APIs (see Task 1 — Telemetry):

```typescript
function getReactPosthogConfig(env: PosthogEnv) {
  return {
    api_host: env.VITE_POSTHOG_HOST,
    api_key: env.VITE_POSTHOG_KEY,
    // Autocapture & pageviews
    autocapture: true,
    capture_pageview: true,        // PostHog handles SPA navigation automatically
    capture_pageleave: true,
    // Performance & exceptions
    capture_performance: true,
    enable_exception_autocapture: true,
    // Session recording — production only
    disable_session_recording: !isClientProduction,
    // Feature flags — faster timeout, don't block rendering
    feature_flag_request_timeout_ms: 3000,
    // Surveys — must be enabled for renderSurvey() to work
    opt_in_site_apps: true,
    // Persistence
    persistence: "localStorage" as const,
  };
}

export function PostHogWrapper({
  children,
  env,
}: {
  children: React.ReactNode;
  env: PosthogEnv;
}) {
  return (
    <PostHogProvider
      apiKey={env.VITE_POSTHOG_KEY}
      options={getReactPosthogConfig(env)}
    >
      {children}
    </PostHogProvider>
  );
}
```

Remove the `hasConsent` prop from `PostHogWrapper` entirely — it was `opt_out_capturing_by_default: !hasConsent`. PostHog's localStorage-persisted opt-out takes over (set up in Telemetry task).

**Step 2: Remove PosthogRouterTracker from \_\_root.tsx**

Open `apps/web/src/routes/__root.tsx`. Remove:

- The `PosthogRouterTracker` import from `@/integrations/posthog/client`
- The `<PosthogRouterTracker location={...} />` JSX element

**Step 3: Create colocated usePostHogIdentity hook**

The current `dashboard-layout.tsx` calls `identifyClient` and `setClientGroup` in a `useEffect`. Replace with a colocated hook that does the same thing using `usePostHog()` from `posthog-js/react` and `useStableHandler` from foxact.

```typescript
// apps/web/src/layout/dashboard/-dashboard/use-posthog-identity.ts
import { useStableHandler } from "foxact/use-stable-handler-only-when-you-know-what-you-are-doing-or-you-will-be-fired";
import { usePostHog } from "posthog-js/react";
import { useEffect } from "react";

type IdentityProps = {
   userId: string | undefined;
   email: string | undefined;
   name: string | undefined;
   organizationId: string | undefined;
   organizationName: string | undefined;
   organizationSlug: string | undefined;
};

export function usePostHogIdentity({
   userId,
   email,
   name,
   organizationId,
   organizationName,
   organizationSlug,
}: IdentityProps) {
   const posthog = usePostHog();

   const identify = useStableHandler(() => {
      if (!userId) return;
      posthog.identify(userId, { email, name });
      if (organizationId) {
         posthog.group("organization", organizationId, {
            name: organizationName,
            slug: organizationSlug,
         });
      }
   });

   useEffect(() => {
      identify();
   }, [userId, organizationId, identify]);
}
```

**Step 4: Use the hook in dashboard-layout.tsx**

Open `dashboard-layout.tsx`. Replace the `useEffect` that calls `identifyClient` / `setClientGroup` with:

```typescript
import { usePostHogIdentity } from "./-dashboard/use-posthog-identity";

usePostHogIdentity({
   userId: session?.user?.id,
   email: session?.user?.email,
   name: session?.user?.name,
   organizationId: activeOrganization?.id,
   organizationName: activeOrganization?.name,
   organizationSlug: activeOrganization?.slug,
});
```

Remove the `identifyClient` and `setClientGroup` imports.

**Step 5: Typecheck**

```bash
bun run typecheck
```

**Step 6: Commit**

```bash
git add apps/web/src/integrations/posthog/client.tsx \
  apps/web/src/routes/__root.tsx \
  apps/web/src/layout/dashboard/ui/dashboard-layout.tsx \
  apps/web/src/layout/dashboard/-dashboard/use-posthog-identity.ts
git commit -m "feat: slim down posthog client.tsx, replace wrappers with direct usage"
```

---

### Task 1: Replace DB-backed telemetry consent with PostHog native opt-out

**Context:** `telemetryConsent` is stored as a Better Auth `additionalFields` on the `user` table and passed to `PostHogWrapper` as `hasConsent`. The goal is to delete that DB field entirely and use PostHog's own `posthog.opt_out_capturing()` / `posthog.opt_in_capturing()` / `posthog.has_opted_out_capturing()` APIs, which persist to localStorage automatically.

**Files:**

- Modify: `core/authentication/src/server.ts` — remove `telemetryConsent` from `additionalFields`
- Modify: `apps/web/src/routes/__root.tsx` — remove `hasConsent` prop from `PostHogWrapper` call sites
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/settings/customization.tsx` — replace DB mutation with PostHog hook calls

**Step 1: Find all PostHogWrapper + hasConsent usages**

```bash
grep -rn "PostHogWrapper\|hasConsent\|telemetryConsent" apps/web/src/ core/
```

**Step 2: Remove telemetryConsent from Better Auth additionalFields**

In `core/authentication/src/server.ts`, delete:

```typescript
telemetryConsent: {
  defaultValue: false,
  input: true,
  required: true,
  type: "boolean",
},
```

**Step 3: Remove hasConsent prop from all PostHogWrapper call sites**

From the grep in Step 1, remove `hasConsent={...}` from every `<PostHogWrapper>` usage. The component no longer accepts it (already removed in Task 0).

**Step 4: Update customization.tsx to use PostHog directly**

Replace the `updateConsentMutation` + `session` query with `usePostHog()` from `posthog-js/react`. Use `useIsomorphicLayoutEffect` to read the opt-out state on mount (browser API — not safe in SSR without it), and `useStableHandler` for the toggle callback:

```typescript
import { useIsomorphicLayoutEffect } from "foxact/use-isomorphic-layout-effect";
import { useStableHandler } from "foxact/use-stable-handler-only-when-you-know-what-you-are-doing-or-you-will-be-fired";
import { usePostHog } from "posthog-js/react";

function PreferencesSectionContent() {
   const posthog = usePostHog();
   const [hasConsent, setHasConsent] = useState(true);

   useIsomorphicLayoutEffect(() => {
      setHasConsent(!posthog.has_opted_out_capturing());
   }, [posthog]);

   const handleConsentChange = useStableHandler((checked: boolean) => {
      if (checked) {
         posthog.opt_in_capturing();
      } else {
         posthog.opt_out_capturing();
      }
      setHasConsent(checked);
   });

   // ...rest of component unchanged, use hasConsent + handleConsentChange
}
```

Remove: `useSuspenseQuery(orpc.session.getSession...)`, `useMutation(...)`, `authClient` import if only used for consent.

**Step 5: Typecheck**

```bash
bun run typecheck
```

**Step 6: Commit**

```bash
git add core/authentication/src/server.ts \
  apps/web/src/routes/__root.tsx \
  apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/settings/customization.tsx
git commit -m "feat: replace DB-backed telemetry consent with PostHog native opt-out"
```

---

### Task 2: Create PostHog surveys config in core/posthog

This is the single source of truth for survey IDs and their feature flag association. It lives in `core/posthog` (no runtime dependency — pure typed data) and is consumed by the web app via `@core/posthog/surveys`.

**Files:**

- Create: `core/posthog/src/surveys.ts`
- Modify: `core/posthog/package.json` (add `./surveys` export)

**Step 1: Create the surveys config**

```typescript
// core/posthog/src/surveys.ts

export type PostHogSurveyEntry = {
   id: string;
   flagKey: string | null;
};

export const POSTHOG_SURVEYS = {
   bugReport: {
      id: "019c6be5-4893-0000-7270-57dc03529638",
      flagKey: null,
   },
   featureRequest: {
      id: "019c6be5-5783-0000-684e-aceb5002b650",
      flagKey: null,
   },
   featureFeedback: {
      id: "019c6be5-6296-0000-b0a3-2ab421e77719",
      flagKey: null,
   },
} as const satisfies Record<string, PostHogSurveyEntry>;

export type PostHogSurveyKey = keyof typeof POSTHOG_SURVEYS;
```

> **Note for executor:** The IDs above come from the old `packages/feedback/src/adapters/posthog.ts`.
> Before running, verify they match the actual surveys in the PostHog dashboard under the `montte-erp` project.
> If PostHog MCP is available, call it with `POSTHOG_PROJECT_ID` from `core/environment/src/web.ts` to list surveys and confirm IDs.
> If surveys are linked to specific feature flags in PostHog, update `flagKey` accordingly (e.g. `flagKey: "advanced-analytics"`).

**Step 2: Add ./surveys export to core/posthog/package.json**

Open `core/posthog/package.json`. Add to the `exports` object:

```json
"./surveys": {
  "types": "./dist/surveys.d.ts",
  "default": "./dist/surveys.js"
}
```

**Step 3: Typecheck**

```bash
bun run typecheck
```

**Step 4: Commit**

```bash
git add core/posthog/src/surveys.ts core/posthog/package.json
git commit -m "feat: add posthog surveys config to core/posthog"
```

---

### Task 2: Update EarlyAccessBanner to use PostHog native surveys

**Files:**

- Modify: `apps/web/src/features/billing/ui/early-access-banner.tsx`

**Step 1: Replace form-based CTA with PostHog survey trigger**

Current `EarlyAccessBannerTemplate` has `form?: "feedback" | "request"`.
Replace that with `surveyId?: string`.

New `early-access-banner.tsx`:

```typescript
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import {
  type FeatureStage,
  STAGE_CONFIG,
} from "@packages/ui/components/feature-stage-badge";
import { cn } from "@packages/ui/lib/utils";
import type { LucideIcon } from "lucide-react";
import { FlaskConical } from "lucide-react";
import posthog from "posthog-js";

const STAGE_ICON_COLOR: Record<FeatureStage, string> = {
  alpha: "text-chart-1",
  beta: "text-chart-2",
  concept: "text-chart-3",
  "general-availability": "text-chart-4",
};

export type EarlyAccessBannerTemplate = {
  badgeLabel: string;
  message: string;
  ctaLabel: string;
  bullets: string[];
  stage: FeatureStage;
  icon?: LucideIcon;
  surveyId?: string;
};

export type EarlyAccessBannerProps = {
  template: EarlyAccessBannerTemplate;
};

export function EarlyAccessBanner({ template }: EarlyAccessBannerProps) {
  const Icon = template.icon ?? FlaskConical;
  const stage = template.stage ?? "beta";
  const iconColor = STAGE_ICON_COLOR[stage];
  const badgeClassName = STAGE_CONFIG[stage].className;

  return (
    <div className="rounded-lg border bg-card p-4 flex gap-4">
      <div className="shrink-0 pt-0.5">
        <Icon className={cn("size-5", iconColor)} />
      </div>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Badge className={badgeClassName} variant="outline">
            {template.badgeLabel}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {template.message}{" "}
          {template.surveyId && (
            <Button
              className="h-auto p-0 text-foreground underline underline-offset-4 hover:text-primary"
              onClick={() => posthog.renderSurvey(template.surveyId!)}
              type="button"
              variant="link"
            >
              {template.ctaLabel}
            </Button>
          )}
        </p>
        <ul className="space-y-1.5 text-sm text-muted-foreground list-disc list-inside">
          {template.bullets.map((bullet, index) => (
            <li key={`early-access-bullet-${index + 1}`}>{bullet}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

**Step 2: Find all usages of EarlyAccessBannerTemplate that pass `form:`**

```bash
grep -r "form:" --include="*.tsx" apps/web/src
```

For each usage, replace `form: "feedback"` with `surveyId: POSTHOG_SURVEYS.featureFeedback.id`
and `form: "request"` with `surveyId: POSTHOG_SURVEYS.featureRequest.id`.

Import:

```typescript
import { POSTHOG_SURVEYS } from "@core/posthog/surveys";
```

**Step 3: Typecheck**

```bash
bun run typecheck
```

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: update EarlyAccessBanner to use posthog renderSurvey"
```

---

### Task 4: Remove oRPC feedback router + root router entry

**Files:**

- Delete: `apps/web/src/integrations/orpc/router/feedback.ts`
- Modify: `apps/web/src/integrations/orpc/router/index.ts`

**Step 1: Remove feedback entry from root router**

Open `apps/web/src/integrations/orpc/router/index.ts`. Delete:

```typescript
import * as feedback from "./feedback";
// and the router entry:
feedback: { ...feedback },
```

**Step 2: Delete the router file**

```bash
rm apps/web/src/integrations/orpc/router/feedback.ts
```

**Step 3: Typecheck**

```bash
bun run typecheck
```

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: remove oRPC feedback router"
```

---

### Task 5: Remove feedbackSender singleton

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

### Task 6: Delete all custom feedback UI components

**Files:**

- Delete: `apps/web/src/features/feedback/` (entire directory)

**Step 1: Delete directory**

```bash
rm -rf apps/web/src/features/feedback/
```

**Step 2: Typecheck to confirm no remaining imports**

```bash
bun run typecheck
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: delete custom feedback UI components"
```

---

### Task 7: Remove AutoBugReporter from dashboard layout

**Files:**

- Modify: `apps/web/src/layout/dashboard/ui/dashboard-layout.tsx`

**Step 1: Remove AutoBugReporter**

Open `dashboard-layout.tsx`. Delete:

- Any import from `@/features/feedback`
- The `<AutoBugReporter />` JSX element and surrounding logic

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

### Task 8: Replace sidebar feedback button with PostHog survey trigger

**Files:**

- Modify: `apps/web/src/layout/dashboard/ui/app-sidebar.tsx`

**Step 1: Replace SidebarFeedbackButton with direct posthog capture**

Import:

```typescript
import posthog from "posthog-js";
```

Replace the entire `SidebarFeedbackButton` body — remove the popover and all form-open logic:

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

Remove all popover, dialog, form imports that are no longer used.

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

### Task 9: Fix sidebar stage badge — PostHog as single source of truth

**Problem:** `STATIC_FEATURES` in `use-early-access.tsx` hardcodes `stage` for each feature. The sidebar's `FeatureStageBadge` calls `getFeatureStage(flagKey)` which falls back to the static stage if PostHog hasn't returned anything. Stage should be owned exclusively by PostHog — if it's not in PostHog, badge shows nothing.

**Files:**

- Modify: `apps/web/src/hooks/use-early-access.tsx`
- Possibly modify: `apps/web/src/integrations/posthog/client.tsx` (if `EarlyAccessFeature.stage` doesn't allow `null`)

**Step 1: Remove `stage` from STATIC_FEATURES**

Open `use-early-access.tsx`. Update `STATIC_FEATURES` — remove the `stage` field from every entry. Keep only `flagKey`, `name`, `description`, `documentationUrl`:

```typescript
const STATIC_FEATURES = [
   {
      flagKey: "contacts",
      name: "Contatos",
      description:
         "Cadastro de clientes e fornecedores, vinculação com transações e cobranças.",
      documentationUrl: null,
   },
   {
      flagKey: "inventory",
      name: "Produtos (Estoque)",
      description:
         "Cadastre e gerencie o catálogo de produtos da sua empresa — controle de estoque, preços, variantes e categorias.",
      documentationUrl: null,
   },
   {
      flagKey: "services",
      name: "Gestão de Serviços",
      description:
         "Gestão completa de serviços: planos, assinaturas, descontos negociados e faturamento recorrente.",
      documentationUrl: null,
   },
   {
      flagKey: "advanced-analytics",
      name: "Análises Avançadas",
      description:
         "Acesse dados avançados, dashboards personalizados e insights inteligentes em um só lugar.",
      documentationUrl: null,
   },
   {
      flagKey: "data-management",
      name: "Dados",
      description:
         "Pipeline de dados para captura de eventos externos via webhooks e SDKs.",
      documentationUrl: null,
   },
];
```

**Step 2: Update features merge — stage always from PostHog**

Replace the `features` useMemo:

```typescript
const features = useMemo<EarlyAccessFeature[]>(() => {
   const posthogByKey = new Map(
      posthogFeatures.filter((f) => f.flagKey).map((f) => [f.flagKey, f]),
   );

   const merged = STATIC_FEATURES.map((f) => {
      const fromPosthog = posthogByKey.get(f.flagKey);
      return {
         flagKey: f.flagKey,
         name: fromPosthog?.name ?? f.name,
         description: fromPosthog?.description ?? f.description,
         documentationUrl: fromPosthog?.documentationUrl ?? f.documentationUrl,
         stage: fromPosthog?.stage ?? null,
      } satisfies EarlyAccessFeature;
   });

   const extra = posthogFeatures.filter(
      (f) => f.flagKey && !STATIC_FLAG_KEYS.has(f.flagKey),
   );

   return [...merged, ...extra];
}, [posthogFeatures]);
```

**Step 3: Check EarlyAccessFeature type**

Open `apps/web/src/integrations/posthog/client.tsx`. Find `EarlyAccessFeature` type. Ensure `stage` allows `null`:

```typescript
export type EarlyAccessFeature = {
   flagKey: string | null;
   name: string;
   description: string;
   stage: EarlyAccessStage | null;
   documentationUrl: string | null;
};
```

If it doesn't already allow `null`, update it.

**Step 4: Typecheck**

```bash
bun run typecheck
```

The sidebar renders `{stage && <FeatureStageBadge stage={stage} />}` — so `null` stage means no badge, which is the desired behavior.

**Step 5: Commit**

```bash
git add apps/web/src/hooks/use-early-access.tsx apps/web/src/integrations/posthog/client.tsx
git commit -m "feat: dynamic sidebar stage badges from posthog earlyAccessFeatures"
```

---

### Task 10: Add feature flag keys const to core/posthog

Move the hardcoded `FLAG_KEYS` set out of the early-access router into `core/posthog` so both server and client share the same source of truth for which flags exist.

**Files:**

- Create: `core/posthog/src/feature-flags.ts`
- Modify: `core/posthog/package.json` (add `./feature-flags` export)
- Modify: `apps/web/src/integrations/orpc/router/early-access.ts` (consume from `@core/posthog/feature-flags`)
- Modify: `apps/web/src/hooks/use-early-access.tsx` (consume from `@core/posthog/feature-flags`)

**Step 1: Create feature-flags.ts in core/posthog**

```typescript
// core/posthog/src/feature-flags.ts

export const FEATURE_FLAG_KEYS = [
   "contacts",
   "inventory",
   "services",
   "advanced-analytics",
   "data-management",
] as const;

export type FeatureFlagKey = (typeof FEATURE_FLAG_KEYS)[number];
```

**Step 2: Add ./feature-flags export to core/posthog/package.json**

```json
"./feature-flags": {
  "types": "./dist/feature-flags.d.ts",
  "default": "./dist/feature-flags.js"
}
```

**Step 3: Update early-access router**

Open `apps/web/src/integrations/orpc/router/early-access.ts`. Replace the local `FLAG_KEYS` set with the shared const:

```typescript
import { FEATURE_FLAG_KEYS } from "@core/posthog/feature-flags";

// Replace: const FLAG_KEYS = new Set([...])
// With:
const FLAG_KEYS = new Set(FEATURE_FLAG_KEYS);
```

**Step 4: Update use-early-access.tsx STATIC_FEATURES flagKeys**

The `flagKey` strings in `STATIC_FEATURES` should match `FeatureFlagKey`. Update the type:

```typescript
import type { FeatureFlagKey } from "@core/posthog/feature-flags";

// Update STATIC_FEATURES type so flagKey is FeatureFlagKey (not arbitrary string)
const STATIC_FEATURES: Array<{
  flagKey: FeatureFlagKey;
  name: string;
  description: string;
  documentationUrl: string | null;
}> = [ ... ];
```

This gives a compile error if a feature is added to the sidebar but forgotten in `FEATURE_FLAG_KEYS`.

**Step 5: Typecheck**

```bash
bun run typecheck
```

**Step 6: Commit**

```bash
git add core/posthog/src/feature-flags.ts core/posthog/package.json \
  apps/web/src/integrations/orpc/router/early-access.ts \
  apps/web/src/hooks/use-early-access.tsx
git commit -m "feat: add FEATURE_FLAG_KEYS to core/posthog, use in router and hooks"
```

---

### Task 12: Delete @packages/feedback package

**Files:**

- Delete: `packages/feedback/` (entire directory)
- Modify: any `package.json` that depends on `@packages/feedback`

**Step 1: Find all package.json dependents**

```bash
grep -r "@packages/feedback" --include="package.json" .
```

Remove `@packages/feedback` from every `package.json` found.

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

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: delete @packages/feedback package"
```

---

### Task 13: Final verification

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
- Sidebar feedback button fires `feedback_button_clicked` (check PostHog Live Events tab)
- Sidebar stage badges show stage for enrolled features, nothing for unenrolled (PostHog is source of truth)
- Early-access banners still render; clicking CTA calls `posthog.renderSurvey(id)` and PostHog native survey UI appears
- No custom feedback dialogs appear anywhere

**Step 3: PostHog dashboard config checklist**

Ensure in PostHog (project: `montte-erp`):

- Survey `019c6be5-4893-…` (Bug Report) — set targeting: fires on `feedback_button_clicked` event OR manually triggered
- Survey `019c6be5-5783-…` (Feature Request) — same
- Survey `019c6be5-6296-…` (Feature Feedback) — link to feature flag (e.g. `advanced-analytics`) in survey targeting if desired
- Feature flags `contacts`, `inventory`, `services`, `advanced-analytics`, `data-management` — set `stage` in their Early Access configuration (this is what `getEarlyAccessFeatures()` reads)

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: migrate to posthog native surveys and dynamic stage badges"
```
