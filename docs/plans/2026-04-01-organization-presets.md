# Organization Presets Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Seed EMPRESARIAL preset categories, module config, and label config at org creation, then expose config via oRPC and use it to drive nav visibility.

**Architecture:** Since Montte is EMPRESARIAL-only (CNPJ required, `useAccountType` always returns `business`), we skip the PESSOAL preset entirely. We create two per-team config tables (`organizacao_modulo`, `organizacao_rotulo_config`), seed them at onboarding, expose via oRPC, and wire module toggles into the nav.

**Tech Stack:** Drizzle ORM + PostgreSQL, oRPC, TanStack Query, React

---

### Task 1: Create organization-config schema

**Files:**
- Create: `core/database/src/schemas/organization-config.ts`
- Modify: `core/database/src/schema.ts`

**Step 1: Create the schema file**

```typescript
// core/database/src/schemas/organization-config.ts
import { sql } from "drizzle-orm";
import {
   boolean,
   index,
   pgEnum,
   pgTable,
   text,
   timestamp,
   uniqueIndex,
   uuid,
} from "drizzle-orm/pg-core";

export const moduloEnum = pgEnum("modulo", [
   "CONTAS",
   "CARTOES",
   "PLANEJAMENTO",
   "RELATORIOS",
   "CONTATOS",
   "ESTOQUE",
   "SERVICOS",
]);

export const tipoRotuloEnum = pgEnum("tipo_rotulo", ["TAG", "CENTRO_CUSTO"]);

export const organizacaoModulo = pgTable(
   "organizacao_modulo",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      teamId: uuid("team_id").notNull(),
      modulo: moduloEnum("modulo").notNull(),
      habilitado: boolean("habilitado").notNull().default(true),
      createdAt: timestamp("created_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
         .notNull()
         .defaultNow()
         .$onUpdate(() => new Date()),
   },
   (table) => [
      index("organizacao_modulo_team_id_idx").on(table.teamId),
      uniqueIndex("organizacao_modulo_team_modulo_unique").on(
         table.teamId,
         table.modulo,
      ),
   ],
);

export const organizacaoRotuloConfig = pgTable(
   "organizacao_rotulo_config",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      teamId: uuid("team_id").notNull(),
      tipoRotulo: tipoRotuloEnum("tipo_rotulo").notNull(),
      labelUi: text("label_ui").notNull(),
      labelUiPlural: text("label_ui_plural").notNull(),
      createdAt: timestamp("created_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
         .notNull()
         .defaultNow()
         .$onUpdate(() => new Date()),
   },
   (table) => [
      index("organizacao_rotulo_config_team_id_idx").on(table.teamId),
      uniqueIndex("organizacao_rotulo_config_team_rotulo_unique").on(
         table.teamId,
         table.tipoRotulo,
      ),
   ],
);

export type OrganizacaoModulo = typeof organizacaoModulo.$inferSelect;
export type Modulo = (typeof moduloEnum.enumValues)[number];
export type TipoRotulo = (typeof tipoRotuloEnum.enumValues)[number];
```

**Step 2: Export from schema.ts**

In `core/database/src/schema.ts`, add after the last export line:
```typescript
export * from "@core/database/schemas/organization-config";
```

**Step 3: Push schema to DB**

```bash
bun run db:push
```
Expected: Two new tables created, two new enums created.

**Step 4: Commit**

```bash
git add core/database/src/schemas/organization-config.ts core/database/src/schema.ts
git commit -m "feat(database): add organizacao_modulo and organizacao_rotulo_config schemas"
```

---

### Task 2: Replace DEFAULT_CATEGORIES with EMPRESARIAL preset seeder

**Files:**
- Modify: `core/database/src/repositories/categories-repository.ts`

**Step 1: Replace DEFAULT_CATEGORIES and add seedEmpresarialCategories**

Remove the `DEFAULT_CATEGORIES` constant and `seedDefaultCategories` function. Add a new `seedEmpresarialCategories` function that creates a full hierarchical tree.

The tree structure (use Portuguese names, `level` is auto-derived from presence of parentId):

**Income (receita):**
- Vendas
  - Produtos
  - Serviços
- Outras receitas

**Expense (despesa):**
- Custos
  - CMV (Custo da Mercadoria Vendida)
  - Serviços de Terceiros
- Despesas Operacionais
  - Administrativo
  - Comercial
  - Marketing
- Pessoal
- Impostos
- Tarifas Bancárias
- Tecnologia
- Transferências

