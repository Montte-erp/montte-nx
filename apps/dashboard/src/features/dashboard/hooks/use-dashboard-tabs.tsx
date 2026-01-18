import { Store, useStore } from "@tanstack/react-store";
import type { RouteTabInfo } from "../lib/route-tab-mapping";

export type TabType = "app" | "dashboard" | "insight" | "search";

// Route storage for browser-like tab behavior
export type TabRoute = {
	pathname: string;
	search?: string;
};

export type DashboardTab = {
	id: string;
	type: "dashboard";
	dashboardId: string;
	name: string;
	isDirty?: boolean;
	isPinned?: boolean;
	route?: TabRoute;
};

export type InsightTab = {
	id: string;
	type: "insight";
	insightId: string;
	name: string;
	isDirty?: boolean;
	isPinned?: boolean;
	route?: TabRoute;
};

export type AppTab = {
	id: "app";
	type: "app";
	name: string;
	dashboardId?: string;
	routeKey?: string;
	routeInfo?: RouteTabInfo;
	route?: TabRoute;
};

export type SearchTab = {
	id: "search";
	type: "search";
	name: string;
	isPinned?: boolean;
	route?: TabRoute;
};

export type Tab = AppTab | DashboardTab | InsightTab | SearchTab;

type DashboardTabsState = {
	activeTabId: string;
	tabs: Tab[];
	appTabName: string;
};

const STORAGE_KEY = "montte:dashboard-tabs";

// Serializable versions of tabs (without LucideIcon references)
type SerializableAppTab = Omit<AppTab, "routeInfo">;
type SerializableTab =
	| SerializableAppTab
	| DashboardTab
	| InsightTab
	| SearchTab;

type SerializableDashboardTabsState = {
	activeTabId: string;
	tabs: SerializableTab[];
	appTabName: string;
};

function serializeState(state: DashboardTabsState): SerializableDashboardTabsState {
	return {
		activeTabId: state.activeTabId,
		appTabName: state.appTabName,
		tabs: state.tabs.map((tab) => {
			// Strip out routeInfo which contains non-serializable LucideIcon
			// This applies to app tabs and transformed search tabs
			if ("routeInfo" in tab && tab.routeInfo) {
				const { routeInfo, ...serializableTab } = tab;
				return serializableTab;
			}
			return tab;
		}),
	};
}

function loadFromStorage(): DashboardTabsState | null {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (!stored) return null;

		const parsed = JSON.parse(stored) as SerializableDashboardTabsState;

		// Validate basic structure
		if (!parsed.tabs || !Array.isArray(parsed.tabs) || !parsed.activeTabId) {
			return null;
		}

		// Ensure app tab exists
		const hasAppTab = parsed.tabs.some((t) => t.id === "app" && t.type === "app");
		if (!hasAppTab) {
			return null;
		}

		// Clean up any corrupted routeInfo that was accidentally serialized
		// (routeInfo contains non-serializable LucideIcon and becomes an object after JSON parse)
		const cleanedTabs = parsed.tabs.map((tab) => {
			if ("routeInfo" in tab) {
				const { routeInfo, ...cleanTab } = tab as typeof tab & { routeInfo?: unknown };
				return cleanTab;
			}
			return tab;
		});

		return {
			activeTabId: parsed.activeTabId,
			appTabName: parsed.appTabName || "Home",
			tabs: cleanedTabs as Tab[],
		};
	} catch {
		return null;
	}
}

function saveToStorage(state: DashboardTabsState): void {
	try {
		const serialized = serializeState(state);
		localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
	} catch {
		// localStorage not available or quota exceeded
	}
}

const DEFAULT_STATE: DashboardTabsState = {
	activeTabId: "app",
	appTabName: "Home",
	tabs: [{ id: "app", name: "Home", type: "app" }],
};

const dashboardTabsStore = new Store<DashboardTabsState>(
	loadFromStorage() ?? DEFAULT_STATE,
);

// Subscribe to state changes and persist to localStorage
dashboardTabsStore.subscribe(() => {
	saveToStorage(dashboardTabsStore.state);
});

