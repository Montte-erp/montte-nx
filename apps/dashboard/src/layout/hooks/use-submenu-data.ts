import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/integrations/clients";

export type SortOption = "name" | "date_created" | "date_updated";
export type SortDirection = "asc" | "desc";

export type SubmenuDataOptions = {
   search: string;
   sortBy: SortOption;
   sortDirection: SortDirection;
   enabled: boolean;
};

type RecentItem = {
   id: string;
   itemId: string;
   itemType: "dashboard" | "insight";
   itemName: string;
   accessedAt: Date;
};

type Dashboard = {
   id: string;
   name: string;
   description: string | null;
   createdAt: Date;
   updatedAt: Date;
   isPinned: boolean;
};

type SavedInsight = {
   id: string;
   name: string;
   description: string | null;
   createdAt: Date;
   updatedAt: Date;
};

export type SubmenuDataItem = {
   id: string;
   name: string;
   type: "dashboard" | "insight";
   createdAt: Date;
   updatedAt: Date;
   isPinned?: boolean;
   description?: string | null;
};

function sortItems<T extends { name: string; createdAt: Date; updatedAt: Date }>(
   items: T[],
   sortBy: SortOption,
   sortDirection: SortDirection,
): T[] {
   return [...items].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
         case "name":
            comparison = a.name.localeCompare(b.name);
            break;
         case "date_created":
            comparison =
               new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            break;
         case "date_updated":
            comparison =
               new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
            break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
   });
}

function filterBySearch<T extends { name: string; description?: string | null }>(
   items: T[],
   search: string,
): T[] {
   if (!search.trim()) return items;

   const searchLower = search.toLowerCase().trim();
   return items.filter(
      (item) =>
         item.name.toLowerCase().includes(searchLower) ||
         item.description?.toLowerCase().includes(searchLower),
   );
}

export function useSubmenuData(options: SubmenuDataOptions) {
   const { search, sortBy, sortDirection, enabled } = options;
   const trpc = useTRPC();

   // Fetch data in parallel
   const {
      data: dashboards,
      isLoading: isLoadingDashboards,
      error: dashboardsError,
   } = useQuery({
      ...trpc.dashboards.getAll.queryOptions(),
      enabled,
      staleTime: 30000, // 30 seconds
   });

   const {
      data: insights,
      isLoading: isLoadingInsights,
      error: insightsError,
   } = useQuery({
      ...trpc.dashboards.getAllSavedInsights.queryOptions(),
      enabled,
      staleTime: 30000,
   });

   const {
      data: recents,
      isLoading: isLoadingRecents,
      error: recentsError,
   } = useQuery({
      ...trpc.dashboards.getRecents.queryOptions({ limit: 10 }),
      enabled,
      staleTime: 10000, // 10 seconds for recents
   });

   // Process and filter data
   const processedData = useMemo(() => {
      // Transform dashboards
      const dashboardItems: SubmenuDataItem[] = (dashboards ?? []).map(
         (d: Dashboard) => ({
            id: d.id,
            name: d.name,
            type: "dashboard" as const,
            createdAt: d.createdAt,
            updatedAt: d.updatedAt,
            isPinned: d.isPinned,
            description: d.description,
         }),
      );

      // Transform insights
      const insightItems: SubmenuDataItem[] = (insights ?? []).map(
         (i: SavedInsight) => ({
            id: i.id,
            name: i.name,
            type: "insight" as const,
            createdAt: i.createdAt,
            updatedAt: i.updatedAt,
            description: i.description,
         }),
      );

      // Filter by search
      const filteredDashboards = filterBySearch(dashboardItems, search);
      const filteredInsights = filterBySearch(insightItems, search);

      // Sort items
      const sortedDashboards = sortItems(
         filteredDashboards,
         sortBy,
         sortDirection,
      );
      const sortedInsights = sortItems(filteredInsights, sortBy, sortDirection);

      // Process recents - filter out items that no longer exist
      const recentItems: Array<{
         id: string;
         itemId: string;
         itemType: "dashboard" | "insight";
         itemName: string;
         accessedAt: Date;
      }> = (recents ?? [])
         .filter((r: RecentItem) => {
            if (r.itemType === "dashboard") {
               return dashboards?.some((d: Dashboard) => d.id === r.itemId);
            }
            return insights?.some((i: SavedInsight) => i.id === r.itemId);
         })
         .filter((r: RecentItem) => {
            if (!search.trim()) return true;
            const searchLower = search.toLowerCase().trim();
            return r.itemName.toLowerCase().includes(searchLower);
         });

      return {
         dashboards: sortedDashboards,
         insights: sortedInsights,
         recents: recentItems,
         totalDashboards: dashboards?.length ?? 0,
         totalInsights: insights?.length ?? 0,
      };
   }, [dashboards, insights, recents, search, sortBy, sortDirection]);

   const isLoading = isLoadingDashboards || isLoadingInsights || isLoadingRecents;
   const error = dashboardsError || insightsError || recentsError;

   return {
      ...processedData,
      isLoading,
      error,
   };
}

// ============================================
// Planning Data Hook (Goals & Budgets)
// ============================================

type Goal = {
   id: string;
   name: string;
   description: string | null;
   status: "active" | "completed" | "paused" | "cancelled";
   targetAmount: string;
   createdAt: Date;
   updatedAt: Date;
};

type Budget = {
   id: string;
   name: string;
   description: string | null;
   amount: string;
   isActive: boolean;
   periodType: string;
   createdAt: Date;
   updatedAt: Date;
};

