"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

export type GoalTypeFilter = "savings" | "debt_payoff" | "spending_limit" | "income_target" | null;
export type GoalStatusFilter = "active" | "completed" | "paused" | "cancelled" | null;

type GoalListContextType = {
	typeFilter: GoalTypeFilter;
	setTypeFilter: (type: GoalTypeFilter) => void;
	statusFilter: GoalStatusFilter;
	setStatusFilter: (status: GoalStatusFilter) => void;
};

const GoalListContext = createContext<GoalListContextType | null>(null);

export function GoalListProvider({ children }: { children: ReactNode }) {
	const [typeFilter, setTypeFilter] = useState<GoalTypeFilter>(null);
	const [statusFilter, setStatusFilter] = useState<GoalStatusFilter>("active");

	return (
		<GoalListContext.Provider
			value={{
				typeFilter,
				setTypeFilter,
				statusFilter,
				setStatusFilter,
			}}
		>
			{children}
		</GoalListContext.Provider>
	);
}

export function useGoalList() {
	const context = useContext(GoalListContext);
	if (!context) {
		throw new Error("useGoalList must be used within a GoalListProvider");
	}
	return context;
}
