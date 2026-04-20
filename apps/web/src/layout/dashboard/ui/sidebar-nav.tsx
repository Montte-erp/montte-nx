import { FeatureStageBadge } from "@/components/blocks/feature-stage-badge";
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
   useSidebarManager,
} from "@packages/ui/components/sidebar";
import {
   Tooltip,
   TooltipContent,
   TooltipTrigger,
} from "@packages/ui/components/tooltip";
import { cn } from "@packages/ui/lib/utils";
import {
   Link,
   useLocation,
   useParams,
   useRouter,
} from "@tanstack/react-router";
import {
   Check,
   ChevronRight,
   FolderOpen,
   LayoutGrid,
   Pencil,
} from "lucide-react";
import { useCallback, useState } from "react";
import { useEarlyAccess } from "@/hooks/use-early-access";
import {
   setActiveSection,
   setNavEditing,
   useFinanceNavPreferences,
   useSidebarNav,
   useSidebarVisibility,
} from "@/layout/dashboard/hooks/use-sidebar-store";
import type { SubSidebarSection } from "@/layout/dashboard/hooks/use-sidebar-store";
import type {
   NavGroupDef,
   NavItemDef,
} from "@/layout/dashboard/ui/sidebar-nav-items";
import { navGroups } from "@/layout/dashboard/ui/sidebar-nav-items";

function NavItem({
   item,
   slug,
   teamSlug,
   isActive,
   onSubPanelToggle,
   onMainItemClick,
}: {
   item: NavItemDef;
   slug: string;
   teamSlug?: string | null;
   isActive: boolean;
   onSubPanelToggle: (section: SubSidebarSection) => void;
   onMainItemClick: () => void;
}) {
   const Icon = item.icon;
   const { getFeatureStage } = useEarlyAccess();
   const stage = item.earlyAccessFlag
      ? getFeatureStage(item.earlyAccessFlag)
      : null;

   const handleClick = useCallback(
      (e: React.MouseEvent) => {
         if (item.subPanel) {
            e.preventDefault();
            onSubPanelToggle(item.subPanel);
         }
      },
      [item.subPanel, onSubPanelToggle],
   );

   return (
      <SidebarMenuItem className="group/menu-item">
         <SidebarMenuButton
            asChild={!item.subPanel}
            isActive={isActive}
            onClick={item.subPanel ? handleClick : undefined}
            tooltip={
               stage
                  ? {
                       children: (
                          <span className="flex items-center gap-1.5">
                             {item.label}
                             <FeatureStageBadge isTooltip stage={stage} />
                          </span>
                       ),
                    }
                  : item.label
            }
         >
            {item.subPanel ? (
               <>
                  <Icon className={cn(item.iconColor)} />
                  <span>{item.label}</span>
                  {stage && (
                     <FeatureStageBadge
                        className="ml-auto group-data-[collapsible=icon]:hidden"
                        stage={stage}
                     />
                  )}
                  <ChevronRight className="size-3.5 text-muted-foreground group-data-[collapsible=icon]:hidden" />
               </>
            ) : (
               <Link
                  onClick={onMainItemClick}
                  params={{ slug, teamSlug: teamSlug ?? "" }}
                  to={item.route}
               >
                  <Icon className={cn(item.iconColor)} />
                  <span>{item.label}</span>
                  {stage && (
                     <FeatureStageBadge
                        className="ml-auto group-data-[collapsible=icon]:hidden"
                        stage={stage}
                     />
                  )}
               </Link>
            )}
         </SidebarMenuButton>
      </SidebarMenuItem>
   );
}

