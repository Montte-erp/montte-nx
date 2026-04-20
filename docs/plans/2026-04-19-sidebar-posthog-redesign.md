# Sidebar PostHog-Inspired Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign AppSidebar to match PostHog layout — one combined org+team selector at top header, chat button stub below it, account at bottom footer, all nav sections are shadcn Collapsible groups (including a new "PROJETO" group wrapping the current main items: Home/Dashboards/Insights/Data), inline edit mode for nav config (no modal).

**Architecture:** Move `SidebarScopeSwitcher` (combined org+team) into `SidebarHeader`. Extract `SidebarAccountMenu` (user/logout/theme) as separate footer component. Convert `SidebarDefaultItems` (the unlabeled main group) into a labeled `"PROJETO"` shadcn Collapsible section. Make all `NavGroup` labels collapsible triggers. Replace modal nav config with inline checkbox toggle mode.

**Tech Stack:** shadcn/ui Sidebar primitives, Radix Collapsible, TanStack Query, Better Auth authClient, Tailwind CSS transitions, Lucide icons.

---

## Layout Target

```
<Sidebar>
  <SidebarHeader>
    <SidebarScopeSwitcher />    ← combined org+team dropdown (existing, just moved here)
    <Separator />
    <SidebarChatButton />       ← chat stub (disabled, "Em breve")
  </SidebarHeader>

  <SidebarContent>
    {/* "PROJETO" — shadcn Collapsible, wraps current SidebarDefaultItems */}
    <SidebarGroup>
      <Collapsible defaultOpen>
        <SidebarGroupLabel asChild>
          <CollapsibleTrigger>PROJETO <ChevronRight /></CollapsibleTrigger>
        </SidebarGroupLabel>
        <CollapsibleContent>
          Home, Dashboards, Insights, Gestão de Dados
        </CollapsibleContent>
      </Collapsible>
    </SidebarGroup>

    <Separator />

    {/* Finanças, ERP — each NavGroup header is also a CollapsibleTrigger */}
    <SidebarNav />
  </SidebarContent>

  <SidebarFooter>
    <EarlyAccessSidebarBanner />
    <Separator />
    <SidebarAccountMenu />      ← extracted: user avatar + theme + logout
    <Separator />
    <SidebarFooterContent />    ← hide/settings (unchanged)
  </SidebarFooter>
</Sidebar>
```

**Key clarifications:**
- ONE selector at top: org+team combined (current `SidebarScopeSwitcher` logic, just relocated to header)
- "PROJETO" in nav body = shadcn `Collapsible`, NOT a dropdown — wraps Home/Dashboards/Insights/Data
- Account section extracted from `SidebarScopeSwitcher` into its own `SidebarAccountMenu` at footer

---

## Task 1: Extract SidebarAccountMenu from SidebarScopeSwitcher

**Files:**
- Create: `apps/web/src/layout/dashboard/ui/sidebar-account-menu.tsx`
- Modify: `apps/web/src/layout/dashboard/ui/sidebar-scope-switcher.tsx` (remove account section)

**What to build:**

Extract the "Conta" section (user avatar, theme switcher, logout) from `SidebarScopeSwitcherContent` into a standalone `SidebarAccountMenu`. This goes in `SidebarFooter`. The existing `SidebarScopeSwitcher` keeps org+team switching logic but drops account.

