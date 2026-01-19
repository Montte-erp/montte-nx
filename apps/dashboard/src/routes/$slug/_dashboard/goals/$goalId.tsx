import { createFileRoute } from "@tanstack/react-router";
import { GoalDetailsPage } from "@/pages/goal-details/ui/goal-details-page";

export const Route = createFileRoute("/$slug/_dashboard/goals/$goalId")({
   component: GoalDetailsPage,
   staticData: { breadcrumb: "Detalhes da meta" },
});
