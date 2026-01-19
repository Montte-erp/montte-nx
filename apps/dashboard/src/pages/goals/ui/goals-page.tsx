"use client";

import { Button } from "@packages/ui/components/button";
import {
   ToggleGroup,
   ToggleGroupItem,
} from "@packages/ui/components/toggle-group";
import { cn } from "@packages/ui/lib/utils";
import { CheckCircle2, PauseCircle, Plus, Target, XCircle } from "lucide-react";
import { DefaultHeader } from "@/default/default-header";
import { useSheet } from "@/hooks/use-sheet";
import {
   GoalListProvider,
   type GoalStatusFilter,
   useGoalList,
} from "../features/goal-list-context";
import { ManageGoalForm } from "../features/manage-goal-form";
import { GoalsListSection } from "./goals-list-section";
import { GoalsStats } from "./goals-stats";

function GoalsPageContent() {
   const { openSheet } = useSheet();
   const { statusFilter, setStatusFilter } = useGoalList();

   const statusChips = [
      {
         icon: Target,
         label: "Ativas",
         value: "active" as const,
      },
      {
         icon: CheckCircle2,
         label: "Concluidas",
         value: "completed" as const,
      },
      {
         icon: PauseCircle,
         label: "Pausadas",
         value: "paused" as const,
      },
      {
         icon: XCircle,
         label: "Canceladas",
         value: "cancelled" as const,
      },
   ];

   return (
      <main className="space-y-4">
         <DefaultHeader
            actions={
               <Button
                  onClick={() => openSheet({ children: <ManageGoalForm /> })}
               >
                  <Plus className="size-4" />
                  Nova meta
               </Button>
            }
            description="Defina metas financeiras e acompanhe seu progresso"
            title="Metas"
         />

         <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-0">
               <p className="text-xs text-muted-foreground mb-1.5">Status</p>
               <ToggleGroup
                  className="flex-wrap justify-start"
                  onValueChange={(value) =>
                     setStatusFilter((value || null) as GoalStatusFilter)
                  }
                  size="sm"
                  spacing={2}
                  type="single"
                  value={statusFilter || ""}
                  variant="outline"
               >
                  {statusChips.map((chip) => {
                     const Icon = chip.icon;
                     return (
                        <ToggleGroupItem
                           aria-label={`Toggle ${chip.value}`}
                           className={cn(
                              "gap-1.5 data-[state=on]:bg-transparent data-[state=on]:text-primary data-[state=on]:*:[svg]:stroke-primary",
                              "text-xs px-2 h-7",
                           )}
                           key={chip.value}
                           value={chip.value}
                        >
                           <Icon className="size-3" />
                           {chip.label}
                        </ToggleGroupItem>
                     );
                  })}
               </ToggleGroup>
            </div>
         </div>

         <GoalsStats />
         <GoalsListSection />
      </main>
   );
}

export function GoalsPage() {
   return (
      <GoalListProvider>
         <GoalsPageContent />
      </GoalListProvider>
   );
}
