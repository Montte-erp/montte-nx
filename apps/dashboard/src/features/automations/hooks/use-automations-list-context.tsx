import type React from "react";
import { createContext, useContext, useState } from "react";

export type TriggerTypeFilter =
	| "transaction.created"
	| "transaction.updated"
	| "schedule.daily"
	| "schedule.weekly"
	| "schedule.biweekly"
	| "schedule.custom";

interface AutomationsListContextType {
	triggerType: TriggerTypeFilter | null;
	setTriggerType: (type: TriggerTypeFilter | null) => void;
}

const AutomationsListContext = createContext<
	AutomationsListContextType | undefined
>(undefined);

export function AutomationsListProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const [triggerType, setTriggerType] = useState<TriggerTypeFilter | null>(
		null,
	);

	const value = {
		setTriggerType,
		triggerType,
	};

	return (
		<AutomationsListContext.Provider value={value}>
			{children}
		</AutomationsListContext.Provider>
	);
}

export function useAutomationsList() {
	const context = useContext(AutomationsListContext);
	if (context === undefined) {
		throw new Error(
			"useAutomationsList must be used within an AutomationsListProvider",
		);
	}
	return context;
}
