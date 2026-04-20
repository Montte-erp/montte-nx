# Sidebar PostHog-Inspired Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign AppSidebar to match PostHog layout — org selector + project selector at top, account at bottom, nav groups collapsible at group level with Tailwind animation, inline edit mode for nav config (no modal).

**Architecture:** Split the single `SidebarScopeSwitcher` (537 lines, does too much) into three focused components: `SidebarOrgSelector`, `SidebarProjectSelector`, `SidebarAccountMenu`. Move selectors to `SidebarHeader`. Add a `ChatButton` stub. Make `NavGroup` headers into collapsible triggers at the group level. Replace the modal-based nav config with an inline toggle mode triggered by the pencil icon.

**Tech Stack:** shadcn/ui Sidebar primitives, Radix Collapsible, TanStack Query, Better Auth authClient, Tailwind CSS transitions, Lucide icons.

---

## Layout Target

```
<Sidebar>
  <SidebarHeader>
    <SidebarOrgSelector />      ← org dropdown (top)
    <SidebarProjectSelector />  ← team/project dropdown
    <ChatButton />              ← chat stub (disabled, tooltip)
  </SidebarHeader>
  <SidebarContent>
    <SidebarDefaultItems />     ← unchanged
    <SidebarNav />              ← groups now collapsible at group level
  </SidebarContent>
  <SidebarFooter>
    <EarlyAccessSidebarBanner />
    <Separator />
    <SidebarAccountMenu />      ← user avatar, theme, logout
    <SidebarFooterContent />    ← hide/settings buttons
  </SidebarFooter>
</Sidebar>
```

---

## Task 1: Split SidebarScopeSwitcher → OrgSelector

**Files:**
- Create: `apps/web/src/layout/dashboard/ui/sidebar-org-selector.tsx`
- Modify: `apps/web/src/layout/dashboard/ui/sidebar-scope-switcher.tsx` (keep only what task 2 and 3 need)

**What to build:**

`SidebarOrgSelector` renders a `DropdownMenu` triggered by a `SidebarMenuButton` that shows:
- Active org avatar + name
- `ChevronsUpDown` chevron on the right
- Dropdown content: list of orgs with check mark on active, "Nova organização" at bottom
- Links to org settings + billing

Copy the org-related logic from `SidebarScopeSwitcherContent` (lines 159–186, 272–278, 460–479 in current file).

```tsx
// sidebar-org-selector.tsx
import { ... } from "@packages/ui/components/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@packages/ui/components/sidebar";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useSetActiveOrganization } from "./-sidebar-scope-switcher/use-set-active-organization";
import { orpc } from "@/integrations/orpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ManageOrganizationForm } from "./-sidebar-scope-switcher/manage-organization-form";
import { useCredenza } from "@/hooks/use-credenza";
import { QueryBoundary } from "@/components/query-boundary";
import { OrgAvatar } from "./sidebar-org-avatar"; // see Task 0

export function SidebarOrgSelector() {
  return (
    <QueryBoundary fallback={<SidebarOrgSelectorSkeleton />} errorTitle="Erro ao carregar organização">
      <SidebarOrgSelectorContent />
    </QueryBoundary>
  );
}

function SidebarOrgSelectorContent() {
  const { activeOrganization } = useActiveOrganization();
  const { isMobile } = useSidebar();
  const { openCredenza } = useCredenza();
  const { setActiveOrganization } = useSetActiveOrganization();
  const [isPending, startTransition] = useTransition();
  const { pathname } = useLocation();
  const { slug, teamSlug } = useDashboardSlugs();
  const router = useRouter();
  const { data: organizations } = useSuspenseQuery(orpc.organization.getOrganizations.queryOptions({}));

  // handleOrganizationSwitch — same logic as current SidebarScopeSwitcherContent
  // handleNewOrganization — same as current

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="sm"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <OrgAvatar name={activeOrganization.name} logo={activeOrganization.logo} size="sm" />
              <span className="truncate text-xs font-medium">{activeOrganization.name}</span>
              <ChevronsUpDown className="ml-auto size-3.5 shrink-0" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
            className="min-w-56 rounded-lg"
          >
            <DropdownMenuLabel className="py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Organizações
            </DropdownMenuLabel>
            {organizations?.map((org, i) => (
              <DropdownMenuItem key={`org-${i + 1}`} onSelect={() => handleOrganizationSwitch(org)}>
                {org.id === activeOrganization.id ? <Check className="size-4 shrink-0" /> : <span className="size-4 shrink-0" />}
                <OrgAvatar name={org.name} logo={org.logo} size="md" />
                <span className="truncate">{org.name}</span>
                {org.role && <span className="ml-auto text-[10px] text-muted-foreground">{org.role}</span>}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => handleNewOrganization()}>
              <Plus className="size-4" />
              Nova organização
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link params={{ slug, teamSlug }} to="/$slug/$teamSlug/settings/organization/general">
                <Settings className="size-4" /> Configurações da organização
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link params={{ slug, teamSlug }} to="/$slug/$teamSlug/billing">
                <CreditCard className="size-4" /> Cobrança & uso
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
```

