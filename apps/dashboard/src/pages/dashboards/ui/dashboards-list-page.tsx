import { Button } from "@packages/ui/components/button";
import type { RouterOutput } from "@packages/api/client";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { DefaultHeader } from "@/default/default-header";
import { useCreateDashboard } from "@/pages/dashboards/features/use-create-dashboard";
import { DashboardsListSection } from "./dashboards-list-section";

export type Dashboard = RouterOutput["dashboards"]["getAll"][number];

export function DashboardsListPage() {
   const createDashboardMutation = useCreateDashboard({
      onSuccess: () => {
         toast.success("Dashboard criado");
      },
      onError: () => {
         toast.error("Falha ao criar dashboard");
      },
   });

   const handleCreate = () => {
      createDashboardMutation.mutate({
         name: "New Dashboard",
         description: undefined,
      });
   };

   return (
      <main className="space-y-4">
         <DefaultHeader
            actions={
               <Button
                  disabled={createDashboardMutation.isPending}
                  onClick={handleCreate}
               >
                  <Plus className="h-4 w-4" />
                  Novo Dashboard
               </Button>
            }
            description="Crie e gerencie seus dashboards personalizados"
            title="Dashboards"
         />
         <DashboardsListSection />
      </main>
   );
}
