import { Store, useStore } from "@tanstack/react-store";

export type TabType = "app" | "dashboard" | "insight" | "search";

export type DashboardTab = {
	id: string;
	type: "dashboard";
	dashboardId: string;
	name: string;
	isDirty?: boolean;
};

export type InsightTab = {
	id: string;
	type: "insight";
	insightId: string;
	name: string;
	isDirty?: boolean;
};

export type AppTab = {
	id: "app";
	type: "app";
	name: string;
	dashboardId?: string;
};

export type SearchTab = {
	id: "search";
	type: "search";
	name: string;
};

export type Tab = AppTab | DashboardTab | InsightTab | SearchTab;

type DashboardTabsState = {
	activeTabId: string;
	tabs: Tab[];
	appTabName: string;
};

const dashboardTabsStore = new Store<DashboardTabsState>({
	activeTabId: "app",
	appTabName: "Home",
	tabs: [{ id: "app", name: "Home", type: "app" }],
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