**Step 1:** Extract `OrgAvatar`, `getInitials`, `getOrgColor`, `ORG_AVATAR_COLORS` to a new shared file `sidebar-org-avatar.tsx` — these are needed by multiple components.

**Step 2:** Create `sidebar-org-selector.tsx` with `SidebarOrgSelectorContent` + `SidebarOrgSelectorSkeleton` + `SidebarOrgSelector` (boundary wrapper).

**Step 3:** Run `bun run typecheck` — fix any errors.

**Step 4:** Commit.

```bash
git add apps/web/src/layout/dashboard/ui/sidebar-org-avatar.tsx
git add apps/web/src/layout/dashboard/ui/sidebar-org-selector.tsx
git commit -m "feat(sidebar): extract OrgAvatar + SidebarOrgSelector component"
```

---

## Task 2: Split SidebarScopeSwitcher → ProjectSelector

**Files:**
- Create: `apps/web/src/layout/dashboard/ui/-sidebar-scope-switcher/sidebar-project-selector.tsx`

**What to build:**

`SidebarProjectSelector` shows active team/project with a dropdown to switch between teams or create new one. Smaller than org selector since projects are within an org.

```tsx
function SidebarProjectSelectorContent() {
  const { activeTeam, teams } = useActiveTeam();
  const { projectLimit, projectCount } = useActiveOrganization();
  const { isMobile } = useSidebar();
  const { openCredenza, closeCredenza } = useCredenza();
  // handleTeamSwitch, handleNewProject — same logic as current
  const { slug, teamSlug } = useDashboardSlugs();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="sm"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <LayoutGrid className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate text-sm font-medium">{activeTeam?.name ?? "Sem espaço"}</span>
              <ChevronsUpDown className="ml-auto size-3.5 shrink-0" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side={isMobile ? "bottom" : "right"} sideOffset={4} className="min-w-56 rounded-lg">
            <DropdownMenuLabel className="py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Espaços
            </DropdownMenuLabel>
            {teams.map((team, i) => (
              <DropdownMenuItem key={`team-${i + 1}`} onSelect={() => handleTeamSwitch(team)}>
                {team.id === activeTeam?.id ? <Check className="size-4 shrink-0" /> : <span className="size-4 shrink-0" />}
                <span className="truncate">{team.name}</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => handleNewProject()}>
              <Plus className="size-4" />
              {projectLimit !== null && projectLimit !== Number.POSITIVE_INFINITY
                ? `Novo espaço (${projectCount}/${projectLimit})`
                : "Novo espaço"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link params={{ slug, teamSlug }} to="/$slug/$teamSlug/settings/project/general">
                <Settings className="size-4" /> Configurações do espaço
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link params={{ slug, teamSlug }} to="/$slug/$teamSlug/settings/organization/members">
                <UserPlus className="size-4" /> Convidar membros
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
```

