import { Button } from "@packages/ui/components/button";
import { Label } from "@packages/ui/components/label";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
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
   "/_authenticated/$slug/$teamSlug/_dashboard/settings/project/products/contatos",
)({
   component: ContatosSettingsPage,
});

function ContatosSettingsForm() {
   const { data: settings } = useSuspenseQuery(
      orpc.contactSettings.getSettings.queryOptions({}),
   );
   const { data: tags } = useSuspenseQuery(orpc.tags.getAll.queryOptions({}));

   const mutation = useMutation(
      orpc.contactSettings.upsertSettings.mutationOptions({
         onSuccess: () => toast.success("Configurações salvas."),
         onError: (e) => toast.error(e.message),
      }),
   );

   const form = useForm({
      defaultValues: {
         defaultContactType: (settings?.defaultContactType ?? "pj") as
            | "pf"
            | "pj",
         duplicateDetectionEnabled: settings?.duplicateDetectionEnabled ?? true,
         requireTaxId: settings?.requireTaxId ?? false,
         defaultTagId: settings?.defaultTagId ?? null,
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
               <h3 className="text-lg font-medium">Contatos</h3>
               <p className="text-sm text-muted-foreground">
                  Configure as preferências do módulo de contatos do seu espaço.
               </p>
            </div>

            <div className="flex flex-col gap-4">
               <form.Field
                  name="defaultContactType"
                  children={(field) => (
                     <div className="flex flex-col gap-2">
                        <Label htmlFor={field.name}>
                           Tipo de contato padrão
                        </Label>
                        <Select
                           value={field.state.value}
                           onValueChange={(v) =>
                              field.handleChange(v as "pf" | "pj")
                           }
                        >
                           <SelectTrigger id={field.name}>
                              <SelectValue placeholder="Selecionar tipo…" />
                           </SelectTrigger>
                           <SelectContent>
                              <SelectItem value="pf">
                                 Pessoa Física (PF)
                              </SelectItem>
                              <SelectItem value="pj">
                                 Pessoa Jurídica (PJ)
                              </SelectItem>
                           </SelectContent>
                        </Select>
                     </div>
                  )}
               />

               <form.Field
                  name="duplicateDetectionEnabled"
                  children={(field) => (
                     <div className="flex items-center justify-between">
                        <Label htmlFor={field.name}>
                           Detecção de duplicatas
                        </Label>
                        <Switch
                           id={field.name}
                           checked={field.state.value}
                           onCheckedChange={(v) => field.handleChange(v)}
                        />
                     </div>
                  )}
               />

               <form.Field
                  name="requireTaxId"
                  children={(field) => (
                     <div className="flex items-center justify-between">
                        <Label htmlFor={field.name}>CPF/CNPJ obrigatório</Label>
                        <Switch
                           id={field.name}
                           checked={field.state.value}
                           onCheckedChange={(v) => field.handleChange(v)}
                        />
                     </div>
                  )}
               />

               <form.Field
                  name="defaultTagId"
                  children={(field) => (
                     <div className="flex flex-col gap-2">
                        <Label htmlFor={field.name}>
                           Centro de Custo padrão
                        </Label>
                        <Select
                           value={field.state.value ?? ""}
                           onValueChange={(v) => field.handleChange(v || null)}
                        >
                           <SelectTrigger id={field.name}>
                              <SelectValue placeholder="Selecionar centro de custo…" />
                           </SelectTrigger>
                           <SelectContent>
                              {tags.map((t) => (
                                 <SelectItem key={t.id} value={t.id}>
                                    {t.name}
                                 </SelectItem>
                              ))}
                           </SelectContent>
                        </Select>
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

function ContatosSettingsPage() {
   return (
      <Suspense
         fallback={
            <div className="flex flex-col gap-4 max-w-lg">
               {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton className="h-10 w-full" key={`skel-${i + 1}`} />
               ))}
            </div>
         }
      >
         <ContatosSettingsForm />
      </Suspense>
   );
}
