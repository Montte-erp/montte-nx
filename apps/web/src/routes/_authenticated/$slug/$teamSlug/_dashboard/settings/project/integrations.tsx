import { createFileRoute } from "@tanstack/react-router";
import { IntegrationFeedbackCard } from "@/features/integrations/ui/integration-feedback-card";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/settings/project/integrations",
)({
   component: ProjectIntegrationsPage,
});

function ProjectIntegrationsPage() {
   return (
      <div className="space-y-6">
         <div>
            <h1 className="text-2xl font-semibold font-serif">Integrações</h1>
            <p className="text-sm text-muted-foreground mt-1">
               Conecte ferramentas externas ao seu espaço e centralize sua operação.
            </p>
         </div>

         <IntegrationFeedbackCard />
      </div>
   );
}