**Step 1:** Create `sidebar-project-selector.tsx` — copy team/project logic from `SidebarScopeSwitcherContent`.

**Step 2:** `bun run typecheck` — fix errors.

**Step 3:** Commit.

```bash
git add apps/web/src/layout/dashboard/ui/sidebar-project-selector.tsx
git commit -m "feat(sidebar): extract SidebarProjectSelector component"
```

---

## Task 3: Split SidebarScopeSwitcher → AccountMenu

**Files:**
- Create: `apps/web/src/layout/dashboard/ui/sidebar-account-menu.tsx`
- Delete or gut: `apps/web/src/layout/dashboard/ui/sidebar-scope-switcher.tsx` (replace with thin re-exports or delete)

**What to build:**

`SidebarAccountMenu` at the bottom — user avatar, name, email, theme switcher, logout.

```tsx
function SidebarAccountMenuContent() {
  const { data: session } = useSuspenseQuery(orpc.session.getSession.queryOptions({}));
  const { slug, teamSlug } = useDashboardSlugs();
  const { openAlertDialog } = useAlertDialog();
  const { isMobile, setOpenMobile } = useSidebar();
  const queryClient = useQueryClient();
  const router = useRouter();
  // handleLogout, handleLogoutClick — same as current

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
              <div className="grid min-w-0 flex-1 leading-tight text-left">
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
            <DropdownMenuItem onSelect={handleLogoutClick} className="text-destructive focus:text-destructive">
              <LogOut className="size-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
```

**Step 1:** Create `sidebar-account-menu.tsx` with `SidebarAccountMenuContent` + skeleton + `SidebarAccountMenu` (QueryBoundary wrapper).

**Step 2:** Delete `sidebar-scope-switcher.tsx` (all its consumers will be replaced in Task 4).

**Step 3:** `bun run typecheck` — fix broken imports.

**Step 4:** Commit.

```bash
git add apps/web/src/layout/dashboard/ui/sidebar-account-menu.tsx
git rm apps/web/src/layout/dashboard/ui/sidebar-scope-switcher.tsx
git commit -m "feat(sidebar): extract SidebarAccountMenu, remove old scope switcher"
```

---

## Task 4: Rewire app-sidebar.tsx + add ChatButton

**Files:**
- Modify: `apps/web/src/layout/dashboard/ui/app-sidebar.tsx`
- Create: `apps/web/src/layout/dashboard/ui/sidebar-chat-button.tsx`

**ChatButton** — just a button that shows a "em breve" tooltip. No infra needed.

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
            <SidebarMenuButton className="cursor-not-allowed opacity-60" size="sm">
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
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@packages/ui/components/sidebar";
import { Link } from "@tanstack/react-router";
import { PanelLeftClose, Settings } from "lucide-react";
import type * as React from "react";
import { useDashboardSlugs } from "@/hooks/use-dashboard-slugs";
import { EarlyAccessSidebarBanner } from "./early-access-sidebar-banner";
import { SidebarDefaultItems, SidebarNav } from "./sidebar-nav";
import { SidebarOrgSelector } from "./sidebar-org-selector";
import { SidebarProjectSelector } from "./sidebar-project-selector";
import { SidebarChatButton } from "./sidebar-chat-button";
import { SidebarAccountMenu } from "./sidebar-account-menu";

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar className="px-0" collapsible="icon" variant="inset" {...props}>
      <SidebarHeader className="gap-1 pb-2">
        <SidebarOrgSelector />
        <SidebarProjectSelector />
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

**Step 2:** Rewrite `app-sidebar.tsx` with new structure above.

**Step 3:** `bun run typecheck` — fix errors.

**Step 4:** Commit.

```bash
git add apps/web/src/layout/dashboard/ui/sidebar-chat-button.tsx
git add apps/web/src/layout/dashboard/ui/app-sidebar.tsx
git commit -m "feat(sidebar): new PostHog-style layout — org+project header, account footer, chat button stub"
```

---

## Task 5: Collapsible NavGroups at group level with Tailwind animation

