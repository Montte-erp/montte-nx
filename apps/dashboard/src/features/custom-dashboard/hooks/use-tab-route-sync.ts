import { useLocation } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { transformActiveTab, updateActiveTabRoute } from "./use-dashboard-tabs";
import { getRouteKey, getRouteTabInfo } from "./use-routes";

/**
 * Hook that syncs the current route with the active tab.
 *
 * Tab transformation behavior:
 * - When navigating via sidebar, the active tab TRANSFORMS to show the new route
 * - Dashboard/Insight tabs don't transform (they're tied to specific IDs)
 * - App and Search tabs transform to match the new route's name, icon, and type
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

      const routeKey = getRouteKey(pathname);
      const route = { pathname, search: searchStr || undefined };

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
