# Sidebar Finance Collapsible Group Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the "Finanças" sidebar group collapsible, and nest "Categorias" and "Centros de Custo" under a collapsible sub-item called "Configurações" (or similar) using `SidebarMenuSub` + `Collapsible`.

**Architecture:** Add an optional `children` array to `NavItemDef` in `sidebar-nav-items.ts`. In `sidebar-nav.tsx`, render a `Collapsible asChild` + `SidebarMenuSub` wrapper (shadcn pattern) when a `NavItemDef` has children. Persist the open/closed state of the sub-item using `createLocalStorageState`. The "Finanças" group label stays as-is (non-collapsible).

**Tech Stack:** Radix `Collapsible` (already in `@packages/ui/components/collapsible`), `SidebarMenuSub` / `SidebarMenuSubButton` / `SidebarMenuSubItem` (already exported from `@packages/ui/components/sidebar`), `createLocalStorageState` from `foxact/create-local-storage-state`.

---

## Current structure (reference)

```
Finanças (SidebarGroupLabel — static)
  ├─ Lançamentos
  ├─ Contas Bancárias
  ├─ Cartões de Crédito
  ├─ Categorias            ← move into sub-group
  ├─ Centros de Custo      ← move into sub-group
  ├─ Metas
  └─ Contas a Pagar/Receber
```

Target:

```
▾ Finanças (collapsible group label with chevron)
    ├─ Lançamentos
    ├─ Contas Bancárias
    ├─ Cartões de Crédito
    ├─ ▾ Classificação (collapsible nav item with SidebarMenuSub)
    │     ├─ Categorias
    │     └─ Centros de Custo
    ├─ Metas
    └─ Contas a Pagar/Receber
```

---

### Task 1: Extend `NavItemDef` and `NavGroupDef` types + update data

**Files:**
- Modify: `apps/web/src/layout/dashboard/ui/sidebar-nav-items.ts`

**Step 1: Add `children` to `NavItemDef`**

Add to `NavItemDef`:
```typescript
/** Sub-items rendered as SidebarMenuSub when expanded */
children?: NavItemDef[];
```

`NavGroupDef` is unchanged — no collapsible flag needed on the group.

**Step 2: Update the `finance` group data**

Replace the `categories` and `tags` entries with a single parent item:

```typescript
{
   id: "classificacao",
   label: "Classificação",
   icon: Tag,
   route: "/$slug/$teamSlug/categories", // fallback route (not navigated directly)
   configurable: false,
   children: [
      {
         id: "categories",
         label: "Categorias",
         icon: Tag,
         route: "/$slug/$teamSlug/categories",
         configurable: true,
      },
      {
         id: "tags",
         label: "Centros de Custo",
         icon: Tags,
         route: "/$slug/$teamSlug/tags",
         configurable: true,
      },
   ],
},
```

