import { useHotkey } from "@tanstack/react-hotkeys";
import { useNavigate } from "@tanstack/react-router";
import { openCommandDialog } from "@/hooks/use-command-dialog";
import { useEarlyAccess } from "@/hooks/use-early-access";
import { useDashboardSlugs } from "@/hooks/use-dashboard-slugs";
import { useIsItemVisible } from "./hooks/use-sidebar-store";
import { navGroups } from "./sidebar-nav-items";

export function useSidebarCommandDialog() {
   const navigate = useNavigate();
   const { slug, teamSlug } = useDashboardSlugs();
   const { isEnrolled } = useEarlyAccess();
   const isVisible = useIsItemVisible();

   function open() {
      const groups = navGroups
         .map((group) => ({
            id: group.id,
            label: group.label,
            items: group.items
               .filter((item) => {
                  if (item.earlyAccessFlag && !isEnrolled(item.earlyAccessFlag))
                     return false;
                  return isVisible(item.id);
               })
               .map((item) => ({
                  id: item.id,
                  label: item.label,
                  icon: item.icon,
                  iconColor: item.iconColor,
                  onSelect: () =>
                     navigate({ to: item.route, params: { slug, teamSlug } }),
               })),
         }))
         .filter((g) => g.items.length > 0);

      openCommandDialog({ groups });
   }

   useHotkey("Mod+K", open);

   return { open };
}
