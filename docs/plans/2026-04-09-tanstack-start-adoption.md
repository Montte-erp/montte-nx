# TanStack Start — Adoção Completa (MON-223) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete TanStack Start adoption: add `head()` to remaining auth/onboarding routes, fix devtools dev-only guard, and update CLAUDE.md with new rules.

**Architecture:** Fase 1 (head() per route) is already done for all 39 dashboard/settings routes. Remaining work: 6 auth/onboarding routes that benefit from dynamic titles, devtools conditional rendering, and CLAUDE.md documentation. Fase 2/3 (window.__env migration, createMiddleware logging) are deferred as long-term work.

**Tech Stack:** TanStack Start (SSR), TanStack Router (file-based), Vite 5 + Nitro (bun preset), React, Brazilian Portuguese (pt-BR)

---

## Current State

- ✅ All 39 dashboard/settings routes already have `head()` with dynamic titles
- ✅ `autoCodeSplitting: true` already configured in `vite.config.ts`
- ✅ `nitro({ preset: "bun" })` correct
- ✅ `tanstackStart()` before `viteReact()` — correct plugin order
- ❌ `TanStackDevtools` rendered unconditionally (no `import.meta.env.DEV` guard) — wastes bundle in production
- ❌ Auth/onboarding pages missing `head()`: sign-in, sign-up, forgot-password, magic-link, email-verification, onboarding
- ❌ CLAUDE.md missing rules: head() required, devtools guard, Start vs Router distinction

## Routes Needing head() (auth/onboarding)

| File | Title |
|------|-------|
| `auth/sign-in/index.tsx` | `Entrar — Montte` |
| `auth/sign-up.tsx` | `Criar conta — Montte` |
| `auth/forgot-password.tsx` | `Esqueci a senha — Montte` |
| `auth/magic-link.tsx` | `Magic Link — Montte` |
| `auth/email-verification.tsx` | `Verificar e-mail — Montte` |
| `_authenticated/onboarding.tsx` | `Configuração inicial — Montte` |

## Routes NOT needing head() (layout/redirect/callback)

- `index.tsx` — redirect only, no UI
- `auth.tsx` — layout route, no UI
- `auth/sign-in.tsx` — layout/redirect route
- `auth/callback.tsx` — callback handler, no UI
- `callback/organization/invitation/$invitationId.tsx` — callback handler, no UI
- `_authenticated.tsx` — layout route
- `_authenticated/$slug.tsx` — redirect/layout, no UI
- `_authenticated/$slug/$teamSlug.tsx` — redirect/layout, no UI

---

## Task 1: Fix devtools — add `import.meta.env.DEV` guard

**File:** `apps/web/src/routes/__root.tsx`

Current (line 87-100):
```tsx
<ClientOnly>
   <TanStackDevtools
      config={{ position: "top-right" }}
      plugins={[...]}
   />
</ClientOnly>
```

**Step 1: Edit the devtools block**

Replace the ClientOnly devtools block at line 87-100 in `apps/web/src/routes/__root.tsx`:

```tsx
{import.meta.env.DEV && (
   <ClientOnly>
      <TanStackDevtools
         config={{
            position: "top-right",
         }}
         plugins={[
            {
               name: "Tanstack Router",
               render: <TanStackRouterDevtoolsPanel />,
            },
            TanStackQueryDevtools,
         ]}
      />
   </ClientOnly>
)}
```

**Step 2: Verify no TypeScript errors**

```bash
bun run typecheck
```

Expected: no new errors.

**Step 3: Commit**

```bash
git add apps/web/src/routes/__root.tsx
git commit -m "fix: guard TanStackDevtools with import.meta.env.DEV"
```

---

## Task 2: Add head() to auth routes

**Files to modify:**
- `apps/web/src/routes/auth/sign-in/index.tsx`
- `apps/web/src/routes/auth/sign-up.tsx`
- `apps/web/src/routes/auth/forgot-password.tsx`
- `apps/web/src/routes/auth/magic-link.tsx`
- `apps/web/src/routes/auth/email-verification.tsx`

