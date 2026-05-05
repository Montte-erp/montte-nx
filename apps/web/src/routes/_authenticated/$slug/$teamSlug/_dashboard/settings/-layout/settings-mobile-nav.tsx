import { Input } from "@packages/ui/components/input";
import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { QuickAccessCard } from "@/components/blocks/quick-access-card";
import { useDashboardSlugs } from "@/hooks/use-dashboard-slugs";
import { useEarlyAccess } from "@/hooks/use-early-access";
import { Route } from "@/routes/_authenticated/$slug/$teamSlug/_dashboard/settings";
import {
   type SettingsNavItemDef,
   settingsNavSections,
} from "./settings-nav-items";

function flattenItems(items: SettingsNavItemDef[]): SettingsNavItemDef[] {
   return items.flatMap((item) => item.children ?? [item]);
}

export function SettingsMobileNav() {
   const { slug, teamSlug } = useDashboardSlugs();
   const { isEnrolled } = useEarlyAccess();
   const navigate = useNavigate();
   const { q } = Route.useSearch();
   const setQ = Route.useNavigate();

   const query = q.toLowerCase();

   return (
      <div className="flex flex-col gap-4">
         <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-2 size-4 text-muted-foreground" />
            <Input
               className="h-8 pl-8 text-sm"
               onChange={(e) =>
                  setQ({
                     search: (prev) => ({ ...prev, q: e.target.value }),
                     replace: true,
                  })
               }
               placeholder="Pesquisar configurações..."
               value={q}
            />
         </div>

         {settingsNavSections
            .filter((section) => section.id !== "organization")
            .map((section) => {
               const filtered = flattenItems(section.items)
                  .filter(
                     (item) =>
                        !query || item.title.toLowerCase().includes(query),
                  )
                  .filter(
                     (item) =>
                        !item.earlyAccessFlag ||
                        isEnrolled(item.earlyAccessFlag),
                  );

               if (filtered.length === 0) return null;

               return (
                  <div className="flex flex-col gap-2" key={section.id}>
                     <h2 className="px-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                        {section.label}
                     </h2>
                     <div className="grid gap-2">
                        {filtered.map((item) => (
                           <QuickAccessCard
                              description=""
                              icon={
                                 item.icon ? (
                                    <item.icon className="size-4" />
                                 ) : undefined
                              }
                              key={item.id}
                              onClick={() =>
                                 navigate({
                                    params: { slug, teamSlug },
                                    to: item.href,
                                 })
                              }
                              title={item.title}
                           />
                        ))}
                     </div>
                  </div>
               );
            })}
      </div>
   );
}