```tsx
// sidebar-account-menu.tsx
import { Avatar, AvatarFallback, AvatarImage } from "@packages/ui/components/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@packages/ui/components/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@packages/ui/components/sidebar";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { ChevronsUpDown, LogOut, Settings } from "lucide-react";
import { useCallback, useTransition } from "react";
import { QueryBoundary } from "@/components/query-boundary";
import { Skeleton } from "@packages/ui/components/skeleton";
import { toast } from "sonner";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useDashboardSlugs } from "@/hooks/use-dashboard-slugs";
import { authClient } from "@/integrations/better-auth/auth-client";
import { orpc } from "@/integrations/orpc/client";
import { ThemeSwitcher } from "./theme-switcher";

function SidebarAccountMenuSkeleton() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton className="pointer-events-none" size="lg">
          <Skeleton className="size-8 rounded-full" />
          <div className="grid flex-1 gap-2">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function SidebarAccountMenuContent() {
  const { data: session } = useSuspenseQuery(orpc.session.getSession.queryOptions({}));
  const { slug, teamSlug } = useDashboardSlugs();
  const { openAlertDialog } = useAlertDialog();
  const { isMobile, setOpenMobile } = useSidebar();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [, startTransition] = useTransition();

  const handleLogout = useCallback(async () => {
    await authClient.signOut({
      fetchOptions: {
        onError: ({ error }) => toast.error(error.message, { id: "logout" }),
        onRequest: () => toast.loading("Saindo...", { id: "logout" }),
        onSuccess: async () => {
          await queryClient.invalidateQueries({ queryKey: orpc.session.getSession.queryKey({}) });
          router.navigate({ to: "/auth/sign-in" });
          toast.success("Você saiu com sucesso", { id: "logout" });
        },
      },
    });
    setOpenMobile(false);
  }, [queryClient, router, setOpenMobile]);

  const handleLogoutClick = useCallback(() => {
    openAlertDialog({
      actionLabel: "Sair",
      cancelLabel: "Cancelar",
      description: "Tem certeza que deseja sair da sua conta?",
      onAction: handleLogout,
      title: "Sair da Conta",
      variant: "destructive",
    });
  }, [openAlertDialog, handleLogout]);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="size-8 shrink-0 rounded-full">
                <AvatarImage src={session?.user.image ?? undefined} alt={session?.user.name ?? ""} />
                <AvatarFallback className="rounded-full text-[10px]">
                  {session?.user.name?.charAt(0) ?? "?"}
                </AvatarFallback>
              </Avatar>
              <div className="grid min-w-0 flex-1 text-left leading-tight">
                <span className="truncate text-sm font-medium">{session?.user.name}</span>
                <span className="truncate text-xs text-muted-foreground">{session?.user.email}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4 shrink-0" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            side={isMobile ? "bottom" : "top"}
            sideOffset={4}
            className="w-(--radix-dropdown-menu-trigger-width) min-w-64 rounded-lg"
          >
            <DropdownMenuLabel className="py-2">
              <div className="flex items-center gap-2">
                <Avatar className="size-8 rounded-full">
                  <AvatarImage src={session?.user.image ?? undefined} />
                  <AvatarFallback>{session?.user.name?.charAt(0) ?? "?"}</AvatarFallback>
                </Avatar>
                <div className="grid min-w-0 flex-1 leading-tight">
                  <span className="truncate font-medium">{session?.user.name}</span>
                  <span className="truncate text-xs text-muted-foreground">{session?.user.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="flex items-center justify-between px-2 py-1.5">
              <span className="text-sm text-muted-foreground">Tema</span>
              <ThemeSwitcher />
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link params={{ slug, teamSlug }} to="/$slug/$teamSlug/settings/profile">
                <Settings className="size-4" /> Meu perfil
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={handleLogoutClick}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="size-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

export function SidebarAccountMenu() {
  return (
    <QueryBoundary fallback={<SidebarAccountMenuSkeleton />} errorTitle="Erro ao carregar conta">
      <SidebarAccountMenuContent />
    </QueryBoundary>
  );
}
```

In `sidebar-scope-switcher.tsx`: delete the "Conta" `DropdownMenuLabel` block and everything under it (theme switcher, profile link, logout). The component now only handles org+team.

**Step 1:** Create `sidebar-account-menu.tsx` with code above.

**Step 2:** Remove account section from `sidebar-scope-switcher.tsx` (lines 483–521 in current file — the `DropdownMenuLabel` "Conta" through end of dropdown content).

**Step 3:** `bun run typecheck` — fix errors.

**Step 4:** Commit.

```bash
git add apps/web/src/layout/dashboard/ui/sidebar-account-menu.tsx
git add apps/web/src/layout/dashboard/ui/sidebar-scope-switcher.tsx
git commit -m "feat(sidebar): extract SidebarAccountMenu from scope switcher"
```

