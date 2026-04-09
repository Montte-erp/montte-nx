import { format, of } from "@f-o-t/money";
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
import {
   skipToken,
   useMutation,
   useSuspenseQuery,
} from "@tanstack/react-query";
import dayjs from "dayjs";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";

interface SubscriptionFormProps {
   contactId: string;
   onSuccess: () => void;
}

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

   const today = dayjs().format("YYYY-MM-DD");

   const form = useForm({
      defaultValues: {
         serviceId: "",
         variantId: "",
         startDate: today,
         endDate: "",
         negotiatedPrice: "0",
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

   const [selectedServiceId, setSelectedServiceId] = useState("");
   const [selectedVariantId, setSelectedVariantId] = useState("");
   const [negotiatedPrice, setNegotiatedPrice] = useState("0");

   const { data: variants = [] } = useSuspenseQuery(
      selectedServiceId
         ? orpc.services.getVariants.queryOptions({
              input: { serviceId: selectedServiceId },
           })
         : { queryKey: ["disabled-variants"], queryFn: skipToken },
   );

   const selectedVariant = useMemo(
      () => variants.find((v) => v.id === selectedVariantId) ?? null,
      [variants, selectedVariantId],
   );

   const discountPercent = useMemo(() => {
      const neg = Number(negotiatedPrice);
      const base = selectedVariant ? Number(selectedVariant.basePrice) : 0;
      if (!selectedVariant || neg <= 0 || neg >= base || base <= 0) return null;
      const pct = ((base - neg) / base) * 100;
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
      <form onSubmit={handleSubmit}>
         <CredenzaHeader>
            <CredenzaTitle>Nova Assinatura</CredenzaTitle>
            <CredenzaDescription>
               Crie uma assinatura recorrente para o serviço.
            </CredenzaDescription>
         </CredenzaHeader>

         <CredenzaBody className="px-4">
            <FieldGroup>
               <form.Field
                  name="serviceId"
                  children={(field) => {
                     const isInvalid =
                        field.state.meta.isTouched &&
                        field.state.meta.errors.length > 0;
                     return (
                        <Field data-invalid={isInvalid}>
                           <FieldLabel>Serviço *</FieldLabel>
                           <Select
                              onValueChange={(v) => {
                                 field.handleChange(v);
                                 setSelectedServiceId(v);
                                 form.setFieldValue("variantId", "");
                                 setSelectedVariantId("");
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
               />

               {selectedServiceId && (
                  <form.Field
                     name="variantId"
                     children={(field) => {
                        const isInvalid =
                           field.state.meta.isTouched &&
                           field.state.meta.errors.length > 0;
                        return (
                           <Field data-invalid={isInvalid}>
                              <FieldLabel>Variante *</FieldLabel>
                              <Select
                                 onValueChange={(v) => {
                                    field.handleChange(v);
                                    setSelectedVariantId(v);
                                 }}
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
                                          {format(
                                             of(variant.basePrice, "BRL"),
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
                  />
               )}

               <form.Field
                  name="startDate"
                  children={(field) => {
                     const isInvalid =
                        field.state.meta.isTouched &&
                        field.state.meta.errors.length > 0;
                     return (
                        <Field data-invalid={isInvalid}>
                           <FieldLabel htmlFor={field.name}>
                              Data de início *
                           </FieldLabel>
                           <Input
                              id={field.name}
                              name={field.name}
                              aria-invalid={isInvalid}
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
               />

               <form.Field
                  name="endDate"
                  children={(field) => {
                     const isInvalid =
                        field.state.meta.isTouched &&
                        field.state.meta.errors.length > 0;
                     return (
                        <Field>
                           <FieldLabel htmlFor={field.name}>
                              Data de término
                           </FieldLabel>
                           <Input
                              id={field.name}
                              name={field.name}
                              aria-invalid={isInvalid}
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                 field.handleChange(e.target.value)
                              }
                              type="date"
                              value={field.state.value}
                           />
                        </Field>
                     );
                  }}
               />

               <form.Field
                  name="negotiatedPrice"
                  children={(field) => {
                     const isInvalid =
                        field.state.meta.isTouched &&
                        field.state.meta.errors.length > 0;
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
                              onChange={(v) => {
                                 const val = String(v ?? 0);
                                 field.handleChange(val);
                                 setNegotiatedPrice(val);
                              }}
                              value={Number(field.state.value)}
                           />
                           {selectedVariant && (
                              <p className="text-xs text-muted-foreground">
                                 Preço base:{" "}
                                 {format(
                                    of(selectedVariant.basePrice, "BRL"),
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
               />

               <form.Field
                  name="notes"
                  children={(field) => {
                     const isInvalid =
                        field.state.meta.isTouched &&
                        field.state.meta.errors.length > 0;
                     return (
                        <Field>
                           <FieldLabel htmlFor={field.name}>
                              Observações
                           </FieldLabel>
                           <Input
                              id={field.name}
                              name={field.name}
                              aria-invalid={isInvalid}
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                 field.handleChange(e.target.value)
                              }
                              placeholder="Ex: Desconto especial aprovado"
                              value={field.state.value}
                           />
                        </Field>
                     );
                  }}
               />
            </FieldGroup>
         </CredenzaBody>

         <CredenzaFooter>
            <form.Subscribe
               selector={(state) =>
                  [state.canSubmit, state.isSubmitting] as const
               }
            >
               {([canSubmit, isSubmitting]) => (
                  <Button
                     className="w-full"
                     disabled={
                        !canSubmit ||
                        isSubmitting ||
                        isPending ||
                        createMutation.isPending
                     }
                     type="submit"
                  >
                     {(isSubmitting ||
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
