// apps/web/src/layout/dashboard/sidebar-nav.tsx

import { FeatureStageBadge } from "@packages/ui/components/feature-stage-badge";
import {
   SidebarGroup,
   SidebarGroupContent,
   SidebarGroupLabel,
   SidebarMenu,
   SidebarMenuButton,
   SidebarMenuItem,
   useSidebarManager,
} from "@packages/ui/components/sidebar";
import {
   Link,
   useLocation,
   useNavigate,
   useParams,
   useRouter,
} from "@tanstack/react-router";
import { ChevronRight, Search, Settings2 } from "lucide-react";
import { useCallback } from "react";
import { useCredenza } from "@/hooks/use-credenza";
import { useEarlyAccess } from "@/hooks/use-early-access";
import { useFinanceNavPreferences } from "@/layout/dashboard/hooks/use-finance-nav-preferences";
import type { SubSidebarSection } from "@/layout/dashboard/hooks/use-sidebar-nav";
import {
   setActiveSection,
   useSidebarNav,
} from "@/layout/dashboard/hooks/use-sidebar-nav";
import { useSidebarVisibility } from "@/layout/dashboard/hooks/use-sidebar-visibility";
import { SidebarNavConfigForm } from "@/layout/dashboard/ui/sidebar-nav-config-form";
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
   const navigate = useNavigate();
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

   const handleSearch = useCallback(() => {
      navigate({
         to: "/$slug/$teamSlug/search",
         params: { slug: resolvedSlug, teamSlug: teamSlug ?? "" },
      });
   }, [navigate, resolvedSlug, teamSlug]);

   return (
      <SidebarGroup className="py-0">
         <SidebarGroupContent>
            <SidebarMenu>
               <SidebarMenuItem>
                  <SidebarMenuButton onClick={handleSearch} tooltip="Pesquisar">
                     <Search />
                     <span>Pesquisar</span>
                  </SidebarMenuButton>
               </SidebarMenuItem>

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
      </SidebarGroup>
   );
}

function NavGroup({
   group,
   slug,
   teamSlug,
   isItemActive,
   onSubPanelToggle,
   onMainItemClick,
   onConfigure,
}: {
   group: NavGroupDef;
   slug: string;
   teamSlug?: string | null;
   isItemActive: (item: NavItemDef) => boolean;
   onSubPanelToggle: (section: SubSidebarSection) => void;
   onMainItemClick: () => void;
   onConfigure?: () => void;
}) {
   const { isEnrolled } = useEarlyAccess();
   const { isVisible } = useSidebarVisibility();
   const { isWanted } = useFinanceNavPreferences();

   const visibleItems = group.items
      .filter((item) => {
         if (!item.earlyAccessFlag) return true;
         // Labeled groups (finance, erp) use the finance nav preferences hook,
         // falling back to enrollment so existing enrolled users aren't affected.
         if (group.label)
            return isWanted(item.id) || isEnrolled(item.earlyAccessFlag);
         return isEnrolled(item.earlyAccessFlag);
      })
      .filter((item) => isVisible(item.id));

   if (visibleItems.length === 0 && !onConfigure) return null;

   return (
      <SidebarGroup className="group/nav-group pt-0">
         {group.label && (
            <SidebarGroupLabel className="justify-between pr-1">
               <span>{group.label}</span>
               {onConfigure && (
                  <button
                     className="text-muted-foreground hover:text-foreground group-data-[collapsible=icon]:hidden"
                     onClick={onConfigure}
                     type="button"
                  >
                     <Settings2 className="size-3.5" />
                  </button>
               )}
            </SidebarGroupLabel>
         )}
         <SidebarGroupContent>
            <SidebarMenu>
               {visibleItems.map((item) => (
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
   const { openCredenza, closeCredenza } = useCredenza();

   const handleConfigure = useCallback(() => {
      openCredenza({
         children: <SidebarNavConfigForm onClose={closeCredenza} />,
      });
   }, [openCredenza, closeCredenza]);

   return (
      <>
         {navGroups
            .filter((g) => g.id !== "main")
            .map((group) => (
               <NavGroup
                  group={group}
                  isItemActive={isItemActive}
                  key={group.id}
                  onConfigure={
                     group.id === "finance" ? handleConfigure : undefined
                  }
                  onMainItemClick={handleMainItemClick}
                  onSubPanelToggle={handleSubPanelToggle}
                  slug={slug}
                  teamSlug={teamSlug ?? undefined}
               />
            ))}
      </>
   );
}
