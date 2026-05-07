import { Button } from "@packages/ui/components/button";
import { SearchInput } from "@packages/ui/components/search-input";
import {
   Sidebar,
   SidebarContent,
   SidebarHeader,
   SidebarInset,
   SidebarManager,
   SidebarProvider,
} from "@packages/ui/components/sidebar";
import { useMediaQuery } from "foxact/use-media-query";
import { Link, useMatches } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import type * as React from "react";
import { Route } from "@/routes/_authenticated/$slug/$teamSlug/_dashboard/settings";
import { useDashboardSlugs } from "@/hooks/use-dashboard-slugs";
import { SettingsMobileNav } from "./settings-mobile-nav";
import { SettingsSidebar } from "./settings-sidebar";

const SETTINGS_SIDEBAR_STYLE = {
   "--sidebar-width": "16rem",
   "--sidebar": "var(--muted)",
   "--sidebar-foreground": "var(--text-foreground)",
} as React.CSSProperties;

interface SettingsLayoutProps {
   children: React.ReactNode;
}

export function SettingsLayout({ children }: SettingsLayoutProps) {
   const isMobile = useMediaQuery("(max-width: 767px)", false);
   const matches = useMatches();
   const isIndexRoute = matches.at(-1)?.routeId.endsWith("/settings/");
   const { slug, teamSlug } = useDashboardSlugs();
   const { q } = Route.useSearch();
   const navigate = Route.useNavigate();

   if (isMobile && isIndexRoute) return <SettingsMobileNav />;

   if (isMobile) {
      return (
         <div className="flex h-full flex-col gap-4">
            <Button asChild className="w-fit" variant="ghost">
               <Link params={{ slug, teamSlug }} to="/$slug/$teamSlug/settings">
                  <ChevronLeft className="size-4" />
                  Configurações
               </Link>
            </Button>
            <div className="flex-1">{children}</div>
         </div>
      );
   }

   return (
      <SidebarProvider
         className="!absolute !inset-0 !min-h-0 !h-full border-l border-white/10 bg-sidebar shadow-xl"
         style={SETTINGS_SIDEBAR_STYLE}
      >
         <SidebarManager name="settings">
            <Sidebar className="border-r" collapsible="none">
               <SidebarHeader className="p-4">
                  <SearchInput
                     onChange={(e) =>
                        navigate({
                           search: (prev) => ({
                              ...prev,
                              q: e.target.value,
                           }),
                           replace: true,
                        })
                     }
                     placeholder="Pesquisar configurações..."
                     value={q}
                  />
               </SidebarHeader>
               <SidebarContent>
                  <SettingsSidebar search={q} />
               </SidebarContent>
            </Sidebar>
         </SidebarManager>
         <SidebarInset className="flex-1 overflow-y-auto">
            <main className="p-4">{children}</main>
         </SidebarInset>
      </SidebarProvider>
   );
}