For each file, find the `createFileRoute(...)({` call and add `head: () => ({ meta: [{ title: "... — Montte" }] }),` to the route config object.

**Pattern to add (before `component:`):**
```tsx
head: () => ({
   meta: [{ title: "Entrar — Montte" }],
}),
```

**Step 1: Add head() to sign-in index**

In `apps/web/src/routes/auth/sign-in/index.tsx`, find the Route object and add:
```tsx
head: () => ({
   meta: [{ title: "Entrar — Montte" }],
}),
```

**Step 2: Add head() to sign-up**

In `apps/web/src/routes/auth/sign-up.tsx`, find the Route object (line 28) and add:
```tsx
head: () => ({
   meta: [{ title: "Criar conta — Montte" }],
}),
```

**Step 3: Add head() to forgot-password**

In `apps/web/src/routes/auth/forgot-password.tsx`:
```tsx
head: () => ({
   meta: [{ title: "Esqueci a senha — Montte" }],
}),
```

**Step 4: Add head() to magic-link**

In `apps/web/src/routes/auth/magic-link.tsx`:
```tsx
head: () => ({
   meta: [{ title: "Magic Link — Montte" }],
}),
```

**Step 5: Add head() to email-verification**

In `apps/web/src/routes/auth/email-verification.tsx`:
```tsx
head: () => ({
   meta: [{ title: "Verificar e-mail — Montte" }],
}),
```

**Step 6: Verify**

```bash
bun run typecheck
```

**Step 7: Commit**

```bash
git add apps/web/src/routes/auth/sign-in/index.tsx \
        apps/web/src/routes/auth/sign-up.tsx \
        apps/web/src/routes/auth/forgot-password.tsx \
        apps/web/src/routes/auth/magic-link.tsx \
        apps/web/src/routes/auth/email-verification.tsx
git commit -m "feat: add head() with dynamic titles to auth routes"
```

---

## Task 3: Add head() to onboarding route

**File:** `apps/web/src/routes/_authenticated/onboarding.tsx`

**Step 1: Read the file to understand current Route structure**

Read `apps/web/src/routes/_authenticated/onboarding.tsx` to find where to insert.

**Step 2: Add head()**

```tsx
head: () => ({
   meta: [{ title: "Configuração inicial — Montte" }],
}),
```

**Step 3: Typecheck and commit**

```bash
bun run typecheck
git add apps/web/src/routes/_authenticated/onboarding.tsx
git commit -m "feat: add head() with dynamic title to onboarding route"
```

---

## Task 4: Update CLAUDE.md

**File:** `/home/yorizel/Documents/montte-nx/CLAUDE.md`

**Step 1: Update Routes section**

In the Routes section, add to "Required patterns for every route":
- `head()` required — format: `"Page Name — Montte"` in Brazilian Portuguese
- Devtools: always wrap in `{import.meta.env.DEV && <ClientOnly>...</ClientOnly>}` — never render in production

The route section already has `head()` listed. Verify the devtools rule is captured somewhere.

**Step 2: Add TanStack Start section (if missing)**

The CLAUDE.md routes section header says `## Routes (TanStack Router — file-based)`. The app uses TanStack Start. Update the heading or add a note:

Under the routes section add a note that the app uses **TanStack Start** (not just Router): SSR is active, `shellComponent`, `HeadContent`, `Scripts`, `ClientOnly`, `head()` are all Start APIs.

Also document:
- Plugin order in `vite.config.ts`: `tanstackStart()` MUST come before `viteReact()`
- Deploy target via `nitro({ preset })` in `vite.config.ts` (not `app.config.ts` — vinxi is gone)

**Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with TanStack Start rules and head() requirement"
```

---

## Deferred (Fase 2/3 — not in this plan)

- **window.__env migration** — replace `dangerouslySetInnerHTML` env injection with loader data + `useLoaderData`. Complex, low urgency.
- **createMiddleware** — add Start middleware for HTTP-level logging/CSP. Low urgency, no blocking issues.
- **createServerFn** — only needed for HTTP-pure operations (cookie reads, header inspection outside oRPC). No current use case identified.