```typescript
type CategorySeed = {
   name: string;
   type: "income" | "expense";
   children?: Omit<CategorySeed, "type">[];
};

const EMPRESARIAL_CATEGORIES: CategorySeed[] = [
   {
      name: "Vendas",
      type: "income",
      children: [{ name: "Produtos" }, { name: "Serviços" }],
   },
   { name: "Outras Receitas", type: "income" },
   {
      name: "Custos",
      type: "expense",
      children: [
         { name: "CMV" },
         { name: "Serviços de Terceiros" },
      ],
   },
   {
      name: "Despesas Operacionais",
      type: "expense",
      children: [
         { name: "Administrativo" },
         { name: "Comercial" },
         { name: "Marketing" },
      ],
   },
   { name: "Pessoal", type: "expense" },
   { name: "Impostos", type: "expense" },
   { name: "Tarifas Bancárias", type: "expense" },
   { name: "Tecnologia", type: "expense" },
   { name: "Transferências", type: "expense" },
];

export async function seedEmpresarialCategories(
   db: DatabaseInstance,
   teamId: string,
) {
   try {
      for (const root of EMPRESARIAL_CATEGORIES) {
         const [parent] = await db
            .insert(categories)
            .values({
               teamId,
               name: root.name,
               type: root.type,
               level: 1,
               isDefault: true,
            })
            .returning();
         if (!parent) throw AppError.database("Failed to seed category");

         if (root.children?.length) {
            await db.insert(categories).values(
               root.children.map((child) => ({
                  teamId,
                  name: child.name,
                  type: root.type,
                  parentId: parent.id,
                  level: 2,
                  isDefault: true,
               })),
            );
         }
      }
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to seed empresarial categories");
   }
}
```

**Step 2: Update all callers of seedDefaultCategories**

Search for any usages of `seedDefaultCategories`:
```bash
grep -r "seedDefaultCategories" /home/yorizel/Documents/montte-nx --include="*.ts" --include="*.tsx"
```
Replace each call with `seedEmpresarialCategories`.

**Step 3: Commit**

```bash
git add core/database/src/repositories/categories-repository.ts
git commit -m "feat(database): replace DEFAULT_CATEGORIES with EMPRESARIAL preset seeder"
```

---

### Task 3: Create organization-config repository

**Files:**
- Create: `core/database/src/repositories/organization-config-repository.ts`

```typescript
import { AppError, propagateError } from "@core/logging/errors";
import { eq } from "drizzle-orm";
import type { DatabaseInstance } from "@core/database/client";
import {
   type Modulo,
   organizacaoModulo,
   organizacaoRotuloConfig,
} from "@core/database/schemas/organization-config";

const ALL_MODULOS: Modulo[] = [
   "CONTAS",
   "CARTOES",
   "PLANEJAMENTO",
   "RELATORIOS",
   "CONTATOS",
   "ESTOQUE",
   "SERVICOS",
];

export async function seedOrganizacaoConfig(
   db: DatabaseInstance,
   teamId: string,
) {
   try {
      await db.insert(organizacaoModulo).values(
         ALL_MODULOS.map((modulo) => ({
            teamId,
            modulo,
            habilitado: true,
         })),
      );

      await db.insert(organizacaoRotuloConfig).values([
         {
            teamId,
            tipoRotulo: "CENTRO_CUSTO" as const,
            labelUi: "Centro de Custo",
            labelUiPlural: "Centros de Custo",
         },
      ]);
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to seed organizacao config");
   }
}

export async function getOrganizacaoModulos(
   db: DatabaseInstance,
   teamId: string,
) {
   try {
      return await db.query.organizacaoModulo.findMany({
         where: (fields, { eq }) => eq(fields.teamId, teamId),
      });
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get organizacao modulos");
   }
}

export async function updateOrganizacaoModulo(
   db: DatabaseInstance,
   teamId: string,
   modulo: Modulo,
   habilitado: boolean,
) {
   try {
      await db
         .update(organizacaoModulo)
         .set({ habilitado })
         .where(
            eq(organizacaoModulo.teamId, teamId) &&
               eq(organizacaoModulo.modulo, modulo),
         );
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to update organizacao modulo");
   }
}

export async function getOrganizacaoRotuloConfig(
   db: DatabaseInstance,
   teamId: string,
) {
   try {
      return await db.query.organizacaoRotuloConfig.findMany({
         where: (fields, { eq }) => eq(fields.teamId, teamId),
      });
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get organizacao rotulo config");
   }
}
```

**Step 4: Add relations to `core/database/src/relations.ts`**