function useNavHandlers() {
   const { pathname, searchStr } = useLocation();
   const { slug, teamSlug } = useParams({
      from: "/_authenticated/$slug/$teamSlug/_dashboard",
   });
   const { activeSection } = useSidebarNav();
   const router = useRouter();
   const manager = useSidebarManager();

   const handleSubPanelToggle = useCallback(
      (section: SubSidebarSection) => {
         const subPanel = manager.use("sub-panel");
         if (activeSection === section && subPanel?.open) {
            subPanel.setOpen(false);
            setActiveSection(null);
         } else {
            setActiveSection(section);
            if (subPanel && !subPanel.open) {
               subPanel.setOpen(true);
            }
         }
      },
      [manager, activeSection],
   );

   const handleMainItemClick = useCallback(() => {
      const subPanel = manager.use("sub-panel");
      if (subPanel?.open) {
         subPanel.setOpen(false);
      }
      if (activeSection) {
         setActiveSection(null);
      }
   }, [manager, activeSection]);

   const isItemActive = useCallback(
      (item: NavItemDef) => {
         const { pathname: routePath } = router.buildLocation({
            to: item.route,
            params: { slug, teamSlug: teamSlug ?? undefined },
         });

         if (item.subPanel) {
            return (
               activeSection === item.subPanel || pathname.startsWith(routePath)
            );
         }

         return pathname.startsWith(routePath) && !searchStr;
      },
      [router, slug, teamSlug, pathname, searchStr, activeSection],
   );

   return {
      slug,
      teamSlug,
      handleSubPanelToggle,
      handleMainItemClick,
      isItemActive,
   };
}

