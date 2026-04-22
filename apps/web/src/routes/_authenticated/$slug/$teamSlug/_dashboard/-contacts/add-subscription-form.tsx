import { Button } from "@packages/ui/components/button";
import { Combobox } from "@packages/ui/components/combobox";
import {
   CredenzaBody,
   CredenzaDescription,
   CredenzaFooter,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import { DatePicker } from "@packages/ui/components/date-picker";
import { Label } from "@packages/ui/components/label";
import { MoneyInput } from "@packages/ui/components/money-input";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
import { Skeleton } from "@packages/ui/components/skeleton";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import type { Outputs } from "@/integrations/orpc/client";
import { orpc } from "@/integrations/orpc/client";
import { useCredenza } from "@/hooks/use-credenza";

type Variant = Outputs["services"]["getVariants"][number];

const BILLING_CYCLE_LABELS: Record<string, string> = {
   hourly: "Por hora",
   monthly: "Mensal",
   annual: "Anual",
   one_time: "Único",
};

function VariantSelector({
   serviceId,
   selectedVariantId,
   onSelect,
   onPriceChange,
}: {
   serviceId: string;
   selectedVariantId: string;
   onSelect: (variantId: string) => void;
   onPriceChange: (price: string) => void;
}) {
   const { data: variants } = useSuspenseQuery(
      orpc.services.getVariants.queryOptions({ input: { serviceId } }),
   );

   function handleVariantChange(variantId: string) {
      onSelect(variantId);
      const variant = variants.find((v) => v.id === variantId);
      if (variant) onPriceChange(variant.basePrice);
   }

   return (
      <div className="flex flex-col gap-2">
         <Label htmlFor="variantId">Variante</Label>
         <Select value={selectedVariantId} onValueChange={handleVariantChange}>
            <SelectTrigger id="variantId">
               <SelectValue placeholder="Selecione uma variante" />
            </SelectTrigger>
            <SelectContent>
               {variants.map((v: Variant) => (
                  <SelectItem key={v.id} value={v.id}>
                     {v.name} —{" "}
                     {BILLING_CYCLE_LABELS[v.billingCycle] ?? v.billingCycle}
                  </SelectItem>
               ))}
            </SelectContent>
         </Select>
      </div>
   );
}

function ServiceCombobox({
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
   const { closeCredenza } = useCredenza();

   const [serviceId, setServiceId] = useState("");
   const [variantId, setVariantId] = useState("");
   const [startDate, setStartDate] = useState<Date | undefined>(
      dayjs().toDate(),
   );
   const [negotiatedPrice, setNegotiatedPrice] = useState("");

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
            closeCredenza();
         },
         onError: (e) => toast.error(e.message),
      }),
   );

   function handleServiceChange(id: string) {
      setServiceId(id);
      setVariantId("");
      setNegotiatedPrice("");
   }

   function handleSubmit(e: React.FormEvent) {
      e.preventDefault();
      if (!variantId || !startDate || !negotiatedPrice) return;
      createMutation.mutate({
         contactId,
         variantId,
         startDate: dayjs(startDate).format("YYYY-MM-DD"),
         negotiatedPrice,
      });
   }

   return (
      <form onSubmit={handleSubmit}>
         <CredenzaHeader>
            <CredenzaTitle>Nova assinatura</CredenzaTitle>
            <CredenzaDescription>
               Vincule este contato a um serviço para acompanhar cobranças e
               renovações.
            </CredenzaDescription>
         </CredenzaHeader>
         <CredenzaBody>
            <div className="flex flex-col gap-4">
               <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                     <Label>Serviço</Label>
                     <Suspense fallback={<Skeleton className="h-10 w-full" />}>
                        <ServiceCombobox
                           value={serviceId}
                           onValueChange={handleServiceChange}
                        />
                     </Suspense>
                  </div>

                  <div className="flex flex-col gap-2">
                     <Label>Data de início</Label>
                     <DatePicker
                        date={startDate}
                        onSelect={setStartDate}
                        placeholder="Selecione uma data"
                     />
                  </div>
               </div>

               {serviceId && (
                  <Suspense fallback={<Skeleton className="h-10 w-full" />}>
                     <VariantSelector
                        serviceId={serviceId}
                        selectedVariantId={variantId}
                        onPriceChange={setNegotiatedPrice}
                        onSelect={setVariantId}
                     />
                  </Suspense>
               )}

               <div className="flex flex-col gap-2">
                  <Label htmlFor="negotiatedPrice">Preço negociado</Label>
                  <MoneyInput
                     id="negotiatedPrice"
                     value={negotiatedPrice}
                     onValueChange={setNegotiatedPrice}
                     placeholder="R$ 0,00"
                  />
               </div>
            </div>
         </CredenzaBody>
         <CredenzaFooter>
            <Button
               disabled={
                  !variantId ||
                  !startDate ||
                  !negotiatedPrice ||
                  createMutation.isPending
               }
               type="submit"
            >
               {createMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
         </CredenzaFooter>
      </form>
   );
}
