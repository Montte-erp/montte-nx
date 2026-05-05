import { createFileRoute, Outlet } from "@tanstack/react-router";
import { z } from "zod";
import { SettingsLayout } from "./settings/-layout/settings-layout";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/settings",
)({
   validateSearch: z.object({
      q: z.string().catch("").default(""),
   }),
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
