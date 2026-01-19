import type { RouterOutput } from "@packages/api/client";
import { DefaultHeader } from "@/default/default-header";
import { InsightsListSection } from "./insights-list-section";

export type SavedInsight = RouterOutput["dashboards"]["getAllSavedInsights"][number];

export function InsightsListPage() {
   return (
      <main className="space-y-4">
         <DefaultHeader
            description="Visualize e gerencie seus insights salvos"
            title="Insights Salvos"
         />
         <InsightsListSection />
      </main>
   );
}
