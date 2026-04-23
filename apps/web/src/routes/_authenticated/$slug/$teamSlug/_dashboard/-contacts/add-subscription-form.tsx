import { Button } from "@packages/ui/components/button";
import { Combobox } from "@packages/ui/components/combobox";
import { DatePicker } from "@packages/ui/components/date-picker";
import { Input } from "@packages/ui/components/input";
import { Label } from "@packages/ui/components/label";
import {
   PopoverDescription,
   PopoverHeader,
   PopoverTitle,
} from "@packages/ui/components/popover";
import { Skeleton } from "@packages/ui/components/skeleton";
import { useForm } from "@tanstack/react-form";
import {
   useMutation,
   useQueryClient,
   useSuspenseQuery,
} from "@tanstack/react-query";
import { useStore } from "@tanstack/react-store";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import dayjs from "dayjs";
import { Suspense } from "react";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";

const BILLING_LABELS: Record<string, string> = {
   hourly: "por hora",
   monthly: "mensal",
   annual: "anual",
   one_time: "único",
};

function ServiceSelect({
   id,
   value,
   onValueChange,
}: {
   id: string;
   value: string;
   onValueChange: (id: string) => void;
}) {
   const { data: services } = useSuspenseQuery(
      orpc.services.getAll.queryOptions({ input: {} }),
   );

   return (
      <Combobox
         id={id}
         options={services.map((s) => ({ value: s.id, label: s.name }))}
         value={value}
         onValueChange={onValueChange}
         placeholder="Selecione um serviço"
         searchPlaceholder="Buscar serviço..."
         emptyMessage="Nenhum serviço encontrado."
      />
   );
}

function VariantSelect({
   id,
   serviceId,
   value,
   onVariantSelect,
}: {
   id: string;
   serviceId: string;
   value: string;
   onVariantSelect: (variantId: string, basePrice: string) => void;
}) {
   const { data: variants } = useSuspenseQuery(
      orpc.services.getVariants.queryOptions({ input: { serviceId } }),
   );

   return (
      <Combobox
         id={id}
         options={variants.map((v) => ({
            value: v.id,
            label: `${v.name} — ${BILLING_LABELS[v.billingCycle] ?? v.billingCycle}`,
         }))}
         value={value}
         onValueChange={(vid) => {
            const variant = variants.find((v) => v.id === vid);
            onVariantSelect(vid, variant?.basePrice ?? "0");
         }}
         placeholder="Selecione uma variante"
         searchPlaceholder="Buscar variante..."
         emptyMessage="Nenhuma variante encontrada."
      />
   );
}

export function AddSubscriptionForm({
   contactId,
   onSuccess,
}: {
   contactId: string;
   onSuccess: () => void;
}) {
   const queryClient = useQueryClient();
   const { openAlertDialog } = useAlertDialog();

   const createMutation = useMutation(
      orpc.services.createSubscription.mutationOptions({
         onSuccess: () => {
            toast.success("Assinatura criada.");
            queryClient.invalidateQueries({
               queryKey: orpc.services.getContactSubscriptions.queryKey({
                  input: { contactId },
               }),
            });
            onSuccess();
         },
         onError: (e) => toast.error(e.message),
      }),
   );

   const form = useForm({
      defaultValues: {
         serviceId: "",
         variantId: "",
         negotiatedPrice: "",
         startDate: dayjs().toDate() as Date | undefined,
      },
   });

   const serviceId = useStore(form.store, (s) => s.values.serviceId);
   const variantId = useStore(form.store, (s) => s.values.variantId);

   const canSubmit = useStore(
      form.store,
      (s) =>
         !!s.values.serviceId &&
         !!s.values.variantId &&
         !!s.values.negotiatedPrice &&
         !!s.values.startDate,
   );

   return (
      <>
         <PopoverHeader className="p-4 pb-0">
            <PopoverTitle>Nova assinatura</PopoverTitle>
            <PopoverDescription>
               Vincule este contato a um serviço para acompanhar cobranças e
               renovações.
            </PopoverDescription>
         </PopoverHeader>

         <form
            onSubmit={(e) => {
               e.preventDefault();
               const values = form.store.state.values;
               if (
                  !values.serviceId ||
                  !values.variantId ||
                  !values.negotiatedPrice ||
                  !values.startDate
               )
                  return;
               openAlertDialog({
                  title: "Vincular assinatura",
                  description:
                     "Confirmar a vinculação desta assinatura ao contato?",
                  actionLabel: "Confirmar",
                  cancelLabel: "Cancelar",
                  onAction: async () => {
                     await createMutation.mutateAsync({
                        contactId,
                        variantId: values.variantId,
                        negotiatedPrice: values.negotiatedPrice,
                        startDate: dayjs(values.startDate!).format(
                           "YYYY-MM-DD",
                        ),
                     });
                  },
               });
            }}
         >
            <div className="flex flex-col gap-4 p-4">
               <form.Field name="serviceId">
                  {(field) => (
                     <div className="flex flex-col gap-2">
                        <Label htmlFor={field.name}>Serviço</Label>
                        <Suspense
                           fallback={<Skeleton className="h-10 w-full" />}
                        >
                           <ServiceSelect
                              id={field.name}
                              value={field.state.value}
                              onValueChange={(id) => {
                                 field.handleChange(id);
                                 form.setFieldValue("variantId", "");
                                 form.setFieldValue("negotiatedPrice", "");
                              }}
                           />
                        </Suspense>
                     </div>
                  )}
               </form.Field>

               {serviceId && (
                  <form.Field name="variantId">
                     {(field) => (
                        <div className="flex flex-col gap-2">
                           <Label htmlFor={field.name}>Variante</Label>
                           <Suspense
                              fallback={<Skeleton className="h-10 w-full" />}
                           >
                              <VariantSelect
                                 id={field.name}
                                 serviceId={serviceId}
                                 value={field.state.value}
                                 onVariantSelect={(vid, basePrice) => {
                                    field.handleChange(vid);
                                    form.setFieldValue(
                                       "negotiatedPrice",
                                       basePrice,
                                    );
                                 }}
                              />
                           </Suspense>
                        </div>
                     )}
                  </form.Field>
               )}

               {variantId && (
                  <form.Field name="negotiatedPrice">
                     {(field) => (
                        <div className="flex flex-col gap-2">
                           <Label htmlFor={field.name}>Preço negociado</Label>
                           <Input
                              id={field.name}
                              type="number"
                              step="0.01"
                              min="0"
                              value={field.state.value}
                              onChange={(e) =>
                                 field.handleChange(e.target.value)
                              }
                              placeholder="0.00"
                           />
                        </div>
                     )}
                  </form.Field>
               )}

               <form.Field name="startDate">
                  {(field) => (
                     <div className="flex flex-col gap-2">
                        <Label>Data de início</Label>
                        <DatePicker
                           date={field.state.value}
                           onSelect={(d) => field.handleChange(d)}
                           placeholder="Selecione uma data"
                        />
                     </div>
                  )}
               </form.Field>
            </div>

            <div className="flex justify-end p-4 pt-0">
               <Button
                  type="submit"
                  disabled={!canSubmit || createMutation.isPending}
               >
                  {createMutation.isPending ? "Salvando..." : "Salvar"}
               </Button>
            </div>
         </form>
      </>
   );
}
