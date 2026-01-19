import { useLocation } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { transformActiveTab, updateActiveTabRoute } from "./use-dashboard-tabs";
import { getRouteKey, getRouteTabInfo, ROUTE_TAB_MAP } from "./use-routes";

/**
 * Check if a pathname is a detail route (has a dynamic ID segment).
 * Detail routes have the pattern: /$slug/route-key/$id
 */
function isDetailRoute(pathname: string): boolean {
   const segments = pathname.split("/").filter(Boolean);
   // Pattern: [slug, routeKey, id] - at least 3 segments where the 3rd is an ID
   return segments.length >= 3 && !ROUTE_TAB_MAP[segments[2]];
}

/**
 * Get the parent route key for a detail route.
 * Maps detail routes to their parent list route for icon display.
 */
function getParentRouteKey(pathname: string): string {
   const segments = pathname.split("/").filter(Boolean);
   // For detail routes like /slug/transactions/123, return "transactions"
   // For routes like /slug/bank-accounts/123, return "bank-accounts"
   return segments[1] || "dashboards";
}

/**
 * Hook that syncs the current route with the active tab.
 *
 * Tab transformation behavior:
 * - When navigating via sidebar, the active tab TRANSFORMS to show the new route
 * - Dashboard/Insight tabs don't transform (they're tied to specific IDs)
 * - App and Search tabs transform to match the new route's name, icon, and type
 * - Detail routes use parent route's icon with "Carregando..." until page updates the name
 *
 * Example:
 * - Tab 1 = Categories, Tab 2 = Search (active)
 * - User clicks "Tags" in sidebar
 * - Tab 2 transforms from "Search" to "Tags"
 */
export function useTabRouteSync() {
   const location = useLocation();
   const prevPathnameRef = useRef<string | null>(null);

   useEffect(() => {
      const { pathname, searchStr } = location;

      // Skip if pathname hasn't changed
      if (prevPathnameRef.current === pathname) return;
      prevPathnameRef.current = pathname;

      const route = { pathname, search: searchStr || undefined };

      // Check if this is a detail route
      if (isDetailRoute(pathname)) {
         const parentRouteKey = getParentRouteKey(pathname);
         const parentRouteInfo = ROUTE_TAB_MAP[parentRouteKey];

         if (parentRouteInfo) {
            // Use parent route's icon but set name to "Carregando..."
            // The detail page will update the name once data loads
            const detailRouteInfo = {
               ...parentRouteInfo,
               name: "Carregando...",
            };
            transformActiveTab(parentRouteKey, detailRouteInfo, route);
         } else {
            updateActiveTabRoute(pathname, searchStr || undefined);
         }
         return;
      }

      const routeKey = getRouteKey(pathname);

      // For dashboard/insight routes, just update the stored route (don't transform)
      // These tabs are tied to specific IDs and shouldn't change identity
      if (routeKey === "dashboards" || routeKey === "insights") {
         updateActiveTabRoute(pathname, searchStr || undefined);
         return;
      }

      // For all other app routes (including search), transform the active tab
      // This changes the tab's identity (name, icon, type) to match the new route
      const routeInfo = getRouteTabInfo(pathname);
      if (routeInfo) {
         transformActiveTab(routeKey, routeInfo, route);
      }
   }, [location]);
}