---

## Task 2: Rewire app-sidebar.tsx — move scope switcher to header, account to footer, add chat button

**Files:**
- Modify: `apps/web/src/layout/dashboard/ui/app-sidebar.tsx`
- Create: `apps/web/src/layout/dashboard/ui/sidebar-chat-button.tsx`

**ChatButton** — disabled button, "Em breve" badge, tooltip.

```tsx
// sidebar-chat-button.tsx
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@packages/ui/components/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@packages/ui/components/tooltip";
import { MessageSquare } from "lucide-react";

export function SidebarChatButton() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <Tooltip>
          <TooltipTrigger asChild>
            <SidebarMenuButton size="sm" className="cursor-not-allowed opacity-60" disabled>
              <MessageSquare className="size-4" />
              <span>Chat</span>
              <span className="ml-auto rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                Em breve
              </span>
            </SidebarMenuButton>
          </TooltipTrigger>
          <TooltipContent side="right">Chat com Rubi — em breve</TooltipContent>
        </Tooltip>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
```

**New app-sidebar.tsx:**

```tsx
import { Separator } from "@packages/ui/components/separator";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarHeader,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@packages/ui/components/sidebar";
import { Link } from "@tanstack/react-router";
import { PanelLeftClose, Settings } from "lucide-react";
import type * as React from "react";
import { useDashboardSlugs } from "@/hooks/use-dashboard-slugs";
import { EarlyAccessSidebarBanner } from "./early-access-sidebar-banner";
import { SidebarDefaultItems, SidebarNav } from "./sidebar-nav";
import { SidebarScopeSwitcher } from "./sidebar-scope-switcher";
import { SidebarChatButton } from "./sidebar-chat-button";
import { SidebarAccountMenu } from "./sidebar-account-menu";

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar className="px-0" collapsible="icon" variant="inset" {...props}>
      <SidebarHeader className="gap-1 pb-2">
        <SidebarScopeSwitcher />
        <Separator className="my-1" />
        <SidebarChatButton />
      </SidebarHeader>

      <SidebarContent>
        <SidebarDefaultItems />
        <div className="px-2">
          <Separator />
        </div>
        <SidebarNav />
      </SidebarContent>

      <SidebarFooter>
        <EarlyAccessSidebarBanner />
        <Separator />
        <SidebarAccountMenu />
        <Separator />
        <SidebarFooterContent />
      </SidebarFooter>
    </Sidebar>
  );
}

function SidebarFooterContent() {
  const { slug, teamSlug } = useDashboardSlugs();
  const { toggleSidebar, state } = useSidebar();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton onClick={toggleSidebar} tooltip={state === "expanded" ? "Ocultar" : "Abrir"}>
          <PanelLeftClose className={state === "collapsed" ? "rotate-180" : ""} />
          <span>Ocultar</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton asChild tooltip="Configurações">
          <Link params={{ slug, teamSlug }} to="/$slug/$teamSlug/settings">
            <Settings />
            <span>Configurações</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
```

**Step 1:** Create `sidebar-chat-button.tsx`.

**Step 2:** Rewrite `app-sidebar.tsx`.

**Step 3:** `bun run typecheck` — fix errors.

**Step 4:** Commit.

```bash
git add apps/web/src/layout/dashboard/ui/sidebar-chat-button.tsx
git add apps/web/src/layout/dashboard/ui/app-sidebar.tsx
git commit -m "feat(sidebar): PostHog layout — scope switcher to header, account to footer, chat stub"
```

---

## Task 3: "PROJETO" collapsible nav section (wrap SidebarDefaultItems)

**Files:**
- Modify: `apps/web/src/layout/dashboard/ui/sidebar-nav.tsx`

`SidebarDefaultItems` currently renders the unlabeled main group (Home, Dashboards, Insights, Data Management) with no section header. Wrap it in a shadcn `Collapsible` with a "PROJETO" label, matching PostHog's "PROJECT ˅" section.