**Files:**
- Modify: `apps/web/src/layout/dashboard/ui/sidebar-nav.tsx`

Currently `NavGroup` has a static `SidebarGroupLabel` header. Make each group with a `label` collapsible — clicking the label toggles the whole group.

**Key change in `NavGroup`:**

```tsx
function NavGroup({ group, ... }) {
  // ...existing logic...

  // Groups are open by default; state stored in component (no persistence needed)
  return (
    <Collapsible asChild defaultOpen className="group/nav-group pt-0">
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
                <ChevronRight className="size-3 text-muted-foreground transition-transform duration-200 group-data-[state=open]/nav-group:rotate-90 group-data-[collapsible=icon]:hidden" />
              </div>
            </CollapsibleTrigger>
          </SidebarGroupLabel>
        )}
        <CollapsibleContent className="overflow-hidden transition-all duration-200 data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => ...)}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
}
```

**Note on Tailwind animation classes:** shadcn/ui already ships `animate-accordion-up` and `animate-accordion-down` via `tailwindcss-animate` in `globals.css`. These work on `CollapsibleContent`. No extra config needed.

**Step 1:** Wrap `NavGroup` body in `<Collapsible asChild defaultOpen>`.

**Step 2:** Make `SidebarGroupLabel` a `CollapsibleTrigger` — add chevron to right side.

**Step 3:** Wrap `SidebarGroupContent` in `<CollapsibleContent className="overflow-hidden transition-all duration-200 data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">`.

**Step 4:** Stop propagation on the configure button click so it doesn't toggle collapse.

**Step 5:** `bun run typecheck` — fix errors.

**Step 6:** Commit.

```bash
git add apps/web/src/layout/dashboard/ui/sidebar-nav.tsx
git commit -m "feat(sidebar): collapsible nav groups with Tailwind animation"
```

---

## Task 6: Inline edit mode for nav config (replace modal)

**Files:**
- Modify: `apps/web/src/layout/dashboard/ui/sidebar-nav.tsx`
- Modify: `apps/web/src/layout/dashboard/ui/sidebar-nav-config-form.tsx` (may no longer be needed)

Currently: clicking the `Settings2` icon on the finance group opens a `SidebarNavConfigForm` modal.

New behavior (like PostHog image 9): clicking the pencil toggles an inline "edit mode" for that group. In edit mode:
- Each item shows a checkbox on the left
- Header shows a `Check` icon instead of pencil to save, and an `X` to cancel
- Clicking `Check` saves the visibility preferences and exits edit mode
- Animation: fade/slide transition between view and edit modes

**State:** Add local state to `NavGroup` — `isEditing: boolean`.

**Implementation in `NavGroup`:**

```tsx
function NavGroup({ group, slug, teamSlug, isItemActive, onSubPanelToggle, onMainItemClick, onConfigure }) {
  const [isEditing, setIsEditing] = useState(false);
  const { isVisible, toggleVisibility } = useSidebarVisibility(); // need toggleVisibility
  // ...

  const handleEditStart = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); // don't collapse group
    setIsEditing(true);
  }, []);

  const handleEditSave = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(false);
    // visibility already toggled on checkbox click via store
  }, []);

  const handleEditCancel = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(false);
  }, []);

  // In the label area:
  // Replace: <Settings2 onClick={onConfigure} />
  // With:
  {onConfigure && !isEditing && (
    <button onClick={handleEditStart} type="button" className="...">
      <Pencil className="size-3.5" />
    </button>
  )}
  {isEditing && (
    <>
      <button onClick={handleEditSave} type="button" className="text-green-600 hover:text-green-700">
        <Check className="size-3.5" />
      </button>
      <button onClick={handleEditCancel} type="button" className="text-muted-foreground hover:text-foreground">
        <X className="size-3.5" />
      </button>
    </>
  )}

  // Items in edit mode: render all items (not just visible) with checkboxes
  {isEditing ? (
    <SidebarMenu>
      {group.items.filter(...earlyAccess).map((item) => (
        <SidebarMenuItem key={item.id}>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-sidebar-accent transition-colors duration-150"
            onClick={() => toggleVisibility(item.id)}
          >
            <div className={cn(
              "flex size-4 items-center justify-center rounded-sm border transition-colors duration-150",
              isVisible(item.id) ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground"
            )}>
              {isVisible(item.id) && <Check className="size-3" />}
            </div>
            <item.icon className="size-4 text-muted-foreground" />
            <span>{item.label}</span>
          </button>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  ) : (
    // normal items rendering
  )}
}
```