export function useDashboardTabs() {
	const state = useStore(dashboardTabsStore);

	return {
		activeTabId: state.activeTabId,
		tabs: state.tabs,
		appTabName: state.appTabName,

		setActiveTab: (tabId: string) => {
			dashboardTabsStore.setState((s) => ({
				...s,
				activeTabId: tabId,
			}));
		},

		updateActiveTabRoute: (pathname: string, search?: string) => {
			dashboardTabsStore.setState((s) => ({
				...s,
				tabs: s.tabs.map((tab) =>
					tab.id === s.activeTabId
						? { ...tab, route: { pathname, search } }
						: tab,
				),
			}));
		},

		setAppTabName: (name: string, dashboardId?: string) => {
			dashboardTabsStore.setState((s) => ({
				...s,
				appTabName: name,
				tabs: s.tabs.map((tab) =>
					tab.id === "app" ? { ...tab, name, dashboardId } as AppTab : tab,
				),
			}));
		},

		openDashboardTab: (dashboardId: string, name: string) => {
			dashboardTabsStore.setState((s) => {
				// Check if tab already exists
				const existingTab = s.tabs.find(
					(t) => t.type === "dashboard" && t.dashboardId === dashboardId,
				);

				if (existingTab) {
					return { ...s, activeTabId: existingTab.id };
				}

				// Create new tab
				const newTab: DashboardTab = {
					dashboardId,
					id: dashboardId,
					name,
					type: "dashboard",
				};

				return {
					...s,
					activeTabId: newTab.id,
					tabs: [...s.tabs, newTab],
				};
			});
		},

		openInsightTab: (insightId: string, name: string) => {
			dashboardTabsStore.setState((s) => {
				// Check if tab already exists
				const existingTab = s.tabs.find(
					(t) => t.type === "insight" && t.insightId === insightId,
				);

				if (existingTab) {
					return { ...s, activeTabId: existingTab.id };
				}

				// Create new tab
				const newTab: InsightTab = {
					insightId,
					id: `insight-${insightId}`,
					name,
					type: "insight",
				};

				return {
					...s,
					activeTabId: newTab.id,
					tabs: [...s.tabs, newTab],
				};
			});
		},

		closeTab: (tabId: string) => {
			if (tabId === "app") return; // Can't close app tab

			dashboardTabsStore.setState((s) => {
				// Don't close pinned tabs
				const tab = s.tabs.find((t) => t.id === tabId);
				if (tab && "isPinned" in tab && tab.isPinned) return s;

				const tabIndex = s.tabs.findIndex((t) => t.id === tabId);
				const newTabs = s.tabs.filter((t) => t.id !== tabId);

				// If closing active tab, switch to previous tab or app tab
				let newActiveTabId = s.activeTabId;
				if (s.activeTabId === tabId) {
					if (tabIndex > 0) {
						newActiveTabId = newTabs[tabIndex - 1]?.id || "app";
					} else {
						newActiveTabId = "app";
					}
				}

				return {
					...s,
					activeTabId: newActiveTabId,
					tabs: newTabs,
				};
			});
		},

		updateTabName: (tabId: string, name: string) => {
			dashboardTabsStore.setState((s) => ({
				...s,
				tabs: s.tabs.map((tab) =>
					tab.id === tabId ? { ...tab, name } : tab,
				),
			}));
		},

		reorderTabs: (orderedTabIds: string[]) => {
			dashboardTabsStore.setState((s) => {
				const tabMap = new Map(s.tabs.map((t) => [t.id, t]));
				const reorderedTabs = orderedTabIds
					.map((id) => tabMap.get(id))
					.filter((t): t is Tab => t !== undefined);

				return {
					...s,
					tabs: reorderedTabs,
				};
			});
		},

		getActiveTab: () => {
			const state = dashboardTabsStore.state;
			return state.tabs.find((t) => t.id === state.activeTabId);
		},

		isDashboardOpen: (dashboardId: string) => {
			return dashboardTabsStore.state.tabs.some(
				(t) => t.type === "dashboard" && t.dashboardId === dashboardId,
			);
		},

		isInsightOpen: (insightId: string) => {
			return dashboardTabsStore.state.tabs.some(
				(t) => t.type === "insight" && t.insightId === insightId,
			);
		},

		isSearchOpen: () => {
			return dashboardTabsStore.state.tabs.some((t) => t.type === "search");
		},

		openSearchTab: () => {
			dashboardTabsStore.setState((s) => {
				// Search tab is singleton - only one can exist
				const existingTab = s.tabs.find((t) => t.type === "search");
				if (existingTab) {
					return { ...s, activeTabId: existingTab.id };
				}

				const newTab: SearchTab = {
					id: "search",
					type: "search",
					name: "Search",
				};

				return {
					...s,
					activeTabId: newTab.id,
					tabs: [...s.tabs, newTab],
				};
			});
		},

		togglePinTab: (tabId: string) => {
			if (tabId === "app") return; // Can't pin/unpin app tab
			dashboardTabsStore.setState((s) => ({
				...s,
				tabs: s.tabs.map((tab) =>
					tab.id === tabId && tab.type !== "app"
						? { ...tab, isPinned: !("isPinned" in tab && tab.isPinned) }
						: tab,
				),
			}));
		},

		updateActiveTabForRoute: (routeKey: string, routeInfo: RouteTabInfo) => {
			dashboardTabsStore.setState((s) => {
				// Always update the app tab with the current route, regardless of which tab is active
				// This ensures clicking the app tab returns to the last visited app route
				const appTab = s.tabs.find((t) => t.id === "app" && t.type === "app");
				if (!appTab) return s;

				return {
					...s,
					appTabName: routeInfo.name,
					tabs: s.tabs.map((tab) =>
						tab.id === "app" && tab.type === "app"
							? { ...tab, name: routeInfo.name, routeKey, routeInfo }
							: tab,
					),
				};
			});
		},
	};
}

