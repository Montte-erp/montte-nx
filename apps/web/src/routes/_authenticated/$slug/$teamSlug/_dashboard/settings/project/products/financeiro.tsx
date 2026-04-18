import { Label } from "@packages/ui/components/label";
import { Skeleton } from "@packages/ui/components/skeleton";
import { Switch } from "@packages/ui/components/switch";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { QueryBoundary } from "@/components/query-boundary";
import { orpc } from "@/integrations/orpc/client";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/settings/project/products/financeiro",
)({
   head: () => ({
      meta: [{ title: "Financeiro — Montte" }],
   }),
   component: FinanceiroSettingsPage,
});

function FinanceiroSettingsForm() {
   const { data: settings } = useSuspenseQuery(
      orpc.financialSettings.getSettings.queryOptions({}),
   );

   const mutation = useMutation(
      orpc.financialSettings.upsertSettings.mutationOptions({
         onSuccess: () => toast.success("Configurações salvas."),
         onError: (e) => toast.error(e.message),
      }),
   );

   return (
      <div className="flex flex-col gap-4 max-w-lg">
         <div>
            <h3 className="text-lg font-medium">Financeiro</h3>
            <p className="text-sm text-muted-foreground">
               Configure as preferências financeiras do seu espaço.
            </p>
         </div>

         <div className="flex items-center justify-between">
            <Label htmlFor="cost-center-required">
               Centro de Custo obrigatório nos lançamentos
            </Label>
            <Switch
               id="cost-center-required"
               checked={settings?.costCenterRequired ?? false}
               disabled={mutation.isPending}
               onCheckedChange={(checked) =>
                  mutation.mutate({ costCenterRequired: checked })
               }
            />
         </div>
      </div>
   );
}

function FinanceiroSettingsPage() {
   return (
      <QueryBoundary
         fallback={<Skeleton className="h-10 w-full max-w-lg" />}
         errorTitle="Erro ao carregar configurações"
      >
         <FinanceiroSettingsForm />
      </QueryBoundary>
   );
}
