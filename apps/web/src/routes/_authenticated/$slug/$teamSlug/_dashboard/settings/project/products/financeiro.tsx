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
import dayjs from "dayjs";
import "dayjs/locale/pt-br";
import { Loader2 } from "lucide-react";
import { Suspense } from "react";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";

dayjs.locale("pt-br");

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/settings/project/products/financeiro",
)({
   component: FinanceiroSettingsPage,
});

const CURRENCIES = [
   { value: "BRL", label: "Real Brasileiro (BRL)" },
   { value: "USD", label: "Dólar Americano (USD)" },
   { value: "EUR", label: "Euro (EUR)" },
];

const MONTHS = Array.from({ length: 12 }, (_, i) => ({
   value: i + 1,
   label: dayjs().month(i).format("MMMM"),
}));

const DUE_DAYS = [7, 14, 30, 45, 60];

function FinanceiroSettingsForm() {
   const { data: settings } = useSuspenseQuery(
      orpc.financialSettings.getSettings.queryOptions({}),
   );
   const { data: bankAccounts } = useSuspenseQuery(
      orpc.bankAccounts.getAll.queryOptions({}),
   );

   const mutation = useMutation(
      orpc.financialSettings.upsertSettings.mutationOptions({
         onSuccess: () => toast.success("Configurações salvas."),
         onError: (e) => toast.error(e.message),
      }),
   );

   const form = useForm({
      defaultValues: {
         defaultCurrency: settings?.defaultCurrency ?? "BRL",
         fiscalYearStartMonth: settings?.fiscalYearStartMonth ?? 1,
         defaultPaymentDueDays: settings?.defaultPaymentDueDays ?? 30,
         autoCategorizationEnabled: settings?.autoCategorizationEnabled ?? true,
         defaultIncomeBankAccountId:
            settings?.defaultIncomeBankAccountId ?? null,
         defaultExpenseBankAccountId:
            settings?.defaultExpenseBankAccountId ?? null,
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
               <form.Field name="defaultCurrency">
                  {(field) => (
                     <div className="flex flex-col gap-2">
                        <Label htmlFor={field.name}>Moeda padrão</Label>
                        <Select
                           value={field.state.value}
                           onValueChange={(v) => field.handleChange(v)}
                        >
                           <SelectTrigger id={field.name}>
                              <SelectValue placeholder="Selecionar moeda…" />
                           </SelectTrigger>
                           <SelectContent>
                              {CURRENCIES.map((c) => (
                                 <SelectItem key={c.value} value={c.value}>
                                    {c.label}
                                 </SelectItem>
                              ))}
                           </SelectContent>
                        </Select>
                     </div>
                  )}
               </form.Field>

               <form.Field name="fiscalYearStartMonth">
                  {(field) => (
                     <div className="flex flex-col gap-2">
                        <Label htmlFor={field.name}>Início do ano fiscal</Label>
                        <Select
                           value={String(field.state.value)}
                           onValueChange={(v) => field.handleChange(Number(v))}
                        >
                           <SelectTrigger id={field.name}>
                              <SelectValue placeholder="Selecionar mês…" />
                           </SelectTrigger>
                           <SelectContent>
                              {MONTHS.map((m) => (
                                 <SelectItem
                                    key={m.value}
                                    value={String(m.value)}
                                 >
                                    {m.label}
                                 </SelectItem>
                              ))}
                           </SelectContent>
                        </Select>
                     </div>
                  )}
               </form.Field>

               <form.Field name="defaultPaymentDueDays">
                  {(field) => (
                     <div className="flex flex-col gap-2">
                        <Label htmlFor={field.name}>
                           Prazo padrão de vencimento
                        </Label>
                        <Select
                           value={String(field.state.value)}
                           onValueChange={(v) => field.handleChange(Number(v))}
                        >
                           <SelectTrigger id={field.name}>
                              <SelectValue placeholder="Selecionar prazo…" />
                           </SelectTrigger>
                           <SelectContent>
                              {DUE_DAYS.map((d) => (
                                 <SelectItem key={d} value={String(d)}>
                                    {d} dias
                                 </SelectItem>
                              ))}
                           </SelectContent>
                        </Select>
                     </div>
                  )}
               </form.Field>

               <form.Field name="autoCategorizationEnabled">
                  {(field) => (
                     <div className="flex items-center justify-between">
                        <Label htmlFor={field.name}>
                           Categorização automática
                        </Label>
                        <Switch
                           id={field.name}
                           checked={field.state.value}
                           onCheckedChange={(v) => field.handleChange(v)}
                        />
                     </div>
                  )}
               </form.Field>

               <form.Field name="defaultIncomeBankAccountId">
                  {(field) => (
                     <div className="flex flex-col gap-2">
                        <Label htmlFor={field.name}>
                           Conta padrão para receitas
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
               </form.Field>

               <form.Field name="defaultExpenseBankAccountId">
                  {(field) => (
                     <div className="flex flex-col gap-2">
                        <Label htmlFor={field.name}>
                           Conta padrão para despesas
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
               </form.Field>
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
               {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton className="h-10 w-full" key={`skel-${i + 1}`} />
               ))}
            </div>
         }
      >
         <FinanceiroSettingsForm />
      </Suspense>
   );
}
