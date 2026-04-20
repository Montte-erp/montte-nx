import { getRouteApi } from "@tanstack/react-router";

const dashboardRoute = getRouteApi(
   "/_authenticated/$slug/$teamSlug/_dashboard",
);

export function useSidebarTabs() {
   const { sidebarTab } = dashboardRoute.useSearch();
   const navigate = dashboardRoute.useNavigate();

   const setTab = (tab: "navegar" | "assistente") =>
      navigate({
         search: (prev) => ({ ...prev, sidebarTab: tab }),
         replace: true,
      });

   return { sidebarTab, setTab };
}
