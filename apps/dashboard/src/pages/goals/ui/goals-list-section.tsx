"use client";

import { Card, CardContent } from "@packages/ui/components/card";
import { ItemGroup, ItemSeparator } from "@packages/ui/components/item";
import { Skeleton } from "@packages/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import { Fragment } from "react";
import { useTRPC } from "@/integrations/clients";
import { useGoalList } from "../features/goal-list-context";
import { GoalList } from "./goal-list";

export function GoalsListSection() {
   const trpc = useTRPC();
   const { statusFilter, currentPage, setCurrentPage, pageSize, setPageSize } =
      useGoalList();

   const { data: goals, isLoading } = useQuery(
      trpc.goals.getAll.queryOptions({
         status: statusFilter ?? undefined,
      }),
   );

   if (isLoading) {
      return <GoalsListSkeleton />;
   }

   const goalsData = goals || [];
   const totalCount = goalsData.length;
   const totalPages = Math.ceil(totalCount / pageSize);

   const paginatedGoals = goalsData.slice(
      (currentPage - 1) * pageSize,
      currentPage * pageSize,
   );

   return (
      <GoalList
         goals={paginatedGoals}
         pagination={{
            currentPage,
            onPageChange: setCurrentPage,
            onPageSizeChange: setPageSize,
            pageSize,
            totalCount,
            totalPages,
         }}
         statusFilter={statusFilter}
      />
   );
}

function GoalsListSkeleton() {
   return (
      <Card>
         <CardContent className="pt-6 space-y-4">
            <ItemGroup>
               {Array.from({ length: 5 }).map((_, index) => (
                  <Fragment key={`goal-skeleton-${index + 1}`}>
                     <div className="flex items-center p-4 gap-4">
                        <Skeleton className="size-4 rounded" />
                        <div className="space-y-2 flex-1">
                           <Skeleton className="h-4 w-32" />
                           <Skeleton className="h-3 w-24" />
                        </div>
                        <Skeleton className="h-2 w-24 rounded-full" />
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-8 w-8" />
                     </div>
                     {index !== 4 && <ItemSeparator />}
                  </Fragment>
               ))}
            </ItemGroup>
            <div className="flex items-center justify-end gap-2 pt-4">
               <Skeleton className="h-10 w-24" />
               <Skeleton className="h-10 w-10" />
               <Skeleton className="h-10 w-24" />
            </div>
         </CardContent>
      </Card>
   );
}
