import { createFileRoute } from "@tanstack/react-router";
import { NfePage } from "./-nfe/nfe-page";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/nfe",
)({
   head: () => ({
      meta: [{ title: "NF-e — Montte" }],
   }),
   component: NfePage,
});
