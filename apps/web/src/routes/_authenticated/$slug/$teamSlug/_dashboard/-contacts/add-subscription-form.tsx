import { Button } from "@packages/ui/components/button";
import {
   CredenzaBody,
   CredenzaFooter,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
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
import { useQueryClient } from "@tanstack/react-query";
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
      if (variant) {
         onPriceChange(variant.basePrice);
      }
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

export function AddSubscriptionForm({
   contactId,
   onSuccess,
}: {
   contactId: string;
   onSuccess: () => void;
}) {
   const { data: services } = useSuspenseQuery(
      orpc.services.getAll.queryOptions({ input: {} }),
   );
   const queryClient = useQueryClient();
   const { closeCredenza } = useCredenza();

   const [serviceId, setServiceId] = useState("");
   const [variantId, setVariantId] = useState("");
   const [startDate, setStartDate] = useState("");
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
         startDate,
         negotiatedPrice,
      });
   }

   return (
      <form onSubmit={handleSubmit}>
         <CredenzaHeader>
            <CredenzaTitle>Nova assinatura</CredenzaTitle>
         </CredenzaHeader>
         <CredenzaBody>
            <div className="flex flex-col gap-4">
               <div className="flex flex-col gap-2">
                  <Label htmlFor="serviceId">Serviço</Label>
                  <Select value={serviceId} onValueChange={handleServiceChange}>
                     <SelectTrigger id="serviceId">
                        <SelectValue placeholder="Selecione um serviço" />
                     </SelectTrigger>
                     <SelectContent>
                        {services.map((s) => (
                           <SelectItem key={s.id} value={s.id}>
                              {s.name}
                           </SelectItem>
                        ))}
                     </SelectContent>
                  </Select>
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
                  <Label htmlFor="startDate">Data de início</Label>
                  <input
                     className="rounded-md border px-3 py-2 text-sm outline-none focus:ring-1"
                     id="startDate"
                     placeholder="AAAA-MM-DD"
                     type="date"
                     value={startDate}
                     onChange={(e) => setStartDate(e.target.value)}
                  />
               </div>

               <div className="flex flex-col gap-2">
                  <Label htmlFor="negotiatedPrice">Preço negociado (R$)</Label>
                  <input
                     className="rounded-md border px-3 py-2 text-sm outline-none focus:ring-1"
                     id="negotiatedPrice"
                     placeholder="0.00"
                     step="0.01"
                     type="number"
                     value={negotiatedPrice}
                     onChange={(e) => setNegotiatedPrice(e.target.value)}
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
