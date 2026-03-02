# Settings ERP Restructure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restructure the settings navigation and pages to reflect a SaaS ERP (not a CMS), removing CMS-specific items and adding proper ERP module settings.

**Architecture:** All navigation lives in `settings-nav-items.ts`. New module placeholder pages follow the same shell pattern used in `project/integrations.tsx`. The existing `ai-agents.tsx` route path stays; only its nav label and content focus changes.

**Tech Stack:** React, TanStack Router (file-based), Lucide icons, oRPC + TanStack Query

---

## Task 1: Update settings navigation

**Files:**
- Modify: `apps/web/src/layout/dashboard/ui/settings-nav-items.ts`

**Step 1: Replace the full Espaço > Produtos block**

Replace the `project-products` item and all its children with the new `Módulos` structure. Also update icon imports — remove `FileText`, `Images`, `LayoutGrid` (no longer used) and add `DollarSign`, `Package`, `Contact2`.

**New imports block** (replace the existing import list):
```typescript
import type { LucideIcon } from "lucide-react";
import {
   AlertTriangle,
   Box,
   Contact2,
   CreditCard,
   DollarSign,
   FlaskConical,
   Globe,
   Lock,
   Network,
   Package,
   Palette,
   ScrollText,
   Settings2,
   Shield,
   ShieldCheck,
   Sparkles,
   User,
   UserCog,
   Users,
   Webhook,
} from "lucide-react";
```

**New `project-products` item** (replace lines 62–95 in the file):
```typescript
{
   id: "project-modules",
   title: "Módulos",
   href: "/$slug/$teamSlug/settings/project/modules",
   icon: Box,
   children: [
      {
         id: "module-financeiro",
         title: "Financeiro",
         href: "/$slug/$teamSlug/settings/project/products/financeiro",
         icon: DollarSign,
      },
      {
         id: "module-estoque",
         title: "Estoque",
         href: "/$slug/$teamSlug/settings/project/products/estoque",
         icon: Package,
      },
      {
         id: "module-contatos",
         title: "Contatos",
         href: "/$slug/$teamSlug/settings/project/products/contatos",
         icon: Contact2,
      },
      {
         id: "module-assistente-ia",
         title: "Assistente IA",
         href: "/$slug/$teamSlug/settings/project/products/ai-agents",
         icon: Sparkles,
      },
   ],
},
```

**Step 2: Verify in browser (or typecheck)**

```bash
bun run typecheck
```

Expected: no TypeScript errors. The nav now shows Módulos with 4 children.

**Step 3: Commit**

```bash
git add apps/web/src/layout/dashboard/ui/settings-nav-items.ts
git commit -m "feat(settings): restructure nav from CMS Produtos to ERP Módulos"
```

---

## Task 2: Create Financeiro module placeholder page

**Files:**
- Create: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/settings/project/products/financeiro.tsx`

**Step 1: Create the file**

Use the same minimal shell as `project/integrations.tsx`. No real form yet — just a titled placeholder so the route resolves.

```tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/settings/project/products/financeiro",
)({
   component: FinanceiroSettingsPage,
});

function FinanceiroSettingsPage() {
   return (
      <div className="space-y-6">
         <div>
            <h3 className="text-lg font-medium">Financeiro</h3>
            <p className="text-sm text-muted-foreground">
               Configure as preferências do módulo financeiro do seu espaço.
            </p>
         </div>
      </div>
   );
}
```

**Step 2: Typecheck**

```bash
bun run typecheck
```

Expected: passes.

**Step 3: Commit**

```bash
git add apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/settings/project/products/financeiro.tsx
git commit -m "feat(settings): add Financeiro module settings placeholder"
```

---

## Task 3: Create Estoque module placeholder page

**Files:**
- Create: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/settings/project/products/estoque.tsx`

**Step 1: Create the file**

```tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/settings/project/products/estoque",
)({
   component: EstoqueSettingsPage,
});

function EstoqueSettingsPage() {
   return (
      <div className="space-y-6">
         <div>
            <h3 className="text-lg font-medium">Estoque</h3>
            <p className="text-sm text-muted-foreground">
               Configure as preferências do módulo de estoque do seu espaço.
            </p>
         </div>
      </div>
   );
}
```

**Step 2: Typecheck**

```bash
bun run typecheck
```

**Step 3: Commit**

```bash
git add apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/settings/project/products/estoque.tsx
git commit -m "feat(settings): add Estoque module settings placeholder"
```

---

## Task 4: Create Contatos module placeholder page

**Files:**
- Create: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/settings/project/products/contatos.tsx`

**Step 1: Create the file**

```tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/settings/project/products/contatos",
)({
   component: ContatosSettingsPage,
});

function ContatosSettingsPage() {
   return (
      <div className="space-y-6">
         <div>
            <h3 className="text-lg font-medium">Contatos</h3>
            <p className="text-sm text-muted-foreground">
               Configure as preferências do módulo de contatos do seu espaço.
            </p>
         </div>
      </div>
   );
}
```

**Step 2: Typecheck**

```bash
bun run typecheck
```

**Step 3: Commit**

```bash
git add apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/settings/project/products/contatos.tsx
git commit -m "feat(settings): add Contatos module settings placeholder"
```

---

## Task 5: Simplify Assistente IA settings page

The existing `ai-agents.tsx` has three model slots (content, autocomplete, edit) and a web search config tuned for journalism/academic research — all CMS-specific. Replace it with a single model + language config for ERP assistance.

**Files:**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/settings/project/products/ai-agents.tsx`

**Step 1: Read the full file first**, then replace it with a simplified version that keeps only:
- Default language selection (pt-BR / en-US / es)
- Single assistant model selection
- Remove content/autocomplete/edit model split
- Remove web search config section entirely

The page title should read "Assistente IA" and the description should reference ERP assistance (análises financeiras, consultas de estoque, etc.).

Keep the same oRPC mutation/query wiring — just remove the CMS-specific fields from the form. Check what fields `orpc.productSettings` actually saves/reads before removing anything to avoid breaking the API contract.

**Step 2: Typecheck**

```bash
bun run typecheck
```

**Step 3: Commit**

```bash
git add apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/settings/project/products/ai-agents.tsx
git commit -m "feat(settings): simplify Assistente IA settings for ERP context"
```

---

## Task 6: Update settings index redirect

The settings index page redirects desktop users to `project/general`. Verify it still works and doesn't reference any removed routes.

**Files:**
- Read: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/settings/index.tsx`

Check the redirect target is still `project/general` (unchanged). No code change expected — just verification.

**Step 1: Verify**

```bash
bun run typecheck
```

Expected: passes cleanly.

---

## Done

After all tasks:
- Settings nav shows ERP-appropriate structure
- All 4 new module routes resolve without 404
- Assistente IA page is ERP-focused
- No TypeScript errors