export function SidebarDefaultItems() {
   const {
      slug,
      teamSlug,
      handleSubPanelToggle,
      handleMainItemClick,
      isItemActive,
   } = useNavHandlers();
   const { pathname } = useLocation();
   const { isEnrolled } = useEarlyAccess();
   const { isVisible } = useSidebarVisibility();
   const { state: sidebarState } = useSidebar();
   const [open, setOpen] = useState(true);

   const mainGroup = navGroups.find((g) => !g.label);
   const visibleMainItems = (mainGroup?.items ?? [])
      .filter((item) => {
         if (!item.earlyAccessFlag) return true;
         return isEnrolled(item.earlyAccessFlag);
      })
      .filter((item) => isVisible(item.id));

   const resolvedSlug = slug || pathname.split("/")[1] || "";

   return (
      <Collapsible
         className="group/projeto"
         open={sidebarState === "collapsed" || open}
         onOpenChange={setOpen}
      >
         <SidebarGroup className="py-0">
            <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">
               <CollapsibleTrigger className="flex cursor-pointer items-center gap-1.5 transition-colors duration-150 hover:text-foreground">
                  <FolderOpen className="size-3.5 shrink-0" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider">
                     Projeto
                  </span>
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

function NavGroup({
   group,
   slug,
   teamSlug,
   isItemActive,
   onSubPanelToggle,
   onMainItemClick,
}: {
   group: NavGroupDef;
   slug: string;
   teamSlug?: string | null;
   isItemActive: (item: NavItemDef) => boolean;
   onSubPanelToggle: (section: SubSidebarSection) => void;
   onMainItemClick: () => void;
}) {
   const { isEnrolled, updateEnrollment } = useEarlyAccess();
   const { isVisible, toggleItem: toggleVisibility } = useSidebarVisibility();
   const { isWanted, toggleItem: toggleWanted } = useFinanceNavPreferences();
   const { isEditingNav } = useSidebarNav();

   const visibleItems = group.items
      .filter((item) => {
         if (!item.earlyAccessFlag) return true;
         if (group.label)
            return isWanted(item.id) || isEnrolled(item.earlyAccessFlag);
         return isEnrolled(item.earlyAccessFlag);
      })
      .filter((item) => isVisible(item.id));

   const editableItems = group.items.filter(
      (item) =>
         item.configurable &&
         (!item.earlyAccessFlag || isEnrolled(item.earlyAccessFlag)),
   );

   if (!isEditingNav && visibleItems.length === 0) return null;

   const isChecked = (item: NavItemDef): boolean => {
      if (item.earlyAccessFlag) {
         return isWanted(item.id) || isEnrolled(item.earlyAccessFlag);
      }
      return isVisible(item.id);
   };

   const handleToggle = (item: NavItemDef) => {
      if (item.earlyAccessFlag) {
         const newValue = !isChecked(item);
         toggleWanted(item.id);
         updateEnrollment(item.earlyAccessFlag, newValue);
      } else {
         toggleVisibility(item.id);
      }
   };

   return (
      <SidebarGroup className="pt-0">
         {group.label && (
            <SidebarGroupLabel className="text-[11px] group-data-[collapsible=icon]:hidden">
               {group.label}
            </SidebarGroupLabel>
         )}
         <SidebarGroupContent>
            <SidebarMenu>
               {isEditingNav
                  ? editableItems.map((item) => {
                       const Icon = item.icon;
                       const checked = isChecked(item);
                       return (
                          <SidebarMenuItem key={item.id}>
                             <button
                                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors duration-150 hover:bg-sidebar-accent"
                                onClick={() => handleToggle(item)}
                                type="button"
                             >
                                <div
                                   className={cn(
                                      "flex size-4 shrink-0 items-center justify-center rounded-sm border transition-colors duration-150",
                                      checked
                                         ? "border-primary bg-primary text-primary-foreground"
                                         : "border-muted-foreground",
                                   )}
                                >
                                   {checked && <Check className="size-3" />}
                                </div>
                                <Icon
                                   className={cn(
                                      "size-4 shrink-0",
                                      item.iconColor ?? "text-muted-foreground",
                                   )}
                                />
                                <span className="truncate">{item.label}</span>
                             </button>
                          </SidebarMenuItem>
                       );
                    })
                  : visibleItems.map((item) => (
                       <NavItem
                          isActive={isItemActive(item)}
                          item={item}
                          key={item.id}
                          onMainItemClick={onMainItemClick}
                          onSubPanelToggle={onSubPanelToggle}
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
   const {
      slug,
      teamSlug,
      handleSubPanelToggle,
      handleMainItemClick,
      isItemActive,
   } = useNavHandlers();
   const { isEditingNav } = useSidebarNav();
   const { state: sidebarState } = useSidebar();
   const [open, setOpen] = useState(true);

   return (
      <Collapsible
         className="group/modules"
         open={sidebarState === "collapsed" || open}
         onOpenChange={setOpen}
      >
         <SidebarGroup className="p-0">
            <SidebarGroupLabel className="justify-between px-2 pr-2 group-data-[collapsible=icon]:hidden">
               <CollapsibleTrigger className="flex cursor-pointer items-center gap-1.5 transition-colors duration-150 hover:text-foreground">
                  <LayoutGrid className="size-3.5 shrink-0" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider">
                     Módulos
                  </span>
                  <ChevronRight className="size-3 transition-transform duration-200 group-data-[state=open]/modules:rotate-90" />
               </CollapsibleTrigger>
               <Tooltip>
                  <TooltipTrigger asChild>
                     <button
                        className="flex size-5 items-center justify-center rounded text-muted-foreground transition-colors duration-150 hover:bg-sidebar-accent hover:text-foreground"
                        onClick={() => setNavEditing(!isEditingNav)}
                        type="button"
                     >
                        {isEditingNav ? (
                           <Check className="size-3.5 text-primary" />
                        ) : (
                           <Pencil className="size-3.5" />
                        )}
                     </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                     {isEditingNav ? "Concluir edição" : "Personalizar módulos"}
                  </TooltipContent>
               </Tooltip>
            </SidebarGroupLabel>
            <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
               {navGroups
                  .filter((g) => g.id !== "main")
                  .map((group) => (
                     <NavGroup
                        group={group}
                        isItemActive={isItemActive}
                        key={group.id}
                        onMainItemClick={handleMainItemClick}
                        onSubPanelToggle={handleSubPanelToggle}
                        slug={slug}
                        teamSlug={teamSlug ?? undefined}
                     />
                  ))}
            </CollapsibleContent>
         </SidebarGroup>
      </Collapsible>
   );
}
