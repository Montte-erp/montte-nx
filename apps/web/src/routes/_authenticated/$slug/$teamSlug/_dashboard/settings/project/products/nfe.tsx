import { createFileRoute } from "@tanstack/react-router";
import { NfeModuleSettingsPage } from "../../../-nfe/nfe-page";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/settings/project/products/nfe",
)({
   head: () => ({
      meta: [{ title: "Módulo NF-e — Montte" }],
   }),
   component: NfeModuleSettingsPage,
});
