import { formatAmount, fromMinorUnits } from "@f-o-t/money";
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import {
   CredenzaBody,
   CredenzaDescription,
   CredenzaFooter,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import {
   Field,
   FieldError,
   FieldGroup,
   FieldLabel,
} from "@packages/ui/components/field";
import { Input } from "@packages/ui/components/input";
import { MoneyInput } from "@packages/ui/components/money-input";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
import { Spinner } from "@packages/ui/components/spinner";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useStore } from "@tanstack/react-store";
import { useMemo, useTransition } from "react";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SubscriptionFormProps {
   contactId: string;
   onSuccess: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SubscriptionForm({
   contactId,
   onSuccess,
}: SubscriptionFormProps) {
   const [isPending, startTransition] = useTransition();

   const { data: servicesList = [] } = useSuspenseQuery(
      orpc.services.getAll.queryOptions({}),
   );

   const createMutation = useMutation(
      orpc.services.createSubscription.mutationOptions({
         onError: () => {
            toast.error("Erro ao criar assinatura.");
         },
      }),
   );

   const today = new Date().toISOString().split("T")[0];

   const form = useForm({
      defaultValues: {
         serviceId: "",
         variantId: "",
         startDate: today,
         endDate: "",
         negotiatedPrice: 0,
         notes: "",
      },
      onSubmit: async ({ value }) => {
         await createMutation.mutateAsync({
            contactId,
            variantId: value.variantId,
            startDate: value.startDate,
            endDate: value.endDate || undefined,
            negotiatedPrice: value.negotiatedPrice,
            notes: value.notes.trim() || undefined,
         });

         toast.success("Assinatura criada.");
         onSuccess();
      },
   });

   const selectedServiceId = useStore(
      form.baseStore,
      (s) => s.values.serviceId,
   );
   const selectedVariantId = useStore(
      form.baseStore,
      (s) => s.values.variantId,
   );
   const negotiatedPrice = useStore(
      form.baseStore,
      (s) => s.values.negotiatedPrice,
   );

   const { data: variants = [] } = useQuery({
      ...orpc.services.getVariants.queryOptions({
         input: { serviceId: selectedServiceId },
      }),
      enabled: !!selectedServiceId,
   });

   const selectedVariant = useMemo(
      () => variants.find((v) => v.id === selectedVariantId) ?? null,
      [variants, selectedVariantId],
   );

   const discountPercent = useMemo(() => {
      if (
         !selectedVariant ||
         negotiatedPrice <= 0 ||
         negotiatedPrice >= selectedVariant.basePrice ||
         selectedVariant.basePrice <= 0
      )
         return null;
      const pct =
         ((selectedVariant.basePrice - negotiatedPrice) /
            selectedVariant.basePrice) *
         100;
      return pct > 0 ? pct.toFixed(1) : null;
   }, [selectedVariant, negotiatedPrice]);

   const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      e.stopPropagation();
      startTransition(async () => {
         await form.handleSubmit();
      });
   };

   return (
      <form className="h-full flex flex-col" onSubmit={handleSubmit}>
         <CredenzaHeader>
            <CredenzaTitle>Nova Assinatura</CredenzaTitle>
            <CredenzaDescription>
               Crie uma assinatura recorrente para o serviço.
            </CredenzaDescription>
         </CredenzaHeader>

         <CredenzaBody className="space-y-4">
            <FieldGroup>
               {/* Service select */}
               <form.Field name="serviceId">
                  {(field) => {
                     const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid;
                     return (
                        <Field data-invalid={isInvalid}>
                           <FieldLabel>Serviço *</FieldLabel>
                           <Select
                              onValueChange={(v) => {
                                 field.handleChange(v);
                                 form.setFieldValue("variantId", "");
                              }}
                              value={field.state.value}
                           >
                              <SelectTrigger>
                                 <SelectValue placeholder="Selecione o serviço" />
                              </SelectTrigger>
                              <SelectContent>
                                 {servicesList
                                    .filter((s) => s.isActive)
                                    .map((service) => (
                                       <SelectItem
                                          key={service.id}
                                          value={service.id}
                                       >
                                          {service.name}
                                       </SelectItem>
                                    ))}
                              </SelectContent>
                           </Select>
                           {isInvalid && (
                              <FieldError errors={field.state.meta.errors} />
                           )}
                        </Field>
                     );
                  }}
               </form.Field>

               {/* Variant select — only when service is selected */}
               {selectedServiceId && (
                  <form.Field name="variantId">
                     {(field) => {
                        const isInvalid =
                           field.state.meta.isTouched &&
                           !field.state.meta.isValid;
                        return (
                           <Field data-invalid={isInvalid}>
                              <FieldLabel>Variante *</FieldLabel>
                              <Select
                                 onValueChange={(v) => field.handleChange(v)}
                                 value={field.state.value}
                              >
                                 <SelectTrigger>
                                    <SelectValue placeholder="Selecione a variante" />
                                 </SelectTrigger>
                                 <SelectContent>
                                    {variants.map((variant) => (
                                       <SelectItem
                                          key={variant.id}
                                          value={variant.id}
                                       >
                                          {variant.name} —{" "}
                                          {formatAmount(
                                             fromMinorUnits(
                                                variant.basePrice,
                                                "BRL",
                                             ),
                                             "pt-BR",
                                          )}
                                       </SelectItem>
                                    ))}
                                 </SelectContent>
                              </Select>
                              {isInvalid && (
                                 <FieldError errors={field.state.meta.errors} />
                              )}
                           </Field>
                        );
                     }}
                  </form.Field>
               )}

               {/* Start date */}
               <form.Field name="startDate">
                  {(field) => {
                     const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid;
                     return (
                        <Field data-invalid={isInvalid}>
                           <FieldLabel>Data de início *</FieldLabel>
                           <Input
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                 field.handleChange(e.target.value)
                              }
                              type="date"
                              value={field.state.value}
                           />
                           {isInvalid && (
                              <FieldError errors={field.state.meta.errors} />
                           )}
                        </Field>
                     );
                  }}
               </form.Field>

               {/* End date */}
               <form.Field name="endDate">
                  {(field) => (
                     <Field>
                        <FieldLabel>Data de término</FieldLabel>
                        <Input
                           onBlur={field.handleBlur}
                           onChange={(e) => field.handleChange(e.target.value)}
                           type="date"
                           value={field.state.value}
                        />
                     </Field>
                  )}
               </form.Field>

               {/* Negotiated price */}
               <form.Field name="negotiatedPrice">
                  {(field) => {
                     const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid;
                     return (
                        <Field data-invalid={isInvalid}>
                           <div className="flex items-center gap-2">
                              <FieldLabel>Preço negociado *</FieldLabel>
                              {discountPercent !== null && (
                                 <Badge variant="secondary">
                                    {discountPercent}% de desconto
                                 </Badge>
                              )}
                           </div>
                           <MoneyInput
                              onBlur={field.handleBlur}
                              onChange={(v) => field.handleChange(v ?? 0)}
                              value={field.state.value}
                              valueInCents={true}
                           />
                           {selectedVariant && (
                              <p className="text-xs text-muted-foreground">
                                 Preço base:{" "}
                                 {formatAmount(
                                    fromMinorUnits(
                                       selectedVariant.basePrice,
                                       "BRL",
                                    ),
                                    "pt-BR",
                                 )}
                              </p>
                           )}
                           {isInvalid && (
                              <FieldError errors={field.state.meta.errors} />
                           )}
                        </Field>
                     );
                  }}
               </form.Field>

               {/* Notes */}
               <form.Field name="notes">
                  {(field) => (
                     <Field>
                        <FieldLabel>Observações</FieldLabel>
                        <Input
                           onBlur={field.handleBlur}
                           onChange={(e) => field.handleChange(e.target.value)}
                           placeholder="Ex: Desconto especial aprovado"
                           value={field.state.value}
                        />
                     </Field>
                  )}
               </form.Field>
            </FieldGroup>
         </CredenzaBody>

         <CredenzaFooter>
            <form.Subscribe>
               {(state) => (
                  <Button
                     className="w-full"
                     disabled={
                        !state.canSubmit ||
                        state.isSubmitting ||
                        isPending ||
                        createMutation.isPending
                     }
                     type="submit"
                  >
                     {(state.isSubmitting ||
                        isPending ||
                        createMutation.isPending) && (
                        <Spinner className="size-4 mr-2" />
                     )}
                     Criar assinatura
                  </Button>
               )}
            </form.Subscribe>
         </CredenzaFooter>
      </form>
   );
}
