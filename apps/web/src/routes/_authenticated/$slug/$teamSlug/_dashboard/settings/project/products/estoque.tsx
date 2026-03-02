import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/settings/project/products/estoque",
)({
   component: EstoqueSettingsPage,
});

function EstoqueSettingsPage() {
   return (
      <div className="space-y-6">
         <div>
            <h3 className="text-lg font-medium">Estoque</h3>
            <p className="text-sm text-muted-foreground">
               Configure as preferências do módulo de estoque do seu espaço.
            </p>
         </div>
      </div>
   );
}