**Step 3: Remove unused `labelOverrides` type field** (already cleaned up — verify it's gone).

---

### Task 2: Persist collapse state for the sub-item

**Files:**
- Modify: `apps/web/src/layout/dashboard/hooks/use-finance-nav-preferences.ts`

**Step 1: Add one `createLocalStorageState` entry for the sub-item**

```typescript
const [useClassificacaoOpen] = createLocalStorageState<boolean>(
   "montte:sidebar:classificacao-open",
   true, // open by default
);
```

Export from `useFinanceNavPreferences`:

```typescript
export function useFinanceNavPreferences() {
   // ...existing wantedItems / isWanted / toggleItem...
   const [classificacaoOpen, setClassificacaoOpen] = useClassificacaoOpen();

   return {
      wantedItems,
      isWanted,
      toggleItem,
      classificacaoOpen: classificacaoOpen ?? true,
      setClassificacaoOpen,
   };
}
```

---

### Task 3: Add `CollapsibleNavItem` component in `sidebar-nav.tsx`

**Files:**
- Modify: `apps/web/src/layout/dashboard/ui/sidebar-nav.tsx`

**Step 1: Import new primitives**

```typescript
import {
   Collapsible,
   CollapsibleContent,
   CollapsibleTrigger,
} from "@packages/ui/components/collapsible";
import {
   // ...existing sidebar imports...
   SidebarMenuSub,
   SidebarMenuSubButton,
   SidebarMenuSubItem,
} from "@packages/ui/components/sidebar";
import { ChevronRight } from "lucide-react"; // add ChevronRight
```

**Step 2: Add `CollapsibleNavItem` component**

Uses the official shadcn pattern: `<Collapsible asChild>` wraps `<SidebarMenuItem>`, `group/collapsible` on the collapsible, chevron uses `group-data-[state=open]/collapsible:rotate-90`.

Insert between `NavItem` and `useNavHandlers`:

```tsx
function CollapsibleNavItem({
   item,
   slug,
   teamSlug,
   isItemActive,
   open,
   onOpenChange,
   onMainItemClick,
}: {
   item: NavItemDef;
   slug: string;
   teamSlug?: string | null;
   isItemActive: (item: NavItemDef) => boolean;
   open: boolean;
   onOpenChange: (open: boolean) => void;
   onMainItemClick: () => void;
}) {
   const Icon = item.icon;
   const anyChildActive = item.children?.some(isItemActive) ?? false;

   return (
      <Collapsible
         asChild
         className="group/collapsible"
         onOpenChange={onOpenChange}
         open={open}
      >
         <SidebarMenuItem>
            <CollapsibleTrigger asChild>
               <SidebarMenuButton isActive={anyChildActive} tooltip={item.label}>
                  <Icon />
                  <span>{item.label}</span>
                  <ChevronRight className="ml-auto size-3.5 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 group-data-[collapsible=icon]:hidden" />
               </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
               <SidebarMenuSub>
                  {(item.children ?? []).map((child) => (
                     <SidebarMenuSubItem key={child.id}>
                        <SidebarMenuSubButton asChild isActive={isItemActive(child)}>
                           <Link
                              onClick={onMainItemClick}
                              params={{ slug, teamSlug: teamSlug ?? "" }}
                              to={child.route}
                           >
                              <span>{child.label}</span>
                           </Link>
                        </SidebarMenuSubButton>
                     </SidebarMenuSubItem>
                  ))}
               </SidebarMenuSub>
            </CollapsibleContent>
         </SidebarMenuItem>
      </Collapsible>
   );
}
```

**Step 3: Update `NavGroup` to use `CollapsibleNavItem` when item has `children`**

In `NavGroup`, pull `classificacaoOpen` and `setClassificacaoOpen` from `useFinanceNavPreferences()`, then replace the `visibleItems.map` block:

```tsx
const { isWanted, classificacaoOpen, setClassificacaoOpen } = useFinanceNavPreferences();

// in JSX:
{visibleItems.map((item) =>
   item.children ? (
      <CollapsibleNavItem
         isItemActive={isItemActive}
         item={item}
         key={item.id}
         onMainItemClick={onMainItemClick}
         onOpenChange={setClassificacaoOpen}
         open={classificacaoOpen}
         slug={slug}
         teamSlug={teamSlug}
      />
   ) : (
      <NavItem
         isActive={isItemActive(item)}
         item={item}
         key={item.id}
         onMainItemClick={onMainItemClick}
         onSubPanelToggle={onSubPanelToggle}
         slug={slug}
         teamSlug={teamSlug}
      />
   )
)}
```

> The "Finanças" `SidebarGroupLabel` stays exactly as it is — no changes to group collapsing.

---

### Task 4: Update `sidebar-nav-config-form.tsx` to handle nested items

**Files:**
- Modify: `apps/web/src/layout/dashboard/ui/sidebar-nav-config-form.tsx`

The config form lets users toggle item visibility. It currently iterates `group.items`. It needs to also flatten `item.children` so nested items appear in the config list.

**Step 1: Flatten children when building the configurable item list**

In the config form, replace the items array with a flattened version:

```typescript
const allConfigurableItems = group.items.flatMap((item) =>
   item.children
      ? item.children.filter((c) => c.configurable)
      : item.configurable
        ? [item]
        : [],
);
```

This ensures "Categorias" and "Centros de Custo" still appear in settings even though they are nested.

---

### Task 5: Verify `isItemActive` works for nested children

**Files:**
- Read: `apps/web/src/layout/dashboard/ui/sidebar-nav.tsx` (no change needed — verify)

`isItemActive` in `useNavHandlers` uses `router.buildLocation` + `pathname.startsWith`. Since children have real routes, this already works correctly. No change needed — just confirm visually by navigating to `/categories` and `/tags`.

---

### Task 6: Manual smoke test

1. Open sidebar — "Finanças" label has a chevron.
2. Click label → group collapses, all finance items hide.
3. Refresh page → state is persisted (localStorage).
4. Expand again → "Classificação" item is visible with its own chevron.
5. Click "Classificação" → sub-items "Categorias" and "Centros de Custo" appear.
6. Navigate to each — correct route loads, item highlights as active.
7. Parent "Classificação" also highlights when a child is active.
8. Collapse "Classificação" → state persists on refresh.
9. Sidebar in icon mode → no chevrons visible, tooltips work.
10. Open settings config form → "Categorias" and "Centros de Custo" still appear as toggleable items.
