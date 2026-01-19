import type { RouterOutput } from "@packages/api/client";
import { Button } from "@packages/ui/components/button";
import { Plus } from "lucide-react";
import { DefaultHeader } from "@/default/default-header";
import { usePlanFeatures } from "@/features/billing/lib/use-plan-features";
import { UpgradeRequired } from "@/features/billing/ui/upgrade-required";
import { useSheet } from "@/hooks/use-sheet";
import { CostCenterListProvider } from "../features/cost-center-list-context";
import { ManageCostCenterForm } from "../features/manage-cost-center-form";
import { CostCentersCharts } from "./cost-centers-charts";
import { CostCentersListSection } from "./cost-centers-list-section";
import { CostCentersStats } from "./cost-centers-stats";

export type CostCenter =
   RouterOutput["costCenters"]["getAllPaginated"]["costCenters"][0];

export function CostCentersPage() {
   const { openSheet } = useSheet();
   const { canAccessCostCenters } = usePlanFeatures();

   return (
      <UpgradeRequired
         featureName="Centros de Custo"
         hasAccess={canAccessCostCenters}
         requiredPlan="erp"
      >
         <CostCenterListProvider>
            <main className="space-y-4">
               <DefaultHeader
                  actions={
                     <Button
                        onClick={() =>
                           openSheet({
                              children: <ManageCostCenterForm />,
                           })
                        }
                     >
                        <Plus className="size-4" />
                        Adicionar
                     </Button>
                  }
                  description="Visualize e gerencie seus centros de custo aqui."
                  title="Seus centros de custo"
               />
               <CostCentersStats />
               <CostCentersListSection />
               <CostCentersCharts />
            </main>
         </CostCenterListProvider>
      </UpgradeRequired>
   );
}
