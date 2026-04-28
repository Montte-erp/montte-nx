import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import {
   Collapsible,
   CollapsibleContent,
   CollapsibleTrigger,
} from "@packages/ui/components/collapsible";
import {
   CredenzaBody,
   CredenzaClose,
   CredenzaDescription,
   CredenzaFooter,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
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
import { useMutation, useSuspenseQueries } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { fromPromise } from "neverthrow";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { useCredenza } from "@/hooks/use-credenza";
import type { Outputs } from "@/integrations/orpc/client";
import { orpc } from "@/integrations/orpc/client";

type PricingType = "flat" | "per_unit" | "metered";
type Interval =
   | "hourly"
   | "shift"
   | "daily"
   | "weekly"
   | "monthly"
   | "semestral"
   | "annual"
   | "one_time";
type RecurringInterval = Exclude<Interval, "one_time">;
type Mode = "flat" | "per_unit" | "metered" | "one_time";
type ExistingPrice = Outputs["services"]["getVariants"][number];

const formSchema = z.object({
   name: z.string().min(1, "Nome é obrigatório.").max(120),
   mode: z.enum(["flat", "per_unit", "metered", "one_time"]),
   basePrice: z.number().min(0),
   interval: z.enum([
      "hourly",
      "shift",
      "daily",
      "weekly",
      "monthly",
      "semestral",
      "annual",
   ]),
   meterId: z.string().nullable(),
   minPrice: z.number().min(0).nullable(),
   priceCap: z.number().min(0).nullable(),
   trialDays: z.number().int().min(0).nullable(),
   autoEnroll: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

const RECURRING_INTERVALS: { value: RecurringInterval; label: string }[] = [
   { value: "hourly", label: "Por hora" },
   { value: "shift", label: "Por turno" },
   { value: "daily", label: "Diária" },
   { value: "weekly", label: "Semanal" },
   { value: "monthly", label: "Mensal" },
   { value: "semestral", label: "Semestral" },
   { value: "annual", label: "Anual" },
];

const MODE_HELPER: Record<Mode, string> = {
   flat: "Valor fixo cobrado a cada ciclo, independente do uso.",
   per_unit: "Valor multiplicado pela quantidade contratada (assentos).",
   metered: "Pay-as-you-go: cobra pelo consumo registrado por um medidor.",
   one_time: "Cobrança única no momento da contratação.",
};

const MODE_BASE_LABEL: Record<Mode, string> = {
   flat: "Valor",
   per_unit: "Valor por unidade",
   metered: "Valor por unidade consumida",
   one_time: "Valor",
};

function deriveMode(price?: ExistingPrice): Mode {
   if (!price) return "flat";
   if (price.type === "metered") return "metered";
   if (price.type === "per_unit") return "per_unit";
   if (price.interval === "one_time") return "one_time";
   return "flat";
}

function modeToDbType(mode: Mode): PricingType {
   if (mode === "metered") return "metered";
   if (mode === "per_unit") return "per_unit";
   return "flat";
}

interface PriceFormProps {
   serviceId: string;
   existing?: ExistingPrice;
}

function Section({
   title,
   description,
   children,
   action,
   className,
}: {
   title: string;
   description?: string;
   children?: React.ReactNode;
   action?: React.ReactNode;
   className?: string;
}) {
   return (
      <div
         className={`flex flex-col gap-2 py-4 first:pt-0 last:pb-0 [&:not(:first-child)]:border-t ${className ?? ""}`}
      >
         <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
               <span className="text-sm font-semibold">{title}</span>
               {description ? (
                  <span className="text-xs text-muted-foreground">
                     {description}
                  </span>
               ) : null}
            </div>
            {action}
         </div>
         {children}
      </div>
   );
}

function formatCost(value: number) {
   return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
   });
}

export function PriceForm({ serviceId, existing }: PriceFormProps) {
   const { closeTopCredenza } = useCredenza();
   const isEdit = !!existing;
   const [advancedOpen, setAdvancedOpen] = useState(false);

   const [{ data: meters }, { data: service }, { data: serviceBenefits }] =
      useSuspenseQueries({
         queries: [
            orpc.meters.getMeters.queryOptions({}),
            orpc.services.getById.queryOptions({ input: { id: serviceId } }),
            orpc.benefits.getServiceBenefits.queryOptions({
               input: { serviceId },
            }),
         ],
      });

   const createMutation = useMutation(
      orpc.services.createVariant.mutationOptions({
         onSuccess: () => {
            toast.success("Preço criado.");
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

   const initialMode = deriveMode(existing);
   const initialInterval: RecurringInterval =
      existing && existing.interval !== "one_time"
         ? existing.interval
         : "monthly";

   const defaults: FormValues = {
      name: existing?.name ?? "",
      mode: initialMode,
      basePrice: existing ? Number(existing.basePrice) : 0,
      interval: initialInterval,
      meterId: existing?.meterId ?? null,
      minPrice: existing?.minPrice ? Number(existing.minPrice) : null,
      priceCap: existing?.priceCap ? Number(existing.priceCap) : null,
      trialDays: existing?.trialDays ?? null,
      autoEnroll: existing?.autoEnroll ?? false,
   };

   const form = useForm({
      defaultValues: defaults,
      validators: { onChange: formSchema },
      onSubmit: async ({ value }) => {
         if (value.mode === "metered" && !value.meterId) {
            toast.error("Selecione um medidor para pay-as-you-go.");
            return;
         }

         const dbType = modeToDbType(value.mode);
         const dbInterval: Interval =
            value.mode === "one_time" ? "one_time" : value.interval;

         const payload = {
            name: value.name,
            type: dbType,
            basePrice: value.basePrice.toFixed(2),
            interval: dbInterval,
            meterId: value.mode === "metered" ? value.meterId : null,
            minPrice:
               value.minPrice !== null ? value.minPrice.toFixed(2) : null,
            priceCap:
               value.priceCap !== null ? value.priceCap.toFixed(2) : null,
            trialDays: value.mode === "one_time" ? null : value.trialDays,
            autoEnroll: value.mode === "one_time" ? false : value.autoEnroll,
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
               className="flex flex-col"
               onSubmit={(e) => {
                  e.preventDefault();
                  form.handleSubmit();
               }}
            >
               <Section
                  description="Nome interno exibido para clientes e nas faturas."
                  title="Nome"
               >
                  <form.Field name="name">
                     {(field) => {
                        const isInvalid =
                           field.state.meta.isTouched &&
                           field.state.meta.errors.length > 0;
                        return (
                           <Input
                              aria-invalid={isInvalid}
                              id={field.name}
                              name={field.name}
                              placeholder='Ex.: "Mensal Padrão"'
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                 field.handleChange(e.target.value)
                              }
                           />
                        );
                     }}
                  </form.Field>
               </Section>

               <form.Field name="mode">
                  {(modeField) => {
                     const mode = modeField.state.value;
                     return (
                        <>
                           <Section
                              action={
                                 <Tabs
                                    value={mode}
                                    onValueChange={(v) => {
                                       const next = v as Mode;
                                       modeField.handleChange(next);
                                       if (next === "metered") {
                                          form.setFieldValue("basePrice", 0);
                                       }
                                       if (next !== "metered") {
                                          form.setFieldValue("meterId", null);
                                       }
                                    }}
                                 >
                                    <TabsList>
                                       <TabsTrigger value="flat">
                                          Fixo
                                       </TabsTrigger>
                                       <TabsTrigger value="per_unit">
                                          Por unidade
                                       </TabsTrigger>
                                       <TabsTrigger value="metered">
                                          Pay-as-you-go
                                       </TabsTrigger>
                                       <TabsTrigger value="one_time">
                                          Único
                                       </TabsTrigger>
                                    </TabsList>
                                 </Tabs>
                              }
                              description={MODE_HELPER[mode]}
                              title="Modelo de cobrança"
                           >
                              <div className="grid grid-cols-2 gap-4 pt-2">
                                 <form.Field name="basePrice">
                                    {(field) => (
                                       <div className="flex flex-col gap-1.5">
                                          <span className="text-xs font-medium text-muted-foreground">
                                             {MODE_BASE_LABEL[mode]}
                                          </span>
                                          <MoneyInput
                                             id={field.name}
                                             name={field.name}
                                             value={field.state.value}
                                             valueInCents={false}
                                             onBlur={field.handleBlur}
                                             onChange={(v) =>
                                                field.handleChange(v ?? 0)
                                             }
                                          />
                                       </div>
                                    )}
                                 </form.Field>
                                 {mode === "one_time" ? null : (
                                    <form.Field name="interval">
                                       {(field) => (
                                          <div className="flex flex-col gap-1.5">
                                             <span className="text-xs font-medium text-muted-foreground">
                                                Ciclo de cobrança
                                             </span>
                                             <Select
                                                value={field.state.value}
                                                onValueChange={(v) =>
                                                   field.handleChange(
                                                      v as RecurringInterval,
                                                   )
                                                }
                                             >
                                                <SelectTrigger id={field.name}>
                                                   <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                   {RECURRING_INTERVALS.map(
                                                      (opt) => (
                                                         <SelectItem
                                                            key={opt.value}
                                                            value={opt.value}
                                                         >
                                                            {opt.label}
                                                         </SelectItem>
                                                      ),
                                                   )}
                                                </SelectContent>
                                             </Select>
                                          </div>
                                       )}
                                    </form.Field>
                                 )}
                              </div>

                              {mode === "metered" ? (
                                 <form.Field name="meterId">
                                    {(field) => {
                                       const meter = meters.find(
                                          (m) => m.id === field.state.value,
                                       );
                                       return (
                                          <div className="flex flex-col gap-1.5 pt-2">
                                             <div className="flex items-center justify-between">
                                                <span className="text-xs font-medium text-muted-foreground">
                                                   Medidor
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                   Sem medidor?{" "}
                                                   <a
                                                      className="font-medium text-foreground underline-offset-2 hover:underline"
                                                      href="../meters"
                                                   >
                                                      Gerenciar →
                                                   </a>
                                                </span>
                                             </div>
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
                                                      <SelectItem
                                                         key={m.id}
                                                         value={m.id}
                                                      >
                                                         {m.name}
                                                      </SelectItem>
                                                   ))}
                                                </SelectContent>
                                             </Select>
                                             {meter &&
                                             Number(meter.unitCost) > 0 ? (
                                                <span className="text-xs text-muted-foreground">
                                                   Custo do evento:{" "}
                                                   {formatCost(
                                                      Number(meter.unitCost),
                                                   )}
                                                </span>
                                             ) : null}
                                          </div>
                                       );
                                    }}
                                 </form.Field>
                              ) : null}
                           </Section>

                           <form.Subscribe
                              selector={(s) => [
                                 s.values.meterId,
                                 s.values.basePrice,
                                 s.values.minPrice,
                              ]}
                           >
                              {([meterIdVal, basePriceVal, minPriceVal]) => {
                                 const meter = meterIdVal
                                    ? meters.find((m) => m.id === meterIdVal)
                                    : undefined;
                                 const benefitsCost = serviceBenefits.reduce(
                                    (acc, b) =>
                                       acc +
                                       Number(b.unitCost) *
                                          (b.creditAmount ?? 1),
                                    0,
                                 );
                                 const meterCost =
                                    mode === "metered" && meter
                                       ? Number(meter.unitCost)
                                       : 0;
                                 const effectiveCost =
                                    Number(service.costPrice) +
                                    benefitsCost +
                                    meterCost;
                                 const base =
                                    typeof basePriceVal === "number"
                                       ? basePriceVal
                                       : 0;
                                 const min =
                                    typeof minPriceVal === "number"
                                       ? minPriceVal
                                       : null;
                                 const floor = Math.max(
                                    min ?? 0,
                                    effectiveCost,
                                 );
                                 const belowFloor = base > 0 && base < floor;
                                 const minBelowCost =
                                    min !== null &&
                                    min < effectiveCost &&
                                    effectiveCost > 0;

                                 return (
                                    <Section
                                       description={
                                          mode === "metered"
                                             ? "Custo é por unidade consumida (medidor + benefícios + custo base do serviço)."
                                             : "Custo total do ciclo (serviço + benefícios)."
                                       }
                                       title="Limites"
                                    >
                                       <div className="flex items-center justify-between rounded-md border bg-muted/40 p-3 text-xs">
                                          <span className="text-muted-foreground">
                                             Custo efetivo
                                          </span>
                                          <span className="font-medium tabular-nums">
                                             {formatCost(effectiveCost)}
                                          </span>
                                       </div>
                                       <div className="grid grid-cols-2 gap-4 pt-2">
                                          <form.Field name="minPrice">
                                             {(field) => (
                                                <div className="flex flex-col gap-1.5">
                                                   <span className="text-xs font-medium text-muted-foreground">
                                                      Piso (mínimo)
                                                   </span>
                                                   <MoneyInput
                                                      id={field.name}
                                                      name={field.name}
                                                      value={
                                                         field.state.value ??
                                                         undefined
                                                      }
                                                      valueInCents={false}
                                                      onChange={(v) =>
                                                         field.handleChange(
                                                            v ?? null,
                                                         )
                                                      }
                                                   />
                                                </div>
                                             )}
                                          </form.Field>
                                          <form.Field name="priceCap">
                                             {(field) => (
                                                <div className="flex flex-col gap-1.5">
                                                   <span className="text-xs font-medium text-muted-foreground">
                                                      Teto (cap)
                                                   </span>
                                                   <MoneyInput
                                                      id={field.name}
                                                      name={field.name}
                                                      value={
                                                         field.state.value ??
                                                         undefined
                                                      }
                                                      valueInCents={false}
                                                      onChange={(v) =>
                                                         field.handleChange(
                                                            v ?? null,
                                                         )
                                                      }
                                                   />
                                                </div>
                                             )}
                                          </form.Field>
                                       </div>
                                       {belowFloor || minBelowCost ? (
                                          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400">
                                             {minBelowCost
                                                ? `Piso ${formatCost(min ?? 0)} está abaixo do custo ${formatCost(effectiveCost)}.`
                                                : `Valor ${formatCost(base)} está abaixo do piso ${formatCost(floor)}.`}
                                          </div>
                                       ) : null}
                                    </Section>
                                 );
                              }}
                           </form.Subscribe>
                        </>
                     );
                  }}
               </form.Field>

               <Section
                  description="Benefícios incluídos no serviço impactam o custo efetivo deste preço."
                  title="Benefícios do serviço"
               >
                  {serviceBenefits.length === 0 ? (
                     <span className="text-xs text-muted-foreground">
                        Nenhum benefício linkado.{" "}
                        <a
                           className="font-medium text-foreground underline-offset-2 hover:underline"
                           href="../benefits"
                        >
                           Gerenciar benefícios →
                        </a>
                     </span>
                  ) : (
                     <div className="flex flex-wrap gap-2">
                        {serviceBenefits.map((b) => (
                           <Badge key={b.id} variant="outline">
                              {b.name}
                              {b.creditAmount
                                 ? ` · ${b.creditAmount.toLocaleString("pt-BR")}`
                                 : null}
                           </Badge>
                        ))}
                     </div>
                  )}
               </Section>

               <form.Subscribe
                  selector={(s) => [
                     s.values.mode,
                     s.values.trialDays,
                     s.values.autoEnroll,
                  ]}
               >
                  {([mode]) =>
                     mode === "one_time" ? null : (
                        <Collapsible
                           open={advancedOpen}
                           onOpenChange={setAdvancedOpen}
                        >
                           <div className="border-t py-4">
                              <CollapsibleTrigger asChild>
                                 <button
                                    className="group flex w-full items-center justify-between"
                                    type="button"
                                 >
                                    <div className="flex flex-col gap-1 text-left">
                                       <span className="text-sm font-semibold">
                                          Opções avançadas
                                       </span>
                                       <span className="text-xs text-muted-foreground">
                                          Trial e inscrição automática.
                                       </span>
                                    </div>
                                    <ChevronRight className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
                                 </button>
                              </CollapsibleTrigger>
                              <CollapsibleContent className="flex flex-col gap-4 pt-4">
                                 <form.Field name="trialDays">
                                    {(field) => (
                                       <div className="flex flex-col gap-1.5">
                                          <span className="text-xs font-medium text-muted-foreground">
                                             Trial (dias)
                                          </span>
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
                                                const n = Number.parseInt(
                                                   v,
                                                   10,
                                                );
                                                if (!Number.isNaN(n))
                                                   field.handleChange(n);
                                             }}
                                          />
                                       </div>
                                    )}
                                 </form.Field>
                                 <form.Field name="autoEnroll">
                                    {(field) => (
                                       <div className="flex items-center justify-between gap-4">
                                          <div className="flex flex-col gap-1">
                                             <span className="text-sm font-medium">
                                                Auto-enroll
                                             </span>
                                             <span className="text-xs text-muted-foreground">
                                                Inscrever automaticamente novos
                                                contatos neste preço.
                                             </span>
                                          </div>
                                          <Switch
                                             checked={field.state.value}
                                             id={field.name}
                                             onCheckedChange={
                                                field.handleChange
                                             }
                                          />
                                       </div>
                                    )}
                                 </form.Field>
                              </CollapsibleContent>
                           </div>
                        </Collapsible>
                     )
                  }
               </form.Subscribe>
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
                     {isEdit ? "Salvar" : "Criar preço"}
                  </Button>
               )}
            </form.Subscribe>
         </CredenzaFooter>
      </>
   );
}
