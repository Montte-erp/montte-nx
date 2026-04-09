import { createFileRoute, Outlet } from "@tanstack/react-router";
import { SettingsLayout } from "@/layout/dashboard/ui/settings-layout";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/settings",
)({
   head: () => ({
      meta: [{ title: "Configurações — Montte" }],
   }),
   component: SettingsLayoutRoute,
});

function SettingsLayoutRoute() {
   return (
      <SettingsLayout>
         <Outlet />
      </SettingsLayout>
   );
}
