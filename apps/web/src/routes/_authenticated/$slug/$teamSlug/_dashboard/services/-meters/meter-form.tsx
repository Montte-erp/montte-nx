import { Button } from "@packages/ui/components/button";
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
import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { fromPromise } from "neverthrow";
import { toast } from "sonner";
import { z } from "zod";
import { useCredenza } from "@/hooks/use-credenza";
import type { Outputs } from "@/integrations/orpc/client";
import { orpc } from "@/integrations/orpc/client";

type Aggregation = "sum" | "count" | "count_unique" | "max" | "last";
type ExistingMeter = Outputs["meters"]["getMeters"][number];

const formSchema = z.object({
   name: z.string().min(2, "Mínimo 2 caracteres.").max(120),
   eventName: z
      .string()
      .min(1, "Evento obrigatório.")
      .regex(/^[a-z0-9_]+$/, "Use apenas a-z, 0-9, _."),
   aggregation: z.enum(["sum", "count", "count_unique", "max", "last"]),
   aggregationProperty: z.string().nullable(),
   unitCost: z.number().min(0),
});

const AGG_OPTIONS: { value: Aggregation; label: string; helper: string }[] = [
   { value: "sum", label: "Soma", helper: "Soma o valor de uma propriedade." },
   { value: "count", label: "Contagem", helper: "Conta cada evento." },
   {
      value: "count_unique",
      label: "Contagem única",
      helper: "Conta valores distintos de uma propriedade.",
   },
   { value: "max", label: "Máximo", helper: "Maior valor observado." },
   { value: "last", label: "Último", helper: "Último valor registrado." },
];

interface Props {
   existing?: ExistingMeter;
}

function Section({
   title,
   description,
   children,
   action,
}: {
   title: string;
   description?: string;
   children?: React.ReactNode;
   action?: React.ReactNode;
}) {
   return (
      <div className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0 [&:not(:first-child)]:border-t">
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

export function MeterForm({ existing }: Props) {
   const { closeTopCredenza } = useCredenza();
   const isEdit = !!existing;

   const createMutation = useMutation(
      orpc.meters.createMeter.mutationOptions({
         onSuccess: () => {
            toast.success("Medidor criado.");
            closeTopCredenza();
         },
         onError: (e) => toast.error(e.message),
      }),
   );

   const updateMutation = useMutation(
      orpc.meters.updateMeterById.mutationOptions({
         onSuccess: () => {
            toast.success("Medidor atualizado.");
            closeTopCredenza();
         },
         onError: (e) => toast.error(e.message),
      }),
   );

   const form = useForm({
      defaultValues: {
         name: existing?.name ?? "",
         eventName: existing?.eventName ?? "",
         aggregation: (existing?.aggregation ?? "sum") as Aggregation,
         aggregationProperty: existing?.aggregationProperty ?? null,
         unitCost: existing ? Number(existing.unitCost) : 0,
      },
      validators: { onChange: formSchema },
      onSubmit: async ({ value }) => {
         const payload = {
            name: value.name,
            eventName: value.eventName,
            aggregation: value.aggregation,
            aggregationProperty: value.aggregationProperty,
            unitCost: value.unitCost.toFixed(4),
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
            createMutation.mutateAsync({ ...payload, filters: {} }),
            (e) => e,
         );
         if (result.isErr()) return;
      },
   });

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>
               {isEdit ? "Editar medidor" : "Novo medidor"}
            </CredenzaTitle>
            <CredenzaDescription>
               Mede o uso de eventos para cobrança ou créditos de benefício.
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
                  description="Como o medidor aparece na UI."
                  title="Nome"
               >
                  <form.Field name="name">
                     {(field) => (
                        <Input
                           id={field.name}
                           name={field.name}
                           placeholder='Ex.: "Chamadas de IA"'
                           value={field.state.value}
                           onBlur={field.handleBlur}
                           onChange={(e) => field.handleChange(e.target.value)}
                        />
                     )}
                  </form.Field>
               </Section>

               <Section
                  description="Identificador do evento ingerido (snake_case, sem espaços)."
                  title="Evento"
               >
                  <form.Field name="eventName">
                     {(field) => (
                        <Input
                           id={field.name}
                           name={field.name}
                           placeholder="ai_completion_used"
                           value={field.state.value}
                           onBlur={field.handleBlur}
                           onChange={(e) =>
                              field.handleChange(
                                 e.target.value
                                    .toLowerCase()
                                    .replace(/[^a-z0-9_]/g, "_"),
                              )
                           }
                        />
                     )}
                  </form.Field>
               </Section>

               <form.Field name="aggregation">
                  {(field) => {
                     const opt = AGG_OPTIONS.find(
                        (o) => o.value === field.state.value,
                     );
                     return (
                        <Section description={opt?.helper} title="Agregação">
                           <div className="grid grid-cols-2 gap-4 pt-2">
                              <Select
                                 value={field.state.value}
                                 onValueChange={(v) =>
                                    field.handleChange(v as Aggregation)
                                 }
                              >
                                 <SelectTrigger id={field.name}>
                                    <SelectValue />
                                 </SelectTrigger>
                                 <SelectContent>
                                    {AGG_OPTIONS.map((o) => (
                                       <SelectItem
                                          key={o.value}
                                          value={o.value}
                                       >
                                          {o.label}
                                       </SelectItem>
                                    ))}
                                 </SelectContent>
                              </Select>
                              {field.state.value !== "count" ? (
                                 <form.Field name="aggregationProperty">
                                    {(prop) => (
                                       <Input
                                          id={prop.name}
                                          name={prop.name}
                                          placeholder="propriedade (ex: tokens)"
                                          value={prop.state.value ?? ""}
                                          onChange={(e) =>
                                             prop.handleChange(
                                                e.target.value || null,
                                             )
                                          }
                                       />
                                    )}
                                 </form.Field>
                              ) : null}
                           </div>
                        </Section>
                     );
                  }}
               </form.Field>

               <Section
                  description="Custo unitário do evento (até 4 decimais). Usado para calcular margem."
                  title="Custo unitário"
               >
                  <form.Field name="unitCost">
                     {(field) => (
                        <MoneyInput
                           id={field.name}
                           name={field.name}
                           value={field.state.value}
                           valueInCents={false}
                           onChange={(v) => field.handleChange(v ?? 0)}
                        />
                     )}
                  </form.Field>
               </Section>
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
                     {isEdit ? "Salvar" : "Criar medidor"}
                  </Button>
               )}
            </form.Subscribe>
         </CredenzaFooter>
      </>
   );
}
