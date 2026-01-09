import { useLocation } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { getRouteKey, getRouteTabInfo } from "../lib/route-tab-mapping";
import { updateActiveTabForRoute, useDashboardTabs } from "./use-dashboard-tabs";

/**
 * Hook that syncs the active tab's display info with the current route.
 * When the route changes and the active tab is an "app" type tab,
 * the tab's name and icon will update to reflect the current page.
 */
export function useTabRouteSync() {
	const { pathname } = useLocation();
	const { activeTabId, tabs } = useDashboardTabs();
	const prevRouteKeyRef = useRef<string | null>(null);

	useEffect(() => {
		const activeTab = tabs.find((t) => t.id === activeTabId);

		// Only update for "app" type tabs (the follow behavior)
		if (activeTab?.type !== "app") return;

		const routeKey = getRouteKey(pathname);

		// Prevent infinite loops by checking if the route key actually changed
		if (prevRouteKeyRef.current === routeKey) return;
		prevRouteKeyRef.current = routeKey;

		const routeInfo = getRouteTabInfo(pathname);

		if (routeInfo) {
			updateActiveTabForRoute(routeKey, routeInfo);
		}
	}, [pathname, activeTabId, tabs]);
}
