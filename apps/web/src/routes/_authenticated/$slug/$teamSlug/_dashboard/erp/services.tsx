import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/erp/services",
)({
   component: () => <Outlet />,
});
