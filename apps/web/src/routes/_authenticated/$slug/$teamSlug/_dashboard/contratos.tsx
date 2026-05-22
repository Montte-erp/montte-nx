import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/contratos",
)({
   head: () => ({ meta: [{ title: "Contratos - Montte" }] }),
   component: ContratosLayoutRoute,
});

function ContratosLayoutRoute() {
   return <Outlet />;
}