**Note:** Check if `useSidebarVisibility` already exposes a toggle function. If not, add `toggleVisibility(itemId: string)` to `use-sidebar-store.ts`.

**Step 1:** Check `apps/web/src/layout/dashboard/hooks/use-sidebar-store.ts` — does `useSidebarVisibility` expose a toggle? If not, add one.

**Step 2:** Add `isEditing` state + `handleEditStart/Save/Cancel` to `NavGroup`.

**Step 3:** Replace `Settings2` configure button with `Pencil` that triggers inline edit.

**Step 4:** Render checkbox list when `isEditing === true`.

**Step 5:** Remove `onConfigure` prop from `NavGroup` and `SidebarNav`. Remove `SidebarNavConfigForm` modal call from `SidebarNav`.

**Step 6:** `bun run typecheck`.

**Step 7:** Commit.

```bash
git add apps/web/src/layout/dashboard/ui/sidebar-nav.tsx
git add apps/web/src/layout/dashboard/hooks/use-sidebar-store.ts
git commit -m "feat(sidebar): inline edit mode for nav config, replace modal"
```

---

## Task 7: Cleanup

**Files:**
- Check: `apps/web/src/layout/dashboard/ui/sidebar-nav-config-form.tsx` — delete if no longer referenced
- Check: `apps/web/src/layout/dashboard/ui/sidebar-scope-switcher.tsx` — delete if not done in Task 3

**Step 1:** `grep -r "SidebarNavConfigForm" apps/web/src` — confirm no references remain.

**Step 2:** Delete `sidebar-nav-config-form.tsx` if unreferenced.

**Step 3:** `bun run typecheck && bun run check` — all clean.

**Step 4:** Final commit.

```bash
git rm apps/web/src/layout/dashboard/ui/sidebar-nav-config-form.tsx
git commit -m "chore(sidebar): remove unused SidebarNavConfigForm after inline edit migration"
```

---

## Notes & Gotchas

- **`SidebarGroupLabel` as CollapsibleTrigger**: shadcn's `SidebarGroupLabel` renders a `div`, not a `button`. Pass `asChild` to `SidebarGroupLabel` and make `CollapsibleTrigger` the child — not the other way around. Check if this causes styling issues; might need to `asChild` chain carefully.
- **`group-data-[state=open]/nav-group` Tailwind variant**: Requires the `Collapsible` to have `className="group/nav-group"` — already done in the code above. The chevron rotation uses this.
- **Animation classes**: `animate-accordion-up` / `animate-accordion-down` are defined by shadcn in `tailwind.config.ts` via `tailwindcss-animate`. Verify they exist: `grep -r "accordion" apps/web/tailwind.config.ts`. If missing, use `data-[state=closed]:h-0 data-[state=open]:h-auto transition-all duration-200` with `overflow-hidden` instead (less smooth but works).
- **`OrgAvatar` extraction**: Both `SidebarOrgSelector` and any org-related display in `SidebarAccountMenu` need it. Keep it in `sidebar-org-avatar.tsx` as a named export only — no barrel.
- **Mobile sidebar**: `isMobile` from `useSidebar()` — existing pattern already handles this. Keep `side={isMobile ? "bottom" : "right"}` on project/org dropdowns.
- **`SidebarHeader` padding**: Current sidebar uses `px-0` on `<Sidebar>`. Add `px-2 pt-2` on `SidebarHeader` or use individual `px-2` on each selector to match the existing item padding.
