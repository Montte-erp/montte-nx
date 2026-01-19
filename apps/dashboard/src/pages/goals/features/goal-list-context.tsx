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
   currentPage: number;
   setCurrentPage: (page: number) => void;
   pageSize: number;
   setPageSize: (size: number) => void;
};

const GoalListContext = createContext<GoalListContextType | null>(null);

export function GoalListProvider({ children }: { children: ReactNode }) {
   const [statusFilter, setStatusFilter] = useState<GoalStatusFilter>("active");
   const [currentPage, setCurrentPage] = useState(1);
   const [pageSize, setPageSize] = useState(10);

   const handleStatusFilterChange = (status: GoalStatusFilter) => {
      setStatusFilter(status);
      setCurrentPage(1);
   };

   const handlePageSizeChange = (size: number) => {
      setPageSize(size);
      setCurrentPage(1);
   };

   return (
      <GoalListContext.Provider
         value={{
            statusFilter,
            setStatusFilter: handleStatusFilterChange,
            currentPage,
            setCurrentPage,
            pageSize,
            setPageSize: handlePageSizeChange,
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
