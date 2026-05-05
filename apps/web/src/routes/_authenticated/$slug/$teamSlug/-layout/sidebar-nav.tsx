import { FeatureStageBadge } from "@/components/blocks/feature-stage-badge";
import {
   Collapsible,
   CollapsibleContent,
   CollapsibleTrigger,
} from "@packages/ui/components/collapsible";
import { Checkbox } from "@packages/ui/components/checkbox";
import {
   SidebarGroup,
   SidebarGroupContent,
   SidebarGroupLabel,
   SidebarMenu,
   SidebarMenuButton,
   SidebarMenuItem,
   useSidebar,
} from "@packages/ui/components/sidebar";
import {
   Tooltip,
   TooltipContent,
   TooltipTrigger,
} from "@packages/ui/components/tooltip";
import { cn } from "@packages/ui/lib/utils";
import { Link, useMatchRoute } from "@tanstack/react-router";
import {
   Check,
   ChevronRight,
   FolderOpen,
   LayoutGrid,
   Pencil,
} from "lucide-react";
import { useDashboardSlugs } from "@/hooks/use-dashboard-slugs";
import { useEarlyAccess } from "@/hooks/use-early-access";
import {
   setNavEditing,
   setSectionOpen,
   toggleFinanceNavPref,
   toggleHiddenItem,
   useIsEditingNav,
   useIsFinanceItemWanted,
   useIsItemVisible,
   useIsSectionOpen,
} from "./hooks/use-sidebar-store";
import type { NavGroupDef, NavItemDef } from "./sidebar-nav-items";
import { navGroups } from "./sidebar-nav-items";

function NavItem({
   item,
   slug,
   teamSlug,
}: {
   item: NavItemDef;
   slug: string;
   teamSlug: string;
}) {
   const { getFeatureStage } = useEarlyAccess();
   const matchRoute = useMatchRoute();

   const Icon = item.icon;
   const stage = item.earlyAccessFlag
      ? getFeatureStage(item.earlyAccessFlag)
      : null;
   const isActive = Boolean(
      matchRoute({ to: item.route, params: { slug, teamSlug }, fuzzy: true }),
   );

   const tooltip = stage
      ? {
           children: (
              <span className="flex items-center gap-2">
                 {item.label}
                 <FeatureStageBadge isTooltip stage={stage} />
              </span>
           ),
        }
      : item.label;

   return (
      <SidebarMenuItem
         className="group/menu-item"
         id={`tour-nav-item-${item.id}`}
      >
         <SidebarMenuButton asChild isActive={isActive} tooltip={tooltip}>
            <Link params={{ slug, teamSlug }} to={item.route}>
               <Icon className={cn(item.iconColor)} />
               <span className="flex-1">{item.label}</span>
               {stage && (
                  <FeatureStageBadge
                     className="group-data-[collapsible=icon]:hidden"
                     stage={stage}
                  />
               )}
            </Link>
         </SidebarMenuButton>
      </SidebarMenuItem>
   );
}

function EditableNavItem({ item }: { item: NavItemDef }) {
   const { isEnrolled, updateEnrollment, getFeatureStage } = useEarlyAccess();
   const isVisible = useIsItemVisible();
   const isWanted = useIsFinanceItemWanted();

   const Icon = item.icon;
   const stage = item.earlyAccessFlag
      ? getFeatureStage(item.earlyAccessFlag)
      : null;
   const checked = item.earlyAccessFlag
      ? isWanted(item.id) || isEnrolled(item.earlyAccessFlag)
      : isVisible(item.id);

   function handleToggle() {
      if (item.earlyAccessFlag) {
         toggleFinanceNavPref(item.id);
         updateEnrollment(item.earlyAccessFlag, !checked);
         return;
      }
      toggleHiddenItem(item.id);
   }

   return (
      <SidebarMenuItem>
         <SidebarMenuButton aria-pressed={checked} onClick={handleToggle}>
            <Checkbox
               aria-hidden="true"
               checked={checked}
               className="pointer-events-none shrink-0"
               tabIndex={-1}
            />
            <Icon
               aria-hidden="true"
               className={cn(
                  "shrink-0",
                  item.iconColor ?? "text-muted-foreground",
               )}
            />
            <span className="flex-1 truncate">{item.label}</span>
            {stage && <FeatureStageBadge stage={stage} />}
         </SidebarMenuButton>
      </SidebarMenuItem>
   );
}

function useVisibleItems(group: NavGroupDef) {
   const { isEnrolled } = useEarlyAccess();
   const isVisible = useIsItemVisible();
   const isWanted = useIsFinanceItemWanted();

   return group.items
      .filter((item) => {
         if (!item.earlyAccessFlag) return true;
         if (group.label)
            return isWanted(item.id) || isEnrolled(item.earlyAccessFlag);
         return isEnrolled(item.earlyAccessFlag);
      })
      .filter((item) => isVisible(item.id));
}

