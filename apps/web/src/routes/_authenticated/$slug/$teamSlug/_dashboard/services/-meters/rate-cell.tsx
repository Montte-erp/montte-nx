import { Button } from "@packages/ui/components/button";
import { Field, FieldError, FieldLabel } from "@packages/ui/components/field";
import { Input } from "@packages/ui/components/input";
import { MoneyInput } from "@packages/ui/components/money-input";
import {
   Popover,
   PopoverContent,
   PopoverTrigger,
} from "@packages/ui/components/popover";
import { useForm } from "@tanstack/react-form";
import { fromPromise } from "neverthrow";
import { useState } from "react";
import { toast } from "@packages/ui/components/sonner";
import { z } from "zod";

interface Props {
   unitCost: string;
   onSave: (unitCost: string) => Promise<void>;
}

interface Preset {
   id: string;
   label: string;
   quantity: number;
   unitLabel: string;
}

const PRESETS: Preset[] = [
   { id: "unit", label: "/ unidade", quantity: 1, unitLabel: "unidade" },
   {
      id: "k_tokens",
      label: "/ 1k tokens",
      quantity: 1_000,
      unitLabel: "1k tokens",
   },
   {
      id: "m_tokens",
      label: "/ 1M tokens",
      quantity: 1_000_000,
      unitLabel: "Mtoken",
   },
   { id: "gb", label: "/ GB", quantity: 1_000_000_000, unitLabel: "GB" },
   { id: "mb", label: "/ MB", quantity: 1_000_000, unitLabel: "MB" },
   { id: "hour", label: "/ hora", quantity: 60, unitLabel: "hora" },
   { id: "minute", label: "/ minuto", quantity: 1, unitLabel: "minuto" },
   {
      id: "k_calls",
      label: "/ 1k chamadas",
      quantity: 1_000,
      unitLabel: "1k chamadas",
   },
];

const rateFormSchema = z.object({
   amount: z.number().min(0, "Valor obrigatório."),
   quantity: z.number().int().min(1, "Mínimo 1."),
   unitLabel: z.string().min(1, "Unidade obrigatória."),
});

function formatBigQty(n: number): string {
   return n.toLocaleString("pt-BR");
}

function formatPreview(
   unitCost: string,
   quantity: number,
   unitLabel: string,
): string {
   const cost = Number(unitCost) * quantity;
   const formatted = cost.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
   });
   return `R$ ${formatted} / ${unitLabel}`;
}

