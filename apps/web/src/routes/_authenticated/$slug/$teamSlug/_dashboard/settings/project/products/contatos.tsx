import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/settings/project/products/contatos",
)({
   component: ContatosSettingsPage,
});

function ContatosSettingsPage() {
   return (
      <div className="space-y-6">
         <div>
            <h3 className="text-lg font-medium">Contatos</h3>
            <p className="text-sm text-muted-foreground">
               Configure as preferências do módulo de contatos do seu espaço.
            </p>
         </div>
      </div>
   );
}
