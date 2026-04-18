import { Button } from "@packages/ui/components/button";
import { Label } from "@packages/ui/components/label";
import { Skeleton } from "@packages/ui/components/skeleton";
import { Switch } from "@packages/ui/components/switch";
import { useForm } from "@tanstack/react-form";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { Suspense } from "react";
import { toast } from "sonner";
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

   const form = useForm({
      defaultValues: {
         costCenterRequired: settings?.costCenterRequired ?? false,
      },
      onSubmit: ({ value }) => {
         mutation.mutate(value);
      },
   });

   return (
      <form
         className="max-w-lg"
         onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
         }}
      >
         <div className="flex flex-col gap-4">
            <div>
               <h3 className="text-lg font-medium">Financeiro</h3>
               <p className="text-sm text-muted-foreground">
                  Configure as preferências do módulo financeiro do seu espaço.
               </p>
            </div>

            <div className="flex flex-col gap-4">
               <form.Field
                  name="costCenterRequired"
                  children={(field) => (
                     <div className="flex items-center justify-between">
                        <Label htmlFor={field.name}>
                           Centro de custo obrigatório
                        </Label>
                        <Switch
                           id={field.name}
                           checked={field.state.value}
                           onCheckedChange={(v) => field.handleChange(v)}
                        />
                     </div>
                  )}
               />
            </div>

            <form.Subscribe selector={(s) => s.isSubmitting}>
               {(isSubmitting) => (
                  <Button
                     className="self-start"
                     disabled={isSubmitting || mutation.isPending}
                     type="submit"
                  >
                     {mutation.isPending && (
                        <Loader2 className="size-4 mr-2 animate-spin" />
                     )}
                     Salvar configurações
                  </Button>
               )}
            </form.Subscribe>
         </div>
      </form>
   );
}

function FinanceiroSettingsPage() {
   return (
      <Suspense
         fallback={
            <div className="flex flex-col gap-4 max-w-lg">
               {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton className="h-10 w-full" key={`skel-${i + 1}`} />
               ))}
            </div>
         }
      >
         <FinanceiroSettingsForm />
      </Suspense>
   );
}