Check if relations.ts exists, open it, and add:
```typescript
import { relations } from "drizzle-orm";
import { organizacaoModulo, organizacaoRotuloConfig } from "@core/database/schemas/organization-config";
// (add these relations if the file uses drizzle relations)
```

If the file doesn't use explicit relations for this pattern, skip this step.

**Step 5: Commit**

```bash
git add core/database/src/repositories/organization-config-repository.ts
git commit -m "feat(database): add organization-config repository with seed, get, update functions"
```

---

### Task 4: Apply preset at onboarding

**Files:**
- Modify: `apps/web/src/integrations/orpc/router/onboarding.ts`

**Step 1: Import seedOrganizacaoConfig and seedEmpresarialCategories in the onboarding router**

Add to the imports at top of onboarding.ts:
```typescript
import { seedEmpresarialCategories } from "@core/database/repositories/categories-repository";
import { seedOrganizacaoConfig } from "@core/database/repositories/organization-config-repository";
```

**Step 2: Update runOnboardingCompletion to call seeders**

In the `runOnboardingCompletion` function, after `await insertTeamMember(...)`, add:

```typescript
logger.info("Seeding empresarial categories");
await seedEmpresarialCategories(db, teamId);

logger.info("Seeding organizacao config");
await seedOrganizacaoConfig(db, teamId);
```

Make sure to place this BEFORE the existing `createDefaultInsights` call.

**Step 3: Remove old seedDefaultCategories call if it exists anywhere in this file**

Grep the file for `seedDefaultCategories` and remove if found.

**Step 4: Commit**

```bash
git add apps/web/src/integrations/orpc/router/onboarding.ts
git commit -m "feat(onboarding): seed empresarial categories and module config at org creation"
```

---

### Task 5: Create organization-config oRPC router

**Files:**
- Create: `apps/web/src/integrations/orpc/router/organization-config.ts`
- Modify: `apps/web/src/integrations/orpc/router/index.ts`

**Step 1: Create the router file**

```typescript
import {
   getOrganizacaoModulos,
   getOrganizacaoRotuloConfig,
   updateOrganizacaoModulo,
} from "@core/database/repositories/organization-config-repository";
import { moduloEnum } from "@core/database/schemas/organization-config";
import { WebAppError } from "@core/logging/errors";
import { z } from "zod";
import { protectedProcedure } from "../server";

export const getModules = protectedProcedure.handler(async ({ context }) => {
   const { db, teamId } = context;
   return await getOrganizacaoModulos(db, teamId);
});

export const updateModule = protectedProcedure
   .input(
      z.object({
         modulo: z.enum(moduloEnum.enumValues),
         habilitado: z.boolean(),
      }),
   )
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;
      await updateOrganizacaoModulo(db, teamId, input.modulo, input.habilitado);
      return { success: true };
   });

export const getRotuloConfig = protectedProcedure.handler(
   async ({ context }) => {
      const { db, teamId } = context;
      return await getOrganizacaoRotuloConfig(db, teamId);
   },
);
```

**Step 2: Register in router index**

In `apps/web/src/integrations/orpc/router/index.ts`:

Add import:
```typescript
import * as organizationConfigRouter from "./organization-config";
```

Add to the exported object:
```typescript
organizationConfig: organizationConfigRouter,
```

**Step 3: Commit**

```bash
git add apps/web/src/integrations/orpc/router/organization-config.ts apps/web/src/integrations/orpc/router/index.ts
git commit -m "feat(orpc): add organization-config router (getModules, updateModule, getRotuloConfig)"
```

---

### Task 6: Create useOrganizationModules hook and wire into nav

**Files:**
- Create: `apps/web/src/layout/dashboard/hooks/use-organization-modules.ts`
- Modify: `apps/web/src/layout/dashboard/ui/sidebar-nav.tsx`
- Modify: `apps/web/src/layout/dashboard/ui/sidebar-nav-items.ts`

**Step 1: Create the hook**

```typescript
// apps/web/src/layout/dashboard/hooks/use-organization-modules.ts
import { orpc } from "@/integrations/orpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import type { Modulo } from "@core/database/schemas/organization-config";

const MODULE_TO_NAV_IDS: Partial<Record<Modulo, string[]>> = {
   CONTAS: ["bank-accounts"],
   CARTOES: ["credit-cards"],
   PLANEJAMENTO: ["goals"],
   RELATORIOS: ["insights", "dashboards"],
   CONTATOS: ["contacts"],
   ESTOQUE: ["inventory"],
   SERVICOS: ["services"],
};

export function useOrganizationModules() {
   const { data } = useSuspenseQuery(
      orpc.organizationConfig.getModules.queryOptions(),
   );

   const disabledNavIds = new Set<string>();
   for (const row of data) {
      if (!row.habilitado) {
         const ids = MODULE_TO_NAV_IDS[row.modulo] ?? [];
         for (const id of ids) {
            disabledNavIds.add(id);
         }
      }
   }

   const isModuleEnabled = (navItemId: string) =>
      !disabledNavIds.has(navItemId);

   return { modules: data, isModuleEnabled };
}
```