export function RateCell({ unitCost, onSave }: Props) {
   const [open, setOpen] = useState(false);
   const isZero = Number(unitCost) === 0;
   const initialAmount = Number(unitCost);

   const form = useForm({
      defaultValues: {
         amount: initialAmount > 0 ? initialAmount : 0,
         quantity: 1,
         unitLabel: "unidade",
      },
      validators: { onChange: rateFormSchema },
      onSubmit: async ({ value }) => {
         const computed = value.amount / value.quantity;
         const result = await fromPromise(
            onSave(computed.toFixed(8)),
            (e) => e,
         );
         if (result.isErr()) {
            toast.error("Falha ao salvar preço.");
            return;
         }
         setOpen(false);
      },
   });

   return (
      <Popover open={open} onOpenChange={setOpen}>
         <PopoverTrigger asChild>
            <button
               type="button"
               className="-mx-4 -my-2 flex w-[calc(100%+2rem)] cursor-pointer items-center px-4 py-2 text-left hover:bg-muted/40"
            >
               {isZero ? (
                  <span className="text-muted-foreground/40">—</span>
               ) : (
                  <span className="tabular-nums text-sm">
                     {formatPreview(unitCost, 1, "unidade")}
                  </span>
               )}
            </button>
         </PopoverTrigger>
         <PopoverContent
            align="start"
            className="w-[460px] p-4"
            onOpenAutoFocus={(e) => e.preventDefault()}
         >
            <form
               className="flex flex-col gap-4"
               onSubmit={(e) => {
                  e.preventDefault();
                  form.handleSubmit();
               }}
            >
               <div className="flex flex-col gap-1">
                  <span className="text-sm font-semibold">Quanto custa?</span>
                  <span className="text-xs text-muted-foreground">
                     Defina o preço por bloco — ex: "R$ 3,00 a cada 1M tokens".
                  </span>
               </div>

               <form.Subscribe
                  selector={(s) =>
                     [s.values.quantity, s.values.unitLabel] as const
                  }
               >
                  {([qty, unit]) => (
                     <div className="flex flex-wrap gap-1">
                        {PRESETS.map((p) => {
                           const active =
                              p.quantity === qty && p.unitLabel === unit;
                           return (
                              <Button
                                 key={p.id}
                                 onClick={() => {
                                    form.setFieldValue("quantity", p.quantity);
                                    form.setFieldValue(
                                       "unitLabel",
                                       p.unitLabel,
                                    );
                                 }}
                                 size="sm"
                                 type="button"
                                 variant={active ? "default" : "outline"}
                              >
                                 {p.label}
                              </Button>
                           );
                        })}
                     </div>
                  )}
               </form.Subscribe>

               <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
                  <form.Field name="amount">
                     {(field) => {
                        const isInvalid =
                           field.state.meta.isTouched &&
                           field.state.meta.errors.length > 0;
                        return (
                           <Field>
                              <FieldLabel htmlFor={field.name}>
                                 Cobro
                              </FieldLabel>
                              <MoneyInput
                                 aria-invalid={isInvalid}
                                 autoFocus
                                 id={field.name}
                                 name={field.name}
                                 onBlur={field.handleBlur}
                                 onChange={(v) => field.handleChange(v ?? 0)}
                                 value={field.state.value}
                                 valueInCents={false}
                              />
                              {isInvalid ? (
                                 <FieldError>
                                    {String(
                                       field.state.meta.errors[0]?.message,
                                    )}
                                 </FieldError>
                              ) : null}
                           </Field>
                        );
                     }}
                  </form.Field>
                  <span className="pb-2.5 text-xs text-muted-foreground">
                     a cada
                  </span>
                  <form.Field name="quantity">
                     {(field) => {
                        const isInvalid =
                           field.state.meta.isTouched &&
                           field.state.meta.errors.length > 0;
                        return (
                           <Field>
                              <FieldLabel htmlFor={field.name}>
                                 Quantidade
                              </FieldLabel>
                              <Input
                                 aria-invalid={isInvalid}
                                 className="h-9"
                                 id={field.name}
                                 inputMode="numeric"
                                 min={1}
                                 name={field.name}
                                 onBlur={field.handleBlur}
                                 onChange={(e) =>
                                    field.handleChange(
                                       Math.max(1, Number(e.target.value) || 1),
                                    )
                                 }
                                 type="number"
                                 value={field.state.value}
                              />
                              {isInvalid ? (
                                 <FieldError>
                                    {String(
                                       field.state.meta.errors[0]?.message,
                                    )}
                                 </FieldError>
                              ) : null}
                           </Field>
                        );
                     }}
                  </form.Field>
               </div>

               <form.Field name="unitLabel">
                  {(field) => {
                     const isInvalid =
                        field.state.meta.isTouched &&
                        field.state.meta.errors.length > 0;
                     return (
                        <Field>
                           <FieldLabel htmlFor={field.name}>Unidade</FieldLabel>
                           <Input
                              aria-invalid={isInvalid}
                              className="h-9"
                              id={field.name}
                              name={field.name}
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                 field.handleChange(e.target.value)
                              }
                              placeholder="ex: Mtoken, GB, hora"
                              value={field.state.value}
                           />
                           {isInvalid ? (
                              <FieldError>
                                 {String(field.state.meta.errors[0]?.message)}
                              </FieldError>
                           ) : null}
                        </Field>
                     );
                  }}
               </form.Field>

               <form.Subscribe
                  selector={(s) =>
                     [
                        s.values.amount,
                        s.values.quantity,
                        s.values.unitLabel,
                     ] as const
                  }
               >
                  {([amt, qty, unit]) => (
                     <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                        <span className="text-xs text-muted-foreground">
                           Cobra
                        </span>
                        <span className="text-sm font-medium tabular-nums">
                           R${" "}
                           {amt.toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                           })}{" "}
                           a cada {formatBigQty(qty)} {unit || "unidades"}
                        </span>
                     </div>
                  )}
               </form.Subscribe>

               <div className="flex items-center justify-end gap-2">
                  <Button
                     onClick={() => setOpen(false)}
                     size="sm"
                     type="button"
                     variant="outline"
                  >
                     Cancelar
                  </Button>
                  <form.Subscribe
                     selector={(s) => [s.canSubmit, s.isSubmitting] as const}
                  >
                     {([canSubmit, isSubmitting]) => (
                        <Button
                           disabled={!canSubmit || isSubmitting}
                           size="sm"
                           type="submit"
                        >
                           Salvar
                        </Button>
                     )}
                  </form.Subscribe>
               </div>
            </form>
         </PopoverContent>
      </Popover>
   );
}
