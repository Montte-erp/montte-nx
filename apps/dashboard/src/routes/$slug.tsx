import { createFileRoute, Outlet } from "@tanstack/react-router";

// Organization validation has been moved to /$slug/_dashboard.tsx beforeLoad
// to enable parallel fetching with session and onboarding status
export const Route = createFileRoute("/$slug")({
   component: () => <Outlet />,
});
