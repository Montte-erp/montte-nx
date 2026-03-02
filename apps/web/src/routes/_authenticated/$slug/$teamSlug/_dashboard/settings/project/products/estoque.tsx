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
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { Suspense, useCallback, useState } from "react";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/settings/project/products/estoque",
)({
   component: EstoqueSettingsPage,
});

function EstoqueSettingsForm() {
   const { data: settings } = useSuspenseQuery(
      orpc.inventory.getSettings.queryOptions({}),
   );
   const { data: bankAccounts } = useSuspenseQuery(
      orpc.bankAccounts.getAll.queryOptions({}),
   );
   const { data: categories } = useSuspenseQuery(
      orpc.categories.getAll.queryOptions({}),
   );
   const { data: creditCards } = useSuspenseQuery(
      orpc.creditCards.getAll.queryOptions({}),
   );

   const [form, setForm] = useState({
      purchaseBankAccountId: settings?.purchaseBankAccountId ?? "",
      purchaseCreditCardId: settings?.purchaseCreditCardId ?? "",
      purchaseCategoryId: settings?.purchaseCategoryId ?? "",
      saleCategoryId: settings?.saleCategoryId ?? "",
      wasteCategoryId: settings?.wasteCategoryId ?? "",
   });

   const mutation = useMutation(
      orpc.inventory.upsertSettings.mutationOptions({
         onSuccess: () => toast.success("Configurações salvas."),
         onError: (e) => toast.error(e.message),
      }),
   );

   const handleSave = useCallback(() => {
      mutation.mutate({
         purchaseBankAccountId: form.purchaseBankAccountId || null,
         purchaseCreditCardId: form.purchaseCreditCardId || null,
         purchaseCategoryId: form.purchaseCategoryId || null,
         saleCategoryId: form.saleCategoryId || null,
         wasteCategoryId: form.wasteCategoryId || null,
      });
   }, [mutation, form]);

   const expenseCategories = categories.filter(
      (c) => c.type === "expense" || c.type === null,
   );
   const incomeCategories = categories.filter(
      (c) => c.type === "income" || c.type === null,
   );

   return (
      <div className="space-y-6 max-w-lg">
         <div>
            <h3 className="text-lg font-medium">Estoque</h3>
            <p className="text-sm text-muted-foreground">
               Defina os padrões para transações criadas automaticamente ao
               registrar movimentos de estoque.
            </p>
         </div>

         <div className="space-y-4">
            <div className="space-y-1.5">
               <Label>Conta bancária padrão (compras)</Label>
               <Select
                  value={form.purchaseBankAccountId}
                  onValueChange={(v) =>
                     setForm((f) => ({ ...f, purchaseBankAccountId: v }))
                  }
               >
                  <SelectTrigger>
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

            <div className="space-y-1.5">
               <Label>Cartão de crédito padrão (compras)</Label>
               <Select
                  value={form.purchaseCreditCardId}
                  onValueChange={(v) =>
                     setForm((f) => ({ ...f, purchaseCreditCardId: v }))
                  }
               >
                  <SelectTrigger>
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

            <div className="space-y-1.5">
               <Label>Categoria para compras</Label>
               <Select
                  value={form.purchaseCategoryId}
                  onValueChange={(v) =>
                     setForm((f) => ({ ...f, purchaseCategoryId: v }))
                  }
               >
                  <SelectTrigger>
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

            <div className="space-y-1.5">
               <Label>Categoria para vendas</Label>
               <Select
                  value={form.saleCategoryId}
                  onValueChange={(v) =>
                     setForm((f) => ({ ...f, saleCategoryId: v }))
                  }
               >
                  <SelectTrigger>
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

            <div className="space-y-1.5">
               <Label>Categoria para descartes</Label>
               <Select
                  value={form.wasteCategoryId}
                  onValueChange={(v) =>
                     setForm((f) => ({ ...f, wasteCategoryId: v }))
                  }
               >
                  <SelectTrigger>
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
         </div>

         <Button disabled={mutation.isPending} onClick={handleSave}>
            {mutation.isPending && (
               <Loader2 className="size-4 mr-2 animate-spin" />
            )}
            Salvar configurações
         </Button>
      </div>
   );
}

function EstoqueSettingsPage() {
   return (
      <Suspense
         fallback={
            <div className="space-y-4 max-w-lg">
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
