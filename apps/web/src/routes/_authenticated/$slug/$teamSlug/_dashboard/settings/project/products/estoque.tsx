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
import { useForm } from "@tanstack/react-form";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { Suspense } from "react";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/settings/project/products/estoque",
)({
   head: () => ({
      meta: [{ title: "Estoque — Montte" }],
   }),
   component: EstoqueSettingsPage,
});

function EstoqueSettingsForm() {
   const { data: settings } = useSuspenseQuery(
      orpc.inventory.getSettings.queryOptions({}),
   );
   const { data: bankAccounts } = useSuspenseQuery(
      orpc.bankAccounts.getAll.queryOptions({}),
   );
   const { data: categoriesResult } = useSuspenseQuery(
      orpc.categories.getAll.queryOptions({}),
   );
   const categories = categoriesResult;
   const { data: creditCards } = useSuspenseQuery(
      orpc.creditCards.getAll.queryOptions({ input: { pageSize: 100 } }),
   );

   const mutation = useMutation(
      orpc.inventory.upsertSettings.mutationOptions({
         onSuccess: () => toast.success("Configurações salvas."),
         onError: (e) => toast.error(e.message),
      }),
   );

   const form = useForm({
      defaultValues: {
         purchaseBankAccountId: settings?.purchaseBankAccountId ?? null,
         purchaseCreditCardId: settings?.purchaseCreditCardId ?? null,
         purchaseCategoryId: settings?.purchaseCategoryId ?? null,
         saleCategoryId: settings?.saleCategoryId ?? null,
         wasteCategoryId: settings?.wasteCategoryId ?? null,
      },
      onSubmit: ({ value }) => {
         mutation.mutate(value);
      },
   });

   const expenseCategories = categories.filter(
      (c) => c.type === "expense" || c.type === null,
   );
   const incomeCategories = categories.filter(
      (c) => c.type === "income" || c.type === null,
   );

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
               <h3 className="text-lg font-medium">Estoque</h3>
               <p className="text-sm text-muted-foreground">
                  Defina os padrões para transações criadas automaticamente ao
                  registrar movimentos de estoque.
               </p>
            </div>

            <div className="flex flex-col gap-4">
               <form.Field
                  name="purchaseBankAccountId"
                  children={(field) => (
                     <div className="flex flex-col gap-2">
                        <Label htmlFor={field.name}>
                           Conta bancária padrão (compras)
                        </Label>
                        <Select
                           value={field.state.value ?? ""}
                           onValueChange={(v) => field.handleChange(v || null)}
                        >
                           <SelectTrigger id={field.name}>
                              <SelectValue placeholder="Selecionar conta…" />
                           </SelectTrigger>
                           <SelectContent>
                              {bankAccounts.map((a) => (
                                 <SelectItem key={a.id} value={a.id}>
                                    {a.name}
                                 </SelectItem>
                              ))}
                           </SelectContent>
                        </Select>
                     </div>
                  )}
               />

               <form.Field
                  name="purchaseCreditCardId"
                  children={(field) => (
                     <div className="flex flex-col gap-2">
                        <Label htmlFor={field.name}>
                           Cartão de crédito padrão (compras)
                        </Label>
                        <Select
                           value={field.state.value ?? ""}
                           onValueChange={(v) => field.handleChange(v || null)}
                        >
                           <SelectTrigger id={field.name}>
                              <SelectValue placeholder="Selecionar cartão…" />
                           </SelectTrigger>
                           <SelectContent>
                              {creditCards.map((c) => (
                                 <SelectItem key={c.id} value={c.id}>
                                    {c.name}
                                 </SelectItem>
                              ))}
                           </SelectContent>
                        </Select>
                     </div>
                  )}
               />

               <form.Field
                  name="purchaseCategoryId"
                  children={(field) => (
                     <div className="flex flex-col gap-2">
                        <Label htmlFor={field.name}>
                           Categoria para compras
                        </Label>
                        <Select
                           value={field.state.value ?? ""}
                           onValueChange={(v) => field.handleChange(v || null)}
                        >
                           <SelectTrigger id={field.name}>
                              <SelectValue placeholder="Selecionar categoria…" />
                           </SelectTrigger>
                           <SelectContent>
                              {expenseCategories.map((c) => (
                                 <SelectItem key={c.id} value={c.id}>
                                    {c.name}
                                 </SelectItem>
                              ))}
                           </SelectContent>
                        </Select>
                     </div>
                  )}
               />

               <form.Field
                  name="saleCategoryId"
                  children={(field) => (
                     <div className="flex flex-col gap-2">
                        <Label htmlFor={field.name}>
                           Categoria para vendas
                        </Label>
                        <Select
                           value={field.state.value ?? ""}
                           onValueChange={(v) => field.handleChange(v || null)}
                        >
                           <SelectTrigger id={field.name}>
                              <SelectValue placeholder="Selecionar categoria…" />
                           </SelectTrigger>
                           <SelectContent>
                              {incomeCategories.map((c) => (
                                 <SelectItem key={c.id} value={c.id}>
                                    {c.name}
                                 </SelectItem>
                              ))}
                           </SelectContent>
                        </Select>
                     </div>
                  )}
               />

               <form.Field
                  name="wasteCategoryId"
                  children={(field) => (
                     <div className="flex flex-col gap-2">
                        <Label htmlFor={field.name}>
                           Categoria para descartes
                        </Label>
                        <Select
                           value={field.state.value ?? ""}
                           onValueChange={(v) => field.handleChange(v || null)}
                        >
                           <SelectTrigger id={field.name}>
                              <SelectValue placeholder="Selecionar categoria…" />
                           </SelectTrigger>
                           <SelectContent>
                              {expenseCategories.map((c) => (
                                 <SelectItem key={c.id} value={c.id}>
                                    {c.name}
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

function EstoqueSettingsPage() {
   return (
      <Suspense
         fallback={
            <div className="flex flex-col gap-4 max-w-lg">
               {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton className="h-10 w-full" key={`skel-${i + 1}`} />
               ))}
            </div>
         }
      >
         <EstoqueSettingsForm />
      </Suspense>
   );
}
