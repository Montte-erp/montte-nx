import { getRouteApi, useNavigate, useRouter } from "@tanstack/react-router";

const dashboardRoute = getRouteApi(
   "/_authenticated/$slug/$teamSlug/_dashboard",
);

export function useSidebarTabs() {
   const { sidebarTab } = dashboardRoute.useSearch();
   const navigate = useNavigate();
   const router = useRouter();

   const setTab = (tab: "navegar" | "assistente") =>
      navigate({
         to: router.state.location.pathname,
         search: (prev) => ({ ...prev, sidebarTab: tab }),
         replace: true,
      });

   return { sidebarTab, setTab };
}