export type PlanningDataItem = {
   id: string;
   name: string;
   type: "goal" | "budget";
   description?: string | null;
   status?: string;
   isActive?: boolean;
   createdAt: Date;
   updatedAt: Date;
};

export function usePlanningData(options: SubmenuDataOptions) {
   const { search, sortBy, sortDirection, enabled } = options;
   const trpc = useTRPC();

   const {
      data: goals,
      isLoading: isLoadingGoals,
      error: goalsError,
   } = useQuery({
      ...trpc.goals.getAll.queryOptions(),
      enabled,
      staleTime: 30000,
   });

   const {
      data: budgets,
      isLoading: isLoadingBudgets,
      error: budgetsError,
   } = useQuery({
      ...trpc.budgets.getAll.queryOptions(),
      enabled,
      staleTime: 30000,
   });

   const processedData = useMemo(() => {
      const goalItems: PlanningDataItem[] = (goals ?? []).map((g: Goal) => ({
         id: g.id,
         name: g.name,
         type: "goal" as const,
         description: g.description,
         status: g.status,
         createdAt: g.createdAt,
         updatedAt: g.updatedAt,
      }));

      const budgetItems: PlanningDataItem[] = (budgets ?? []).map((b: Budget) => ({
         id: b.id,
         name: b.name,
         type: "budget" as const,
         description: b.description,
         isActive: b.isActive,
         createdAt: b.createdAt,
         updatedAt: b.updatedAt,
      }));

      const filteredGoals = filterBySearch(goalItems, search);
      const filteredBudgets = filterBySearch(budgetItems, search);

      const sortedGoals = sortItems(filteredGoals, sortBy, sortDirection);
      const sortedBudgets = sortItems(filteredBudgets, sortBy, sortDirection);

      return {
         goals: sortedGoals,
         budgets: sortedBudgets,
         totalGoals: goals?.length ?? 0,
         totalBudgets: budgets?.length ?? 0,
      };
   }, [goals, budgets, search, sortBy, sortDirection]);

   const isLoading = isLoadingGoals || isLoadingBudgets;
   const error = goalsError || budgetsError;

   return {
      ...processedData,
      isLoading,
      error,
   };
}

// ============================================
// Categorization Data Hook (Categories, Cost Centers, Tags)
// ============================================

type Category = {
   id: string;
   name: string;
   color: string;
   icon: string | null;
   createdAt: Date;
   updatedAt: Date;
};

type CostCenter = {
   id: string;
   name: string;
   code: string | null;
   createdAt: Date;
   updatedAt: Date;
};

type Tag = {
   id: string;
   name: string;
   color: string;
   icon: string | null;
   createdAt: Date;
   updatedAt: Date;
};

export type CategorizationDataItem = {
   id: string;
   name: string;
   type: "category" | "costCenter" | "tag";
   color?: string;
   icon?: string | null;
   code?: string | null;
   createdAt: Date;
   updatedAt: Date;
};

export function useCategorizationData(options: SubmenuDataOptions) {
   const { search, sortBy, sortDirection, enabled } = options;
   const trpc = useTRPC();

   const {
      data: categories,
      isLoading: isLoadingCategories,
      error: categoriesError,
   } = useQuery({
      ...trpc.categories.getAll.queryOptions(),
      enabled,
      staleTime: 30000,
   });

   const {
      data: costCenters,
      isLoading: isLoadingCostCenters,
      error: costCentersError,
   } = useQuery({
      ...trpc.costCenters.getAll.queryOptions(),
      enabled,
      staleTime: 30000,
   });

   const {
      data: tags,
      isLoading: isLoadingTags,
      error: tagsError,
   } = useQuery({
      ...trpc.tags.getAll.queryOptions(),
      enabled,
      staleTime: 30000,
   });

   const processedData = useMemo(() => {
      const categoryItems: CategorizationDataItem[] = (categories ?? []).map(
         (c: Category) => ({
            id: c.id,
            name: c.name,
            type: "category" as const,
            color: c.color,
            icon: c.icon,
            createdAt: c.createdAt,
            updatedAt: c.updatedAt,
         }),
      );

      const costCenterItems: CategorizationDataItem[] = (costCenters ?? []).map(
         (cc: CostCenter) => ({
            id: cc.id,
            name: cc.name,
            type: "costCenter" as const,
            code: cc.code,
            createdAt: cc.createdAt,
            updatedAt: cc.updatedAt,
         }),
      );

      const tagItems: CategorizationDataItem[] = (tags ?? []).map((t: Tag) => ({
         id: t.id,
         name: t.name,
         type: "tag" as const,
         color: t.color,
         icon: t.icon,
         createdAt: t.createdAt,
         updatedAt: t.updatedAt,
      }));

      const filteredCategories = filterBySearch(categoryItems, search);
      const filteredCostCenters = filterBySearch(costCenterItems, search);
      const filteredTags = filterBySearch(tagItems, search);

      const sortedCategories = sortItems(filteredCategories, sortBy, sortDirection);
      const sortedCostCenters = sortItems(filteredCostCenters, sortBy, sortDirection);
      const sortedTags = sortItems(filteredTags, sortBy, sortDirection);

      return {
         categories: sortedCategories,
         costCenters: sortedCostCenters,
         tags: sortedTags,
         totalCategories: categories?.length ?? 0,
         totalCostCenters: costCenters?.length ?? 0,
         totalTags: tags?.length ?? 0,
      };
   }, [categories, costCenters, tags, search, sortBy, sortDirection]);

   const isLoading = isLoadingCategories || isLoadingCostCenters || isLoadingTags;
   const error = categoriesError || costCentersError || tagsError;

   return {
      ...processedData,
      isLoading,
      error,
   };
}
