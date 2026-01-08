import { Store, useStore } from "@tanstack/react-store";

export type InsightPickerMode = "default" | "addToDashboard";

interface InsightPickerState {
	isOpen: boolean;
	mode: InsightPickerMode;
	dashboardId?: string;
	currentDashboardId?: string; // Track active dashboard for "add to dashboard" button
	onInsightCreated?: (insightId: string) => void;
}

const initialState: InsightPickerState = {
	isOpen: false,
	mode: "default",
	dashboardId: undefined,
	currentDashboardId: undefined,
	onInsightCreated: undefined,
};

const insightPickerStore = new Store<InsightPickerState>(initialState);

export interface OpenInsightPickerOptions {
	mode?: InsightPickerMode;
	dashboardId?: string;
	currentDashboardId?: string;
	onInsightCreated?: (insightId: string) => void;
}

export const openInsightPicker = (options: OpenInsightPickerOptions = {}) => {
	insightPickerStore.setState(() => ({
		isOpen: true,
		mode: options.mode ?? "default",
		dashboardId: options.dashboardId,
		currentDashboardId: options.currentDashboardId,
		onInsightCreated: options.onInsightCreated,
	}));
};

export const closeInsightPicker = () => {
	insightPickerStore.setState(() => initialState);
};

export const setCurrentDashboardId = (dashboardId: string | undefined) => {
	insightPickerStore.setState((s) => ({
		...s,
		currentDashboardId: dashboardId,
	}));
};

export const useInsightPicker = () => {
	const state = useStore(insightPickerStore);

	return {
		isOpen: state.isOpen,
		mode: state.mode,
		dashboardId: state.dashboardId,
		currentDashboardId: state.currentDashboardId,
		onInsightCreated: state.onInsightCreated,
		openInsightPicker,
		closeInsightPicker,
		setCurrentDashboardId,
	};
};

export { insightPickerStore };
