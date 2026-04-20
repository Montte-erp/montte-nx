// apps/web/src/layout/dashboard/sidebar-nav.tsx

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
   SidebarMenuSub,
   SidebarMenuSubButton,
   SidebarMenuSubItem,
   useSidebarManager,
} from "@packages/ui/components/sidebar";
import {
   Link,
   useLocation,
   useParams,
   useRouter,
} from "@tanstack/react-router";
import { cn } from "@packages/ui/lib/utils";
import { Check, ChevronRight, Pencil, X } from "lucide-react";
import { useCallback, useState } from "react";
import { useEarlyAccess } from "@/hooks/use-early-access";
import {
   useFinanceNavPreferences,
   setActiveSection,
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
                  <Icon />
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
                  <Icon />
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

function CollapsibleNavItem({
   item,
   slug,
   teamSlug,
   isItemActive,
   onMainItemClick,
}: {
   item: NavItemDef;
   slug: string;
   teamSlug?: string | null;
   isItemActive: (item: NavItemDef) => boolean;
   onMainItemClick: () => void;
}) {
   const { isVisible } = useSidebarVisibility();
   const Icon = item.icon;
   const visibleChildren = (item.children ?? []).filter((child) =>
      isVisible(child.id),
   );
   const anyChildActive = visibleChildren.some(isItemActive);

   if (visibleChildren.length === 0) return null;

   return (
      <Collapsible asChild className="group/collapsible" defaultOpen>
         <SidebarMenuItem>
            <CollapsibleTrigger asChild>
               <SidebarMenuButton
                  isActive={anyChildActive}
                  tooltip={item.label}
               >
                  <Icon />
                  <span>{item.label}</span>
                  <span className="flex-1" />
                  <ChevronRight className="size-3.5 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 group-data-[collapsible=icon]:hidden" />
               </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
               <SidebarMenuSub>
                  {visibleChildren.map((child) => (
                     <SidebarMenuSubItem key={child.id}>
                        <SidebarMenuSubButton
                           asChild
                           isActive={isItemActive(child)}
                        >
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

   const mainGroup = navGroups.find((g) => !g.label);
   const visibleMainItems = (mainGroup?.items ?? [])
      .filter((item) => {
         if (!item.earlyAccessFlag) return true;
         return isEnrolled(item.earlyAccessFlag);
      })
      .filter((item) => isVisible(item.id));

   const resolvedSlug = slug || pathname.split("/")[1] || "";

   return (
      <Collapsible defaultOpen className="group/projeto">
         <SidebarGroup className="py-0">
            <SidebarGroupLabel
               asChild
               className="justify-between pr-2 group-data-[collapsible=icon]:hidden"
            >
               <CollapsibleTrigger className="w-full cursor-pointer transition-colors duration-150 hover:text-foreground">
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
   const [isEditing, setIsEditing] = useState(false);

   const visibleItems = group.items
      .filter((item) => {
         if (!item.earlyAccessFlag) return true;
         if (group.label)
            return isWanted(item.id) || isEnrolled(item.earlyAccessFlag);
         return isEnrolled(item.earlyAccessFlag);
      })
      .filter((item) => isVisible(item.id));

   if (visibleItems.length === 0 && !group.label) return null;

   const editableItems = group.items.filter(
      (item) =>
         item.configurable &&
         (!item.earlyAccessFlag || isEnrolled(item.earlyAccessFlag)),
   );

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
      <Collapsible defaultOpen className="group/nav-group pt-0">
         <SidebarGroup className="pt-0">
            {group.label && (
               <SidebarGroupLabel asChild className="justify-between pr-1">
                  <CollapsibleTrigger className="w-full cursor-pointer transition-colors duration-150 hover:text-foreground">
                     <span>{group.label}</span>
                     <div className="flex items-center gap-1">
                        {!isEditing && editableItems.length > 0 && (
                           <button
                              className="text-muted-foreground hover:text-foreground group-data-[collapsible=icon]:hidden"
                              onClick={(e) => {
                                 e.stopPropagation();
                                 setIsEditing(true);
                              }}
                              type="button"
                           >
                              <Pencil className="size-3.5" />
                           </button>
                        )}
                        {isEditing && (
                           <>
                              <button
                                 className="text-emerald-600 hover:text-emerald-700"
                                 onClick={(e) => {
                                    e.stopPropagation();
                                    setIsEditing(false);
                                 }}
                                 type="button"
                              >
                                 <Check className="size-3.5" />
                              </button>
                              <button
                                 className="text-muted-foreground hover:text-foreground"
                                 onClick={(e) => {
                                    e.stopPropagation();
                                    setIsEditing(false);
                                 }}
                                 type="button"
                              >
                                 <X className="size-3.5" />
                              </button>
                           </>
                        )}
                        <ChevronRight className="size-3 transition-transform duration-200 group-data-[state=open]/nav-group:rotate-90 group-data-[collapsible=icon]:hidden" />
                     </div>
                  </CollapsibleTrigger>
               </SidebarGroupLabel>
            )}
            <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
               {isEditing ? (
                  <SidebarGroupContent>
                     <SidebarMenu>
                        {editableItems.map((item) => {
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
                                    <Icon className="size-4 shrink-0 text-muted-foreground" />
                                    <span className="truncate">
                                       {item.label}
                                    </span>
                                 </button>
                              </SidebarMenuItem>
                           );
                        })}
                     </SidebarMenu>
                  </SidebarGroupContent>
               ) : (
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
               )}
            </CollapsibleContent>
         </SidebarGroup>
      </Collapsible>
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

   return (
      <>
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
      </>
   );
}
