import { Store, useStore } from "@tanstack/react-store";
import type { InsightConfig } from "@packages/database/schemas/dashboards";

interface WidgetConfigPanelState {
	isOpen: boolean;
	widgetId: string | null;
	dashboardId: string | null;
	widgetName: string;
	widgetConfig: InsightConfig | null;
	pendingChanges: Partial<InsightConfig>;
}

const initialState: WidgetConfigPanelState = {
	isOpen: false,
	widgetId: null,
	dashboardId: null,
	widgetName: "",
	widgetConfig: null,
	pendingChanges: {},
};

const widgetConfigPanelStore = new Store<WidgetConfigPanelState>(initialState);

export interface OpenWidgetConfigPanelOptions {
	widgetId: string;
	dashboardId: string;
	widgetName: string;
	widgetConfig: InsightConfig;
}

export const openWidgetConfigPanel = (options: OpenWidgetConfigPanelOptions) => {
	widgetConfigPanelStore.setState(() => ({
		isOpen: true,
		widgetId: options.widgetId,
		dashboardId: options.dashboardId,
		widgetName: options.widgetName,
		widgetConfig: options.widgetConfig,
		pendingChanges: {},
	}));
};

export const closeWidgetConfigPanel = () => {
	widgetConfigPanelStore.setState(() => initialState);
};

export const updateWidgetConfigPanel = (updates: Partial<InsightConfig>) => {
	widgetConfigPanelStore.setState((s) => ({
		...s,
		pendingChanges: { ...s.pendingChanges, ...updates },
	}));
};

export const updateWidgetName = (name: string) => {
	widgetConfigPanelStore.setState((s) => ({
		...s,
		widgetName: name,
	}));
};

export const resetPendingChanges = () => {
	widgetConfigPanelStore.setState((s) => ({
		...s,
		pendingChanges: {},
	}));
};

export const getEffectiveConfig = (state: WidgetConfigPanelState): InsightConfig | null => {
	if (!state.widgetConfig) return null;
	return { ...state.widgetConfig, ...state.pendingChanges };
};

export function useWidgetConfigPanel() {
	const state = useStore(widgetConfigPanelStore);

	return {
		isOpen: state.isOpen,
		widgetId: state.widgetId,
		dashboardId: state.dashboardId,
		widgetName: state.widgetName,
		widgetConfig: state.widgetConfig,
		pendingChanges: state.pendingChanges,
		effectiveConfig: getEffectiveConfig(state),
		hasPendingChanges: Object.keys(state.pendingChanges).length > 0,
		openPanel: openWidgetConfigPanel,
		closePanel: closeWidgetConfigPanel,
		updateConfig: updateWidgetConfigPanel,
		updateName: updateWidgetName,
		resetChanges: resetPendingChanges,
	};
}

export { widgetConfigPanelStore };
