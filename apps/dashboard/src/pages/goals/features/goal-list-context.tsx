"use client";

import { createContext, type ReactNode, useContext, useState } from "react";

export type GoalStatusFilter =
   | "active"
   | "completed"
   | "paused"
   | "cancelled"
   | null;

type GoalListContextType = {
   statusFilter: GoalStatusFilter;
   setStatusFilter: (status: GoalStatusFilter) => void;
};

const GoalListContext = createContext<GoalListContextType | null>(null);

export function GoalListProvider({ children }: { children: ReactNode }) {
   const [statusFilter, setStatusFilter] = useState<GoalStatusFilter>("active");

   return (
      <GoalListContext.Provider
         value={{
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