**Replace `SidebarDefaultItems` in `sidebar-nav.tsx`:**

```tsx
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@packages/ui/components/collapsible";
import {
  SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, useSidebarManager,
} from "@packages/ui/components/sidebar";
import { ChevronRight } from "lucide-react";

export function SidebarDefaultItems() {
  const {
    slug, teamSlug,
    handleSubPanelToggle, handleMainItemClick, isItemActive,
  } = useNavHandlers();
  const { pathname } = useLocation();
  const { isEnrolled } = useEarlyAccess();
  const { isVisible } = useSidebarVisibility();

  const mainGroup = navGroups.find((g) => !g.label);
  const visibleMainItems = (mainGroup?.items ?? [])
    .filter((item) => (!item.earlyAccessFlag) || isEnrolled(item.earlyAccessFlag))
    .filter((item) => isVisible(item.id));

  const resolvedSlug = slug || pathname.split("/")[1] || "";

  return (
    <Collapsible defaultOpen className="group/projeto">
      <SidebarGroup className="py-0">
        <SidebarGroupLabel asChild className="justify-between pr-2 group-data-[collapsible=icon]:hidden">
          <CollapsibleTrigger className="w-full cursor-pointer hover:text-foreground transition-colors duration-150">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Projeto</span>
            <ChevronRight className="size-3 transition-transform duration-200 group-data-[state=open]/projeto:rotate-90" />
          </CollapsibleTrigger>
        </SidebarGroupLabel>
        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleMainItems.map((item) => (
                <NavItem
                  isActive={isItemActive(item)}
                  item={item}
                  key={item.id}
                  onMainItemClick={handleMainItemClick}
                  onSubPanelToggle={handleSubPanelToggle}
                  slug={resolvedSlug}
                  teamSlug={teamSlug}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
}
```

**Step 1:** Add `Collapsible`, `CollapsibleContent`, `CollapsibleTrigger` to imports in `sidebar-nav.tsx`.

**Step 2:** Rewrite `SidebarDefaultItems` as shown above.

**Step 3:** `bun run typecheck` — fix errors.

**Step 4:** Commit.

```bash
git add apps/web/src/layout/dashboard/ui/sidebar-nav.tsx
git commit -m "feat(sidebar): PROJETO collapsible section wrapping main nav items"
```

---

## Task 4: Collapsible NavGroup headers (Finanças, ERP, etc.)

**Files:**
- Modify: `apps/web/src/layout/dashboard/ui/sidebar-nav.tsx`

Make each `NavGroup` with a `label` collapsible at group level — clicking the section header toggles the group. Uses the same shadcn `Collapsible` pattern.

**Replace `NavGroup`:**

```tsx
function NavGroup({ group, slug, teamSlug, isItemActive, onSubPanelToggle, onMainItemClick, onConfigure }) {
  const { isEnrolled } = useEarlyAccess();
  const { isVisible } = useSidebarVisibility();
  const { isWanted } = useFinanceNavPreferences();

  const visibleItems = group.items
    .filter((item) => {
      if (!item.earlyAccessFlag) return true;
      if (group.label) return isWanted(item.id) || isEnrolled(item.earlyAccessFlag);
      return isEnrolled(item.earlyAccessFlag);
    })
    .filter((item) => isVisible(item.id));

  if (visibleItems.length === 0 && !onConfigure) return null;

  const groupKey = `nav-group-${group.id}`;

  return (
    <Collapsible defaultOpen className={`group/${groupKey} pt-0`}>
      <SidebarGroup className="pt-0">
        {group.label && (
          <SidebarGroupLabel asChild className="justify-between pr-1">
            <CollapsibleTrigger className="w-full cursor-pointer hover:text-foreground transition-colors duration-150">
              <span>{group.label}</span>
              <div className="flex items-center gap-1">
                {onConfigure && (
                  <button
                    className="text-muted-foreground hover:text-foreground group-data-[collapsible=icon]:hidden"
                    onClick={(e) => { e.stopPropagation(); onConfigure(); }}
                    type="button"
                  >
                    <Settings2 className="size-3.5" />
                  </button>
                )}
                <ChevronRight className={`size-3 text-muted-foreground transition-transform duration-200 group-data-[state=open]/${groupKey}:rotate-90 group-data-[collapsible=icon]:hidden`} />
              </div>
            </CollapsibleTrigger>
          </SidebarGroupLabel>
        )}
        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) =>
                item.children ? (
                  <CollapsibleNavItem
                    isItemActive={isItemActive}
                    item={item}
                    key={item.id}
                    onMainItemClick={onMainItemClick}
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
                ),
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
}
```

