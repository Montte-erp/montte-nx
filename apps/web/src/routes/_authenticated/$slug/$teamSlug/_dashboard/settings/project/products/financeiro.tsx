import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/settings/project/products/financeiro",
)({
   component: FinanceiroSettingsPage,
});

function FinanceiroSettingsPage() {
   return (
      <div className="space-y-6">
         <div>
            <h3 className="text-lg font-medium">Financeiro</h3>
            <p className="text-sm text-muted-foreground">
               Configure as preferências do módulo financeiro do seu espaço.
            </p>
         </div>
      </div>
   );
}
