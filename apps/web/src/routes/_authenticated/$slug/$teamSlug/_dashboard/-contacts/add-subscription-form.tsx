import { Button } from "@packages/ui/components/button";
import { Combobox } from "@packages/ui/components/combobox";
import { DatePicker } from "@packages/ui/components/date-picker";
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

function ServiceSelect({
   value,
   onValueChange,
}: {
   value: string;
   onValueChange: (id: string) => void;
}) {
   const { data: services } = useSuspenseQuery(
      orpc.services.getAll.queryOptions({ input: {} }),
   );

   return (
      <Combobox
         options={services.map((s) => ({ value: s.id, label: s.name }))}
         value={value}
         onValueChange={onValueChange}
         placeholder="Selecione um serviço"
         searchPlaceholder="Buscar serviço..."
         emptyMessage="Nenhum serviço encontrado."
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
         startDate: dayjs().toDate() as Date | undefined,
      },
   });

   const canSubmit = useStore(
      form.store,
      (s) => !!s.values.serviceId && !!s.values.startDate,
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
               if (!values.serviceId || !values.startDate) return;
               openAlertDialog({
                  title: "Vincular assinatura",
                  description:
                     "Confirmar a vinculação desta assinatura ao contato?",
                  actionLabel: "Confirmar",
                  cancelLabel: "Cancelar",
                  onAction: async () => {
                     await createMutation.mutateAsync({
                        contactId,
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
                              value={field.state.value}
                              onValueChange={(id) => field.handleChange(id)}
                           />
                        </Suspense>
                     </div>
                  )}
               </form.Field>

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