**Note on dynamic Tailwind group names:** `group-data-[state=open]/${groupKey}` uses Tailwind's arbitrary group variant. This requires the class to be present as a complete string at build time — Tailwind can't detect dynamically interpolated class names. Use a fixed set instead: wrap in `className="group/nav-group"` and use `group-data-[state=open]/nav-group:rotate-90`. Since all groups share the same variant name, it's fine — each `Collapsible` scopes its own state independently via the DOM tree.

**Simplified approach (avoids dynamic class issue):**

```tsx
// Always use the same group name — each Collapsible scopes independently
<Collapsible defaultOpen className="group/nav-group pt-0">
  ...
  <ChevronRight className="size-3 ... transition-transform duration-200 group-data-[state=open]/nav-group:rotate-90 ..." />
```

**Step 1:** Wrap `NavGroup` body in `<Collapsible defaultOpen className="group/nav-group pt-0">`.

**Step 2:** Make `SidebarGroupLabel` a `CollapsibleTrigger` with `asChild`, add chevron.

**Step 3:** Wrap content in `<CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">`.

**Step 4:** `e.stopPropagation()` on the configure button so it doesn't toggle collapse.

**Step 5:** `bun run typecheck` — fix errors.

**Step 6:** Commit.

```bash
git add apps/web/src/layout/dashboard/ui/sidebar-nav.tsx
git commit -m "feat(sidebar): collapsible group headers for Finanças and ERP sections"
```

---

## Task 5: Inline edit mode for nav config (replace modal)

**Files:**
- Modify: `apps/web/src/layout/dashboard/ui/sidebar-nav.tsx`
- Modify: `apps/web/src/layout/dashboard/hooks/use-sidebar-store.ts` (if toggle missing)

Currently: `Settings2` icon on finance group opens `SidebarNavConfigForm` modal.

New behavior (PostHog image 9): click pencil → inline checkbox list. Click ✓ → save + exit. Click ✗ → cancel.

**Step 1:** Check `use-sidebar-store.ts` — does `useSidebarVisibility` expose a `toggleVisibility(itemId)` function? If not, add:

```typescript
// in use-sidebar-store.ts
export function toggleVisibility(itemId: string) {
  // look at how isVisible/setVisible works and implement toggle
  // likely: store.setState(s => ({ ...s, hiddenItems: s.hiddenItems.includes(itemId) ? s.hiddenItems.filter(id => id !== itemId) : [...s.hiddenItems, itemId] }))
}
```

**Step 2:** Add `isEditing` state to `NavGroup`, `handleEditStart/Save/Cancel` callbacks:

```tsx
const [isEditing, setIsEditing] = useState(false);
const { isVisible } = useSidebarVisibility();

const handleEditStart = useCallback((e: React.MouseEvent) => {
  e.stopPropagation();
  setIsEditing(true);
}, []);

const handleEditSave = useCallback((e: React.MouseEvent) => {
  e.stopPropagation();
  setIsEditing(false);
}, []);

const handleEditCancel = useCallback((e: React.MouseEvent) => {
  e.stopPropagation();
  setIsEditing(false);
}, []);
```

**Step 3:** Replace `Settings2` button with `Pencil` → `handleEditStart`. When `isEditing`, show `Check` (save) + `X` (cancel) instead:

