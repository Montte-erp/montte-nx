import { FeatureStageBadge } from "@/components/blocks/feature-stage-badge";
import { Button } from "@packages/ui/components/button";
import {
   Collapsible,
   CollapsibleContent,
   CollapsibleTrigger,
} from "@packages/ui/components/collapsible";
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
import { ChevronRight, Pencil } from "lucide-react";
import { useMemo } from "react";
import { useCredenza } from "@/hooks/use-credenza";
import { useDashboardSlugs } from "@/hooks/use-dashboard-slugs";
import { useEarlyAccess } from "@/hooks/use-early-access";
import {
   setSectionOpen,
   useIsFinanceItemWanted,
   useIsItemVisible,
   useIsSectionOpen,
   useSidebarItemOrder,
} from "./hooks/use-sidebar-store";
import { SidebarCustomizeCredenza } from "./sidebar-customize-credenza";
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
         <SidebarMenuButton
            asChild
            className="h-7 rounded-md px-2 text-foreground data-[active=true]:bg-muted data-[active=true]:font-medium data-[active=true]:text-foreground"
            isActive={isActive}
            tooltip={tooltip}
         >
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

function getOrderedItems(items: NavItemDef[], itemOrder: string[]) {
   const itemMap = new Map(items.map((item) => [item.id, item]));
   const orderedItems = itemOrder.flatMap((itemId) => {
      const item = itemMap.get(itemId);
      return item ? [item] : [];
   });
   const newItems = items.filter((item) => !itemOrder.includes(item.id));

   return [...orderedItems, ...newItems];
}

function useVisibleItems(group: NavGroupDef) {
   const { isEnrolled } = useEarlyAccess();
   const isVisible = useIsItemVisible();
   const isWanted = useIsFinanceItemWanted();
   const itemOrder = useSidebarItemOrder(group.id);

   return useMemo(
      () =>
         getOrderedItems(group.items, itemOrder)
            .filter((item) => {
               if (!item.earlyAccessFlag) return true;
               if (group.label)
                  return isWanted(item.id) || isEnrolled(item.earlyAccessFlag);
               return isEnrolled(item.earlyAccessFlag);
            })
            .filter((item) => isVisible(item.id)),
      [group.items, group.label, isEnrolled, isVisible, isWanted, itemOrder],
   );
}

function NavSection({ group }: { group: NavGroupDef }) {
   const { slug, teamSlug } = useDashboardSlugs();
   const sidebar = useSidebar();
   const { openCredenza } = useCredenza();
   const sectionId = `nav:${group.id}`;
   const isOpen = useIsSectionOpen(sectionId, true);
   const visibleItems = useVisibleItems(group);

   if (visibleItems.length === 0) return null;

   const collapsibleOpen = sidebar.state === "collapsed" || isOpen;

   return (
      <Collapsible
         className="group/group"
         onOpenChange={(open) => setSectionOpen(sectionId, open)}
         open={collapsibleOpen}
      >
         <SidebarGroup className="pt-0">
            <SidebarGroupLabel className="h-7 justify-between px-2 text-xs font-medium text-muted-foreground group-data-[collapsible=icon]:hidden">
               <CollapsibleTrigger className="flex cursor-pointer items-center gap-2 transition-colors duration-150 hover:text-foreground">
                  {group.label}
                  <ChevronRight
                     aria-hidden="true"
                     className="size-4 transition-transform duration-200 group-data-[state=open]/group:rotate-90"
                  />
               </CollapsibleTrigger>
               <Tooltip>
                  <TooltipTrigger asChild>
                     <Button
                        aria-label="Customizar sidebar"
                        className="text-muted-foreground"
                        onClick={() =>
                           openCredenza({
                              className: "max-w-lg bg-background sm:max-w-lg",
                              renderChildren: () => (
                                 <SidebarCustomizeCredenza />
                              ),
                           })
                        }
                        size="icon-xs"
                        type="button"
                        variant="ghost"
                     >
                        <Pencil aria-hidden="true" className="size-4" />
                     </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                     Customizar sidebar
                  </TooltipContent>
               </Tooltip>
            </SidebarGroupLabel>
            <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
               <SidebarGroupContent>
                  <SidebarMenu>
                     {visibleItems.map((item) => (
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

function MainNavSection({ group }: { group: NavGroupDef }) {
   const { slug, teamSlug } = useDashboardSlugs();
   const visibleItems = useVisibleItems(group);

   if (visibleItems.length === 0) return null;

   return (
      <SidebarGroup className="py-0">
         <SidebarGroupContent>
            <SidebarMenu>
               {visibleItems.map((item) => (
                  <NavItem
                     item={item}
                     key={item.id}
                     slug={slug}
                     teamSlug={teamSlug}
                  />
               ))}
            </SidebarMenu>
         </SidebarGroupContent>
      </SidebarGroup>
   );
}

export function SidebarNav() {
   const mainGroup = navGroups.find((g) => !g.label);
   const moduleGroups = navGroups.filter((g) => g.label);

   return (
      <>
         {mainGroup && <MainNavSection group={mainGroup} />}
         {moduleGroups.map((group) => (
            <NavSection group={group} key={group.id} />
         ))}
      </>
   );
}