// Standalone functions for use outside React components
export function openDashboardTab(dashboardId: string, name: string) {
	dashboardTabsStore.setState((s) => {
		const existingTab = s.tabs.find(
			(t) => t.type === "dashboard" && t.dashboardId === dashboardId,
		);

		if (existingTab) {
			return { ...s, activeTabId: existingTab.id };
		}

		const newTab: DashboardTab = {
			dashboardId,
			id: dashboardId,
			name,
			type: "dashboard",
		};

		return {
			...s,
			activeTabId: newTab.id,
			tabs: [...s.tabs, newTab],
		};
	});
}

export function openInsightTab(insightId: string, name: string) {
	dashboardTabsStore.setState((s) => {
		const existingTab = s.tabs.find(
			(t) => t.type === "insight" && t.insightId === insightId,
		);

		if (existingTab) {
			return { ...s, activeTabId: existingTab.id };
		}

		const newTab: InsightTab = {
			insightId,
			id: `insight-${insightId}`,
			name,
			type: "insight",
		};

		return {
			...s,
			activeTabId: newTab.id,
			tabs: [...s.tabs, newTab],
		};
	});
}

export function openSearchTab() {
	dashboardTabsStore.setState((s) => {
		// Search tab is singleton - only one can exist
		const existingTab = s.tabs.find((t) => t.type === "search");
		if (existingTab) {
			return { ...s, activeTabId: existingTab.id };
		}

		const newTab: SearchTab = {
			id: "search",
			type: "search",
			name: "Search",
		};

		return {
			...s,
			activeTabId: newTab.id,
			tabs: [...s.tabs, newTab],
		};
	});
}

export function closeTab(tabId: string) {
	if (tabId === "app") return;

	dashboardTabsStore.setState((s) => {
		// Don't close pinned tabs
		const tab = s.tabs.find((t) => t.id === tabId);
		if (tab && "isPinned" in tab && tab.isPinned) return s;

		const tabIndex = s.tabs.findIndex((t) => t.id === tabId);
		const newTabs = s.tabs.filter((t) => t.id !== tabId);

		let newActiveTabId = s.activeTabId;
		if (s.activeTabId === tabId) {
			if (tabIndex > 0) {
				newActiveTabId = newTabs[tabIndex - 1]?.id || "app";
			} else {
				newActiveTabId = "app";
			}
		}

		return {
			...s,
			activeTabId: newActiveTabId,
			tabs: newTabs,
		};
	});
}