function useEditableItems(group: NavGroupDef) {
   const { isEnrolled } = useEarlyAccess();

   return group.items.filter(
      (item) =>
         item.configurable &&
         (!item.earlyAccessFlag || isEnrolled(item.earlyAccessFlag)),
   );
}

function NavSection({ group }: { group: NavGroupDef }) {
   const { slug, teamSlug } = useDashboardSlugs();
   const isEditingNav = useIsEditingNav();
   const sidebar = useSidebar();
   const sectionId = `nav:${group.id}`;
   const isOpen = useIsSectionOpen(sectionId, true);
   const visibleItems = useVisibleItems(group);
   const editableItems = useEditableItems(group);

   if (!isEditingNav && visibleItems.length === 0) return null;

   const isMain = !group.label;
   const collapsibleOpen = sidebar.state === "collapsed" || isOpen;

   return (
      <Collapsible
         className={isMain ? "group/projeto" : "group/group"}
         onOpenChange={(open) => setSectionOpen(sectionId, open)}
         open={collapsibleOpen}
      >
         <SidebarGroup className={isMain ? "py-0" : "pt-0"}>
            {isMain ? (
               <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">
                  <CollapsibleTrigger className="flex cursor-pointer items-center gap-2 transition-colors duration-150 hover:text-foreground">
                     <FolderOpen
                        aria-hidden="true"
                        className="size-4 shrink-0"
                     />
                     <span className="text-sm font-semibold uppercase tracking-wider">
                        Projeto
                     </span>
                     <ChevronRight
                        aria-hidden="true"
                        className="size-4 transition-transform duration-200 group-data-[state=open]/projeto:rotate-90"
                     />
                  </CollapsibleTrigger>
               </SidebarGroupLabel>
            ) : (
               <SidebarGroupLabel className="text-sm group-data-[collapsible=icon]:hidden">
                  {group.label}
               </SidebarGroupLabel>
            )}
            <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
               <SidebarGroupContent>
                  <SidebarMenu>
                     {isEditingNav && !isMain
                        ? editableItems.map((item) => (
                             <EditableNavItem item={item} key={item.id} />
                          ))
                        : visibleItems.map((item) => (
                             <NavItem
                                item={item}
                                key={item.id}
                                slug={slug}
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

export function SidebarNav() {
   const isEditingNav = useIsEditingNav();
   const sidebar = useSidebar();
   const isOpen = useIsSectionOpen("nav:modules-header", true);

   const mainGroup = navGroups.find((g) => !g.label);
   const moduleGroups = navGroups.filter((g) => g.label);
   const collapsibleOpen = sidebar.state === "collapsed" || isOpen;

   return (
      <>
         {mainGroup && <NavSection group={mainGroup} />}
         <Collapsible
            className="group/modules"
            onOpenChange={(open) => setSectionOpen("nav:modules-header", open)}
            open={collapsibleOpen}
         >
            <SidebarGroup className="p-0">
               <SidebarGroupLabel className="justify-between px-4 group-data-[collapsible=icon]:hidden">
                  <CollapsibleTrigger className="flex cursor-pointer items-center gap-2 transition-colors duration-150 hover:text-foreground">
                     <LayoutGrid
                        aria-hidden="true"
                        className="size-4 shrink-0"
                     />
                     <span className="text-sm font-semibold uppercase tracking-wider">
                        Módulos
                     </span>
                     <ChevronRight
                        aria-hidden="true"
                        className="size-4 transition-transform duration-200 group-data-[state=open]/modules:rotate-90"
                     />
                  </CollapsibleTrigger>
                  <Tooltip>
                     <TooltipTrigger asChild>
                        <button
                           aria-label={
                              isEditingNav
                                 ? "Concluir edição"
                                 : "Personalizar módulos"
                           }
                           aria-pressed={isEditingNav}
                           className="flex size-4 items-center justify-center rounded text-muted-foreground transition-colors duration-150 hover:bg-sidebar-accent hover:text-foreground"
                           onClick={() => setNavEditing(!isEditingNav)}
                           type="button"
                        >
                           {isEditingNav ? (
                              <Check
                                 aria-hidden="true"
                                 className="size-4 text-primary"
                              />
                           ) : (
                              <Pencil aria-hidden="true" className="size-4" />
                           )}
                        </button>
                     </TooltipTrigger>
                     <TooltipContent side="right">
                        {isEditingNav
                           ? "Concluir edição"
                           : "Personalizar módulos"}
                     </TooltipContent>
                  </Tooltip>
               </SidebarGroupLabel>
               <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                  {moduleGroups.map((group) => (
                     <NavSection group={group} key={group.id} />
                  ))}
               </CollapsibleContent>
            </SidebarGroup>
         </Collapsible>
      </>
   );
}