```tsx
{onConfigure && !isEditing && (
  <button onClick={handleEditStart} type="button"
    className="text-muted-foreground hover:text-foreground group-data-[collapsible=icon]:hidden">
    <Pencil className="size-3.5" />
  </button>
)}
{isEditing && (
  <>
    <button onClick={handleEditSave} type="button" className="text-emerald-600 hover:text-emerald-700">
      <Check className="size-3.5" />
    </button>
    <button onClick={handleEditCancel} type="button" className="text-muted-foreground hover:text-foreground">
      <X className="size-3.5" />
    </button>
  </>
)}
```

**Step 4:** Render checkbox list when `isEditing`. Show ALL group items (not just visible), filtered by early access only:

```tsx
{isEditing ? (
  <SidebarGroupContent>
    <SidebarMenu>
      {group.items
        .filter((item) => !item.earlyAccessFlag || isEnrolled(item.earlyAccessFlag))
        .map((item) => {
          const Icon = item.icon;
          const visible = isVisible(item.id);
          return (
            <SidebarMenuItem key={item.id}>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-sidebar-accent transition-colors duration-150"
                onClick={() => toggleVisibility(item.id)}
              >
                <div className={cn(
                  "flex size-4 shrink-0 items-center justify-center rounded-sm border transition-colors duration-150",
                  visible ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground",
                )}>
                  {visible && <Check className="size-3" />}
                </div>
                <Icon className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{item.label}</span>
              </button>
            </SidebarMenuItem>
          );
        })}
    </SidebarMenu>
  </SidebarGroupContent>
) : (
  // existing items render
)}
```

**Step 5:** Remove `onConfigure` prop from `NavGroup` signature and from `SidebarNav`. Remove `handleConfigure` + `SidebarNavConfigForm` call from `SidebarNav`.

**Step 6:** `bun run typecheck`.

**Step 7:** Commit.

```bash
git add apps/web/src/layout/dashboard/ui/sidebar-nav.tsx
git add apps/web/src/layout/dashboard/hooks/use-sidebar-store.ts
git commit -m "feat(sidebar): inline checkbox edit mode, remove modal config"
```

---

## Task 6: Cleanup

**Files:**
- Delete: `apps/web/src/layout/dashboard/ui/sidebar-nav-config-form.tsx` (if unreferenced)

**Step 1:** `grep -r "SidebarNavConfigForm" apps/web/src` — confirm zero references.

**Step 2:** Delete if clean.

**Step 3:** `bun run typecheck && bun run check` — all clean.

**Step 4:** Commit.

```bash
git rm apps/web/src/layout/dashboard/ui/sidebar-nav-config-form.tsx
git commit -m "chore(sidebar): remove SidebarNavConfigForm after inline edit migration"
```

---

## Notes & Gotchas

- **`SidebarGroupLabel` + `asChild` + `CollapsibleTrigger`**: `SidebarGroupLabel` renders a `div`. Pass `asChild` on it and use `CollapsibleTrigger` as the direct child. Do NOT put `asChild` on `CollapsibleTrigger` here — it's the trigger itself. If styling breaks, fall back to a plain `button` styled to match `SidebarGroupLabel` classes.
- **`group/nav-group` shared name**: All `NavGroup` collapsibles can share `className="group/nav-group"` — each `Collapsible` scopes its `data-[state]` to its own subtree. No name conflicts.
- **Animation classes**: `animate-accordion-up`/`animate-accordion-down` from `tailwindcss-animate`. Verify: `grep accordion apps/web/tailwind.config.ts`. Fallback: `data-[state=closed]:grid-rows-[0fr] data-[state=open]:grid-rows-[1fr] transition-[grid-template-rows] duration-200` with inner `div className="overflow-hidden"`.
- **`SidebarScopeSwitcher` size in header**: The existing trigger uses `size="lg"`. In a header context this may feel large — consider `size="sm"` or default. Adjust if needed.
- **Mobile**: `SidebarScopeSwitcher` already handles `isMobile`. No changes needed there.
- **`SidebarHeader` padding**: `Sidebar` has `px-0`. `SidebarHeader` will need `px-2` or the child `SidebarMenu` will handle it. Check visually.
