import { useHotkey } from "@tanstack/react-hotkeys";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useCallback } from "react";
import { openCommandDialog } from "@/hooks/use-command-dialog";
import { useEarlyAccess } from "@/hooks/use-early-access";
import { useSidebarVisibility } from "@/layout/dashboard/hooks/use-sidebar-store";
import { navGroups } from "@/layout/dashboard/ui/sidebar-nav-items";

export function useSidebarCommandDialog() {
   const navigate = useNavigate();
   const { slug, teamSlug } = useParams({
      from: "/_authenticated/$slug/$teamSlug/_dashboard",
   });
   const { isEnrolled } = useEarlyAccess();
   const { isVisible } = useSidebarVisibility();

   const open = useCallback(() => {
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
                     navigate({
                        to: item.route,
                        params: { slug, teamSlug: teamSlug ?? "" },
                     }),
               })),
         }))
         .filter((g) => g.items.length > 0);

      openCommandDialog({ groups });
   }, [isEnrolled, isVisible, navigate, slug, teamSlug]);

   useHotkey("Mod+K", open);

   return { open };
}