export function setActiveTab(tabId: string) {
	dashboardTabsStore.setState((s) => ({
		...s,
		activeTabId: tabId,
	}));
}

export function setAppTabName(name: string, dashboardId?: string) {
	dashboardTabsStore.setState((s) => ({
		...s,
		appTabName: name,
		tabs: s.tabs.map((tab) => (tab.id === "app" ? { ...tab, name, dashboardId } as AppTab : tab)),
	}));
}

export function togglePinTab(tabId: string) {
	if (tabId === "app") return;
	dashboardTabsStore.setState((s) => ({
		...s,
		tabs: s.tabs.map((tab) =>
			tab.id === tabId && tab.type !== "app"
				? { ...tab, isPinned: !("isPinned" in tab && tab.isPinned) }
				: tab,
		),
	}));
}

export function updateActiveTabForRoute(routeKey: string, routeInfo: RouteTabInfo) {
	dashboardTabsStore.setState((s) => {
		// Always update the app tab with the current route, regardless of which tab is active
		// This ensures clicking the app tab returns to the last visited app route
		const appTab = s.tabs.find((t) => t.id === "app" && t.type === "app");
		if (!appTab) return s;

		return {
			...s,
			appTabName: routeInfo.name,
			tabs: s.tabs.map((tab) =>
				tab.id === "app" && tab.type === "app"
					? { ...tab, name: routeInfo.name, routeKey, routeInfo }
					: tab,
			),
		};
	});
}

export function updateActiveTabRoute(pathname: string, search?: string) {
	dashboardTabsStore.setState((s) => ({
		...s,
		tabs: s.tabs.map((tab) =>
			tab.id === s.activeTabId
				? { ...tab, route: { pathname, search } }
				: tab,
		),
	}));
}

/**
 * Transform the active tab to match the current route.
 * - App and Search tabs transform their display (name, icon) to match the new route
 * - Dashboard and Insight tabs only update their stored route (they're tied to specific IDs)
 * - The tab TYPE is preserved to maintain proper sorting/filtering in the tab bar
 */
export function transformActiveTab(
	routeKey: string,
	routeInfo: RouteTabInfo,
	route: TabRoute,
) {
	dashboardTabsStore.setState((s) => {
		const activeTab = s.tabs.find((t) => t.id === s.activeTabId);

		// Don't transform dashboard/insight tabs - they're tied to specific IDs
		if (activeTab?.type === "dashboard" || activeTab?.type === "insight") {
			// Just update the route, not the identity
			return {
				...s,
				tabs: s.tabs.map((tab) =>
					tab.id === s.activeTabId ? { ...tab, route } : tab,
				),
			};
		}

		// Transform app/search tabs to match the new route
		// Keep the original type to maintain proper tab bar sorting
		// For the app tab, we also update appTabName for consistency
		const isAppTab = s.activeTabId === "app";

		return {
			...s,
			appTabName: isAppTab ? routeInfo.name : s.appTabName,
			tabs: s.tabs.map((tab) => {
				if (tab.id !== s.activeTabId) return tab;

				// Keep original type, just update display info
				if (tab.type === "app") {
					return {
						...tab,
						name: routeInfo.name,
						routeKey,
						routeInfo,
						route,
					} as AppTab;
				}

				// For search tabs, update display but keep type as "search"
				if (tab.type === "search") {
					return {
						...tab,
						name: routeInfo.name,
						route,
						// Store routeInfo for icon display even though SearchTab doesn't have this field
						// The tab bar will use this for rendering
						routeKey,
						routeInfo,
					} as SearchTab & { routeKey: string; routeInfo: RouteTabInfo };
				}

				return tab;
			}),
		};
	});
}
