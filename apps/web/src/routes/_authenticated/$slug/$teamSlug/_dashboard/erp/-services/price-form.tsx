import { Button } from "@packages/ui/components/button";
import {
   CredenzaBody,
   CredenzaClose,
   CredenzaDescription,
   CredenzaFooter,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import { FieldGroup, FieldLabel } from "@packages/ui/components/field";
import { Input } from "@packages/ui/components/input";
import { MoneyInput } from "@packages/ui/components/money-input";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
import { Switch } from "@packages/ui/components/switch";
import { Tabs, TabsList, TabsTrigger } from "@packages/ui/components/tabs";
import { useForm } from "@tanstack/react-form";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { fromPromise } from "neverthrow";
import { z } from "zod";
import type { Outputs } from "@/integrations/orpc/client";
import { orpc } from "@/integrations/orpc/client";
import { useCredenza } from "@/hooks/use-credenza";

type PricingType = "flat" | "per_unit" | "metered";
type Interval = "hourly" | "monthly" | "annual" | "one_time";
type ExistingPrice = Outputs["services"]["getVariants"][number];

const formSchema = z.object({
   name: z.string().min(1, "Nome é obrigatório.").max(120),
   type: z.enum(["flat", "per_unit", "metered"]),
   basePrice: z.number().min(0),
   interval: z.enum(["hourly", "monthly", "annual", "one_time"]),
   meterId: z.string().nullable(),
   trialDays: z.number().int().min(0).nullable(),
   priceCap: z.number().min(0).nullable(),
   autoEnroll: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

const INTERVAL_OPTIONS: { value: Interval; label: string }[] = [
   { value: "monthly", label: "Mensal" },
   { value: "annual", label: "Anual" },
   { value: "hourly", label: "Por hora" },
   { value: "one_time", label: "Único" },
];

interface PriceFormProps {
   serviceId: string;
   existing?: ExistingPrice;
}

export function PriceForm({ serviceId, existing }: PriceFormProps) {
   const { closeTopCredenza } = useCredenza();
   const isEdit = !!existing;

   const { data: meters } = useSuspenseQuery(
      orpc.meters.getMeters.queryOptions({}),
   );

   const [selectedType, setSelectedType] = useState<PricingType>(
      existing?.type ?? "flat",
   );

   const createMutation = useMutation(
      orpc.services.createVariant.mutationOptions({
         onSuccess: () => {
            toast.success("Preço criado com sucesso.");
            closeTopCredenza();
         },
         onError: (e) => toast.error(e.message),
      }),
   );

   const updateMutation = useMutation(
      orpc.services.updateVariant.mutationOptions({
         onSuccess: () => {
            toast.success("Preço atualizado.");
            closeTopCredenza();
         },
         onError: (e) => toast.error(e.message),
      }),
   );

   const defaults: FormValues = {
      name: existing?.name ?? "",
      type: existing?.type ?? "flat",
      basePrice: existing ? Number(existing.basePrice) : 0,
      interval: existing?.interval ?? "monthly",
      meterId: existing?.meterId ?? null,
      trialDays: existing?.trialDays ?? null,
      priceCap: existing?.priceCap ? Number(existing.priceCap) : null,
      autoEnroll: existing?.autoEnroll ?? false,
   };

   const form = useForm({
      defaultValues: defaults,
      validators: { onChange: formSchema },
      onSubmit: async ({ value }) => {
         if (value.type === "metered" && !value.meterId) {
            toast.error("Selecione um medidor para preços medidos.");
            return;
         }
         if (value.type === "metered" && value.basePrice !== 0) {
            toast.error("Preços medidos devem ter valor base R$ 0,00.");
            return;
         }

         const payload = {
            name: value.name,
            type: value.type,
            basePrice: value.basePrice.toFixed(2),
            interval: value.interval,
            meterId: value.meterId,
            trialDays: value.trialDays,
            priceCap:
               value.priceCap !== null ? value.priceCap.toFixed(2) : null,
            autoEnroll: value.autoEnroll,
         };

         if (isEdit) {
            const result = await fromPromise(
               updateMutation.mutateAsync({ id: existing.id, ...payload }),
               (e) => e,
            );
            if (result.isErr()) return;
            return;
         }

         const result = await fromPromise(
            createMutation.mutateAsync({ serviceId, ...payload }),
            (e) => e,
         );
         if (result.isErr()) return;
      },
   });

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>
               {isEdit ? "Editar preço" : "Novo preço"}
            </CredenzaTitle>
            <CredenzaDescription>
               Defina como este serviço é cobrado.
            </CredenzaDescription>
         </CredenzaHeader>

         <CredenzaBody>
            <form
               className="flex flex-col gap-4"
               onSubmit={(e) => {
                  e.preventDefault();
                  form.handleSubmit();
               }}
            >
               <FieldGroup>
                  <FieldLabel>Tipo</FieldLabel>
                  <Tabs
                     value={selectedType}
                     onValueChange={(v) => {
                        const t = v as PricingType;
                        setSelectedType(t);
                        form.setFieldValue("type", t);
                        if (t === "metered") {
                           form.setFieldValue("basePrice", 0);
                        }
                     }}
                  >
                     <TabsList className="w-full">
                        <TabsTrigger className="flex-1" value="flat">
                           Fixo
                        </TabsTrigger>
                        <TabsTrigger className="flex-1" value="per_unit">
                           Por unidade
                        </TabsTrigger>
                        <TabsTrigger className="flex-1" value="metered">
                           Medido
                        </TabsTrigger>
                     </TabsList>
                  </Tabs>
               </FieldGroup>

               <form.Field name="name">
                  {(field) => {
                     const isInvalid =
                        field.state.meta.isTouched &&
                        field.state.meta.errors.length > 0;
                     return (
                        <FieldGroup>
                           <FieldLabel htmlFor={field.name}>Nome</FieldLabel>
                           <Input
                              aria-invalid={isInvalid}
                              id={field.name}
                              name={field.name}
                              placeholder="Ex.: Mensal Padrão"
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                 field.handleChange(e.target.value)
                              }
                           />
                        </FieldGroup>
                     );
                  }}
               </form.Field>

               <div className="grid grid-cols-2 gap-4">
                  <form.Field name="basePrice">
                     {(field) => (
                        <FieldGroup>
                           <FieldLabel htmlFor={field.name}>Valor</FieldLabel>
                           <MoneyInput
                              aria-invalid={
                                 field.state.meta.isTouched &&
                                 field.state.meta.errors.length > 0
                              }
                              disabled={selectedType === "metered"}
                              id={field.name}
                              name={field.name}
                              valueInCents={false}
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(v) => field.handleChange(v ?? 0)}
                           />
                        </FieldGroup>
                     )}
                  </form.Field>
                  <form.Field name="interval">
                     {(field) => (
                        <FieldGroup>
                           <FieldLabel htmlFor={field.name}>
                              Intervalo
                           </FieldLabel>
                           <Select
                              value={field.state.value}
                              onValueChange={(v) =>
                                 field.handleChange(v as Interval)
                              }
                           >
                              <SelectTrigger id={field.name}>
                                 <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                 {INTERVAL_OPTIONS.map((opt) => (
                                    <SelectItem
                                       key={opt.value}
                                       value={opt.value}
                                    >
                                       {opt.label}
                                    </SelectItem>
                                 ))}
                              </SelectContent>
                           </Select>
                        </FieldGroup>
                     )}
                  </form.Field>
               </div>

               {selectedType === "metered" && (
                  <form.Field name="meterId">
                     {(field) => (
                        <FieldGroup>
                           <FieldLabel htmlFor={field.name}>Medidor</FieldLabel>
                           <Select
                              value={field.state.value ?? ""}
                              onValueChange={(v) =>
                                 field.handleChange(v || null)
                              }
                           >
                              <SelectTrigger id={field.name}>
                                 <SelectValue placeholder="Selecionar medidor" />
                              </SelectTrigger>
                              <SelectContent>
                                 {meters.map((m) => (
                                    <SelectItem key={m.id} value={m.id}>
                                       {m.name}
                                    </SelectItem>
                                 ))}
                              </SelectContent>
                           </Select>
                        </FieldGroup>
                     )}
                  </form.Field>
               )}

               <div className="grid grid-cols-2 gap-4">
                  <form.Field name="trialDays">
                     {(field) => (
                        <FieldGroup>
                           <FieldLabel htmlFor={field.name}>
                              Trial (dias)
                           </FieldLabel>
                           <Input
                              id={field.name}
                              inputMode="numeric"
                              name={field.name}
                              placeholder="0"
                              value={field.state.value ?? ""}
                              onChange={(e) => {
                                 const v = e.target.value;
                                 if (v === "") {
                                    field.handleChange(null);
                                    return;
                                 }
                                 const n = Number.parseInt(v, 10);
                                 if (!Number.isNaN(n)) field.handleChange(n);
                              }}
                           />
                        </FieldGroup>
                     )}
                  </form.Field>
                  <form.Field name="priceCap">
                     {(field) => (
                        <FieldGroup>
                           <FieldLabel htmlFor={field.name}>
                              Cap de cobrança
                           </FieldLabel>
                           <MoneyInput
                              id={field.name}
                              name={field.name}
                              valueInCents={false}
                              value={field.state.value ?? undefined}
                              onChange={(v) => field.handleChange(v ?? null)}
                           />
                        </FieldGroup>
                     )}
                  </form.Field>
               </div>

               <form.Field name="autoEnroll">
                  {(field) => (
                     <FieldGroup className="flex flex-row items-center justify-between">
                        <FieldLabel htmlFor={field.name}>
                           Auto-enroll
                        </FieldLabel>
                        <Switch
                           checked={field.state.value}
                           id={field.name}
                           onCheckedChange={field.handleChange}
                        />
                     </FieldGroup>
                  )}
               </form.Field>
            </form>
         </CredenzaBody>

         <CredenzaFooter>
            <CredenzaClose asChild>
               <Button variant="outline">Cancelar</Button>
            </CredenzaClose>
            <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting]}>
               {([canSubmit, isSubmitting]) => (
                  <Button
                     disabled={!canSubmit || isSubmitting}
                     onClick={() => form.handleSubmit()}
                  >
                     {isEdit ? "Salvar" : "Criar"}
                  </Button>
               )}
            </form.Subscribe>
         </CredenzaFooter>
      </>
   );
}