**Step 2: Add `moduleKey` to NavItemDef type in sidebar-nav-items.ts**

In `NavItemDef`, add optional field:
```typescript
/** Modulo enum key — if set, item is hidden when that module is disabled */
moduleKey?: import("@core/database/schemas/organization-config").Modulo;
```

Then set `moduleKey` on the relevant nav items:
- `bank-accounts` → `moduleKey: "CONTAS"`
- `credit-cards` → `moduleKey: "CARTOES"`
- `goals` → `moduleKey: "PLANEJAMENTO"`
- `insights` and `dashboards` → `moduleKey: "RELATORIOS"`
- `contacts` → `moduleKey: "CONTATOS"`
- `inventory` → `moduleKey: "ESTOQUE"`
- `services` → `moduleKey: "SERVICOS"`

**Step 3: Integrate into SidebarDefaultItems and NavGroup in sidebar-nav.tsx**

In `SidebarDefaultItems`, import and use `useOrganizationModules`:
```tsx
const { isModuleEnabled } = useOrganizationModules();

const visibleMainItems = (mainGroup?.items ?? [])
   .filter((item) => {
      if (!item.earlyAccessFlag) return true;
      return isEnrolled(item.earlyAccessFlag);
   })
   .filter((item) => isVisible(item.id))
   .filter((item) => (item.moduleKey ? isModuleEnabled(item.moduleKey) : true));
```

Apply same `.filter((item) => (item.moduleKey ? isModuleEnabled(item.moduleKey) : true))` in `NavGroup` component's `visibleItems` derivation.

**Step 4: Wrap sidebar in Suspense (if not already)**

The `useOrganizationModules` hook uses `useSuspenseQuery`. Ensure the sidebar components using this hook are inside a `<Suspense>` boundary. Check `app-sidebar.tsx` or the route layout and add if needed:

```tsx
import { Suspense } from "react";
// wrap SidebarDefaultItems and SidebarNav
<Suspense fallback={null}>
   <SidebarDefaultItems />
</Suspense>
<Suspense fallback={null}>
   <SidebarNav />
</Suspense>
```

**Step 5: Commit**

```bash
git add apps/web/src/layout/dashboard/hooks/use-organization-modules.ts apps/web/src/layout/dashboard/ui/sidebar-nav.tsx apps/web/src/layout/dashboard/ui/sidebar-nav-items.ts
git commit -m "feat(ui): wire organizacao_modulo config into sidebar nav visibility"
```

---

### Task 7: Add relations.ts entry for new tables

**Files:**
- Modify: `core/database/src/relations.ts`

**Step 1: Read relations.ts and add relations for the new tables if the file uses drizzle `relations()`**

Open `core/database/src/relations.ts`. If it defines relations for other tables, add:
```typescript
import { organizacaoModulo, organizacaoRotuloConfig } from "@core/database/schemas/organization-config";
// No foreign key relations needed since teamId references auth.team which is outside drizzle schema control
// Skip if not needed
```

If the file only exports from schemas without explicit drizzle relations, no changes needed.

**Step 2: Run typecheck**

```bash
bun run typecheck
```
Fix any type errors before committing.

**Step 3: Final commit**

```bash
git commit -m "feat(mon-191): organization presets — EMPRESARIAL categories, module config, nav integration"
```

---

## Notes

- `useAccountType` always returns `business` — no PESSOAL code path needed
- All modules are seeded as `habilitado: true` for EMPRESARIAL; nav behavior unchanged until admin disables a module
- `organizacao_rotulo_config` table seeds `CENTRO_CUSTO` — nav already uses `labelOverrides: { business: "Centros de Custo" }` so labels are correct immediately
- `updateOrganizacaoModulo` uses Drizzle `&&` operator for compound `where` — verify with `and()` helper if linting fails: `where(and(eq(...), eq(...)))`
- If `db:push` fails due to enum conflicts, check that `moduloEnum` and `tipoRotuloEnum` names don't clash with existing enums in the database
