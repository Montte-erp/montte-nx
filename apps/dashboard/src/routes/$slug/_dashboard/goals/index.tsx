import { createFileRoute } from "@tanstack/react-router";
import { GoalsPage } from "@/pages/goals/ui/goals-page";

export const Route = createFileRoute("/$slug/_dashboard/goals/")({
   component: GoalsPage,
   staticData: { breadcrumb: "Metas" },
});
