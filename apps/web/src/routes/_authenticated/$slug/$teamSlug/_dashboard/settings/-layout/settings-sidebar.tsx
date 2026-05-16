import {
   Collapsible,
   CollapsibleContent,
   CollapsibleTrigger,
} from "@packages/ui/components/collapsible";
import {
   SidebarGroup,
   SidebarGroupContent,
   SidebarMenu,
   SidebarMenuButton,
   SidebarMenuItem,
   SidebarMenuSub,
   SidebarMenuSubButton,
   SidebarMenuSubItem,
} from "@packages/ui/components/sidebar";
import { cn } from "@packages/ui/lib/utils";
import { Link, useMatchRoute } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { useDashboardSlugs } from "@/hooks/use-dashboard-slugs";
import {
   setSectionOpen,
   useIsSectionOpen,
} from "@/routes/_authenticated/$slug/$teamSlug/-layout/hooks/use-sidebar-store";
import {
   type SettingsNavItemDef,
   type SettingsNavSection,
   settingsNavSections,
} from "./settings-nav-items";

function matchesSearch(item: SettingsNavItemDef, query: string): boolean {
   const q = query.toLowerCase();
   if (item.title.toLowerCase().includes(q)) return true;
   return Boolean(
      item.children?.some((child) => child.title.toLowerCase().includes(q)),
   );
}

function filterSection(
   section: SettingsNavSection,
   query: string,
): SettingsNavSection {
   if (!query) return section;
   return {
      ...section,
      items: section.items.filter((item) => matchesSearch(item, query)),
   };
}

function useIsHrefActive() {
   const matchRoute = useMatchRoute();
   const { slug, teamSlug } = useDashboardSlugs();
   return (href: string) =>
      Boolean(matchRoute({ to: href, params: { slug, teamSlug } }));
}

function NavItemWithChildren({ item }: { item: SettingsNavItemDef }) {
   const { slug, teamSlug } = useDashboardSlugs();
   const isActive = useIsHrefActive();
   const sectionId = `settings:item:${item.id}`;
   const isUserOpen = useIsSectionOpen(sectionId, false);

   const visibleChildren = item.children;
   if (!visibleChildren || visibleChildren.length === 0) return null;

   const isChildActive = visibleChildren.some((child) => isActive(child.href));
   const isExpanded = isUserOpen || isChildActive;

   return (
      <Collapsible
         onOpenChange={(open) => setSectionOpen(sectionId, open)}
         open={isExpanded}
      >
         <SidebarMenuItem>
            <CollapsibleTrigger asChild>
               <SidebarMenuButton
                  className={cn(isChildActive && "text-primary")}
               >
                  {item.icon && <item.icon className="size-4" />}
                  <span>{item.title}</span>
                  <ChevronRight
                     className={cn(
                        "ml-auto size-4 transition-transform",
                        isExpanded && "rotate-90",
                     )}
                  />
               </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
               <SidebarMenuSub>
                  {visibleChildren.map((child) => (
                     <SidebarMenuSubItem key={child.id}>
                        <SidebarMenuSubButton
                           asChild
                           className={cn(
                              isActive(child.href) &&
                                 "bg-primary/10 text-primary",
                           )}
                        >
                           <Link params={{ slug, teamSlug }} to={child.href}>
                              <span>{child.title}</span>
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

function NavItem({ item }: { item: SettingsNavItemDef }) {
   const { slug, teamSlug } = useDashboardSlugs();
   const isActive = useIsHrefActive();

   if (item.children?.length) return <NavItemWithChildren item={item} />;

   if (item.external) {
      return (
         <SidebarMenuItem>
            <SidebarMenuButton asChild>
               <Link params={{ slug, teamSlug }} to={item.href}>
                  {item.icon && <item.icon className="size-4" />}
                  <span>{item.title}</span>
                  <ExternalLink className="ml-auto size-4 text-muted-foreground" />
               </Link>
            </SidebarMenuButton>
         </SidebarMenuItem>
      );
   }

   return (
      <SidebarMenuItem>
         <SidebarMenuButton
            asChild
            className={cn(
               isActive(item.href) && "rounded-lg bg-primary/10 text-primary",
               item.danger && "text-destructive hover:text-destructive",
            )}
         >
            <Link params={{ slug, teamSlug }} to={item.href}>
               {item.icon && <item.icon className="size-4" />}
               <span>{item.title}</span>
            </Link>
         </SidebarMenuButton>
      </SidebarMenuItem>
   );
}

function NavSection({
   section,
   forceOpen,
}: {
   section: SettingsNavSection;
   forceOpen: boolean;
}) {
   const sectionId = `settings:section:${section.id}`;
   const isOpen = useIsSectionOpen(sectionId, section.defaultOpen);
   const effectiveOpen = forceOpen || isOpen;

   if (section.items.length === 0) return null;

   return (
      <Collapsible
         onOpenChange={(open) => setSectionOpen(sectionId, open)}
         open={effectiveOpen}
      >
         <SidebarGroup className="py-0">
            <CollapsibleTrigger className="group flex w-full items-center justify-between px-4 py-2">
               <span className="text-sm font-semibold uppercase tracking-wider text-sidebar-foreground/70">
                  {section.label}
               </span>
               <ChevronDown
                  className={cn(
                     "size-4 text-sidebar-foreground/50 transition-transform",
                     !effectiveOpen && "-rotate-90",
                  )}
               />
            </CollapsibleTrigger>
            <CollapsibleContent>
               <SidebarGroupContent>
                  <SidebarMenu>
                     {section.items.map((item) => (
                        <NavItem item={item} key={item.id} />
                     ))}
                  </SidebarMenu>
               </SidebarGroupContent>
            </CollapsibleContent>
         </SidebarGroup>
      </Collapsible>
   );
}

export function SettingsSidebar({ search }: { search: string }) {
   const filteredSections = settingsNavSections.map((section) =>
      filterSection(section, search),
   );

   return (
      <>
         {filteredSections.map((section) => (
            <NavSection
               forceOpen={search.length > 0}
               key={section.id}
               section={section}
            />
         ))}
      </>
   );
}
