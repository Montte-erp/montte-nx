import { Button } from "@packages/ui/components/button";
import { Checkbox } from "@packages/ui/components/checkbox";
import { Combobox } from "@packages/ui/components/combobox";
import { Field, FieldError, FieldLabel } from "@packages/ui/components/field";
import { Input } from "@packages/ui/components/input";
import { MoneyInput } from "@packages/ui/components/money-input";
import { NumberInput } from "@packages/ui/components/number-input";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
import {
   SheetClose,
   SheetDescription,
   SheetFooter,
   SheetHeader,
   SheetTitle,
} from "@packages/ui/components/sheet";
import { toast } from "@packages/ui/hooks/use-toast";
import { useForm } from "@tanstack/react-form";
import { useSuspenseQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { z } from "zod";
import { QueryBoundary } from "@/components/query-boundary";
import { useSheet } from "@/hooks/use-sheet";
import { orpc } from "@/integrations/orpc/client";
import type { ProdutoMovementType, ProdutoRow } from "./produtos-columns";
import { formatBRL } from "./produtos-columns";

const formSchema = z.object({
   type: z.enum(["entrada", "saida", "ajuste"]),
   quantityUnits: z.number().int().min(0, "Informe a quantidade."),
   unitCost: z.number().min(0, "Valor não pode ser negativo."),
   totalAmount: z.number().min(0, "Valor não pode ser negativo."),
   reason: z.string().trim().min(2, "Informe a descrição."),
   categoryId: z.string(),
   tagId: z.string(),
   occurredAt: z.string().trim().min(10, "Informe a data."),
   note: z.string().trim(),
   createsFinancialEntry: z.boolean(),
});

type MovementFormFields = z.input<typeof formSchema>;

export type ProdutoMovementFormValues = MovementFormFields & {
   categoryName: string;
   tagName: string;
};

const MOVEMENT_LABELS: Record<ProdutoMovementType, string> = {
   ajuste: "Ajuste",
   entrada: "Entrada",
   saida: "Saída",
};

function defaultValues(product: ProdutoRow): MovementFormFields {
   return {
      type: "entrada",
      quantityUnits: 1,
      unitCost: product.custoUnitario,
      totalAmount: product.custoUnitario,
      reason: "Compra de estoque",
      categoryId: product.categoryId,
      tagId: product.tagId,
      occurredAt: dayjs().format("YYYY-MM-DD"),
      note: "",
      createsFinancialEntry: true,
   };
}

function isFieldInvalid(field: {
   state: { meta: { isTouched: boolean; errors: unknown[] } };
}) {
   return field.state.meta.isTouched && field.state.meta.errors.length > 0;
}

function getFieldErrorMessage(error: unknown) {
   if (typeof error === "string") return error;
   if (
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof error.message === "string"
   )
      return error.message;
   return undefined;
}

function parseMovementType(value: string): ProdutoMovementType {
   if (value === "saida") return "saida";
   if (value === "ajuste") return "ajuste";
   return "entrada";
}

export function ProdutoMovementSheet({
   product,
   onCreate,
}: {
   product: ProdutoRow;
   onCreate: (value: ProdutoMovementFormValues) => boolean;
}) {
   return (
      <QueryBoundary
         fallback={
            <div className="flex flex-col gap-4 p-4">
               <SheetHeader>
                  <SheetTitle>Registrar movimentação</SheetTitle>
                  <SheetDescription>
                     Carregando classificações...
                  </SheetDescription>
               </SheetHeader>
            </div>
         }
         errorTitle="Erro ao carregar classificações"
      >
         <ProdutoMovementSheetContent onCreate={onCreate} product={product} />
      </QueryBoundary>
   );
}

function ProdutoMovementSheetContent({
   product,
   onCreate,
}: {
   product: ProdutoRow;
   onCreate: (value: ProdutoMovementFormValues) => boolean;
}) {
   const { closeTopSheet } = useSheet();
   const { data: categories } = useSuspenseQuery(
      orpc.categories.getAll.queryOptions({ input: {} }),
   );
   const { data: tagsResult } = useSuspenseQuery(
      orpc.tags.getAll.queryOptions({ input: { pageSize: 100 } }),
   );
   const categoryOptions = categories.map((category) => ({
      value: category.id,
      label: category.parentId
         ? `${categories.find((item) => item.id === category.parentId)?.name ?? "Categoria"} / ${category.name}`
         : category.name,
   }));
   const tagOptions = tagsResult.data.map((tag) => ({
      value: tag.id,
      label: tag.name,
   }));
   const form = useForm({
      defaultValues: defaultValues(product),
      validators: { onMount: formSchema, onChange: formSchema },
      onSubmit: ({ value }) => {
         const created = onCreate({
            ...value,
            categoryName: resolveOptionLabel(categoryOptions, value.categoryId),
            tagName: resolveOptionLabel(tagOptions, value.tagId),
         });
         if (!created) return;

         toast.success("Movimentação registrada.");
         closeTopSheet();
      },
   });

   return (
      <>
         <SheetHeader>
            <SheetTitle>Registrar movimentação</SheetTitle>
            <SheetDescription>
               {product.nome} tem saldo atual de {product.saldo} unidades.
            </SheetDescription>
         </SheetHeader>
         <form
            className="flex flex-1 min-h-0 flex-col gap-4 overflow-y-auto px-4"
            onSubmit={(event) => {
               event.preventDefault();
               form.handleSubmit();
            }}
         >
            <form.Field
               name="type"
               children={(field) => (
                  <Field data-invalid={isFieldInvalid(field) || undefined}>
                     <FieldLabel>Tipo</FieldLabel>
                     <Select
                        onValueChange={(value) =>
                           field.handleChange(parseMovementType(value))
                        }
                        value={field.state.value}
                     >
                        <SelectTrigger
                           aria-invalid={isFieldInvalid(field)}
                           className="w-full"
                        >
                           <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                           <SelectItem value="entrada">
                              Entrada de estoque
                           </SelectItem>
                           <SelectItem value="saida">
                              Saída de estoque
                           </SelectItem>
                           <SelectItem value="ajuste">Ajuste</SelectItem>
                        </SelectContent>
                     </Select>
                     {isFieldInvalid(field) ? (
                        <FieldError>
                           {getFieldErrorMessage(field.state.meta.errors[0])}
                        </FieldError>
                     ) : null}
                  </Field>
               )}
            />
            <form.Subscribe
               selector={(state) => ({
                  type: state.values.type,
                  quantityUnits: state.values.quantityUnits,
                  unitCost: state.values.unitCost,
                  totalAmount: state.values.totalAmount,
               })}
            >
               {({ type, quantityUnits, unitCost, totalAmount }) => (
                  <>
                     <div className="grid gap-4 md:grid-cols-2">
                        <form.Field
                           name="quantityUnits"
                           children={(field) => (
                              <NumberField
                                 field={field}
                                 label={
                                    type === "ajuste"
                                       ? "Saldo correto"
                                       : "Quantidade"
                                 }
                                 step={1}
                              />
                           )}
                        />
                        <form.Field
                           name="occurredAt"
                           children={(field) => (
                              <TextField
                                 field={field}
                                 label="Data"
                                 placeholder="2026-05-21"
                                 type="date"
                              />
                           )}
                        />
                     </div>
                     {type !== "ajuste" ? (
                        <div className="grid gap-4 md:grid-cols-2">
                           <form.Field
                              name="unitCost"
                              children={(field) => (
                                 <NumberField
                                    field={field}
                                    label={
                                       type === "entrada"
                                          ? "Custo unitário"
                                          : "Valor unitário"
                                    }
                                    type="money"
                                 />
                              )}
                           />
                           <form.Field
                              name="totalAmount"
                              children={(field) => (
                                 <NumberField
                                    field={field}
                                    label="Valor total"
                                    type="money"
                                 />
                              )}
                           />
                        </div>
                     ) : null}
                     <div className="rounded-md border bg-muted/40 p-4 text-sm">
                        {type === "ajuste" ? (
                           <span>
                              O saldo será ajustado de {product.saldo} para{" "}
                              {quantityUnits} unidades.
                           </span>
                        ) : (
                           <span>
                              {MOVEMENT_LABELS[type]} de {quantityUnits}{" "}
                              unidades, valor total de {formatBRL(totalAmount)}{" "}
                              e referência unitária de {formatBRL(unitCost)}.
                           </span>
                        )}
                     </div>
                  </>
               )}
            </form.Subscribe>
            <form.Field
               name="reason"
               children={(field) => (
                  <TextField
                     field={field}
                     label="Descrição"
                     placeholder="Compra de estoque, venda, uso interno"
                  />
               )}
            />
            <div className="grid gap-4 md:grid-cols-2">
               <form.Field
                  name="categoryId"
                  children={(field) => (
                     <ComboboxField
                        field={field}
                        emptyMessage="Nenhuma categoria encontrada."
                        label="Categoria financeira"
                        options={categoryOptions}
                        placeholder="Selecionar categoria..."
                        searchPlaceholder="Buscar categoria..."
                     />
                  )}
               />
               <form.Field
                  name="tagId"
                  children={(field) => (
                     <ComboboxField
                        field={field}
                        emptyMessage="Nenhum Centro de Custo encontrado."
                        label="Centro de Custo"
                        options={tagOptions}
                        placeholder="Selecionar Centro de Custo..."
                        searchPlaceholder="Buscar Centro de Custo..."
                     />
                  )}
               />
            </div>
            <form.Field
               name="note"
               children={(field) => (
                  <TextField
                     field={field}
                     label="Observação"
                     placeholder="Opcional"
                  />
               )}
            />
            <form.Field
               name="createsFinancialEntry"
               children={(field) => (
                  <Field>
                     <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                           checked={field.state.value}
                           onCheckedChange={(value) =>
                              field.handleChange(value === true)
                           }
                        />
                        Criar lançamento no financeiro
                     </label>
                  </Field>
               )}
            />
         </form>
         <SheetFooter>
            <SheetClose asChild>
               <Button variant="outline">Cancelar</Button>
            </SheetClose>
            <form.Subscribe
               selector={(state) => ({
                  canSubmit: state.canSubmit,
                  isSubmitting: state.isSubmitting,
               })}
            >
               {({ canSubmit, isSubmitting }) => (
                  <Button
                     disabled={!canSubmit || isSubmitting}
                     onClick={() => form.handleSubmit()}
                  >
                     Registrar
                  </Button>
               )}
            </form.Subscribe>
         </SheetFooter>
      </>
   );
}

function resolveOptionLabel(
   options: Array<{ value: string; label: string }>,
   value: string,
) {
   return options.find((option) => option.value === value)?.label ?? "";
}

function TextField({
   field,
   label,
   placeholder,
   type = "text",
}: {
   field: {
      name: string;
      state: { value: string; meta: { isTouched: boolean; errors: unknown[] } };
      handleBlur: () => void;
      handleChange: (value: string) => void;
   };
   label: string;
   placeholder: string;
   type?: "date" | "text";
}) {
   return (
      <Field data-invalid={isFieldInvalid(field) || undefined}>
         <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
         <Input
            aria-invalid={isFieldInvalid(field)}
            id={field.name}
            name={field.name}
            onBlur={field.handleBlur}
            onChange={(event) => field.handleChange(event.target.value)}
            placeholder={placeholder}
            type={type}
            value={field.state.value}
         />
         {isFieldInvalid(field) ? (
            <FieldError>
               {getFieldErrorMessage(field.state.meta.errors[0])}
            </FieldError>
         ) : null}
      </Field>
   );
}

function ComboboxField({
   field,
   label,
   options,
   placeholder,
   searchPlaceholder,
   emptyMessage,
}: {
   field: {
      name: string;
      state: { value: string; meta: { isTouched: boolean; errors: unknown[] } };
      handleBlur: () => void;
      handleChange: (value: string) => void;
   };
   label: string;
   options: Array<{ value: string; label: string }>;
   placeholder: string;
   searchPlaceholder: string;
   emptyMessage: string;
}) {
   return (
      <Field data-invalid={isFieldInvalid(field) || undefined}>
         <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
         <Combobox
            className="w-full"
            emptyMessage={emptyMessage}
            id={field.name}
            onBlur={field.handleBlur}
            onValueChange={(value) => field.handleChange(value)}
            options={options}
            placeholder={placeholder}
            searchPlaceholder={searchPlaceholder}
            value={field.state.value}
         />
         {isFieldInvalid(field) ? (
            <FieldError>
               {getFieldErrorMessage(field.state.meta.errors[0])}
            </FieldError>
         ) : null}
      </Field>
   );
}

function NumberField({
   field,
   label,
   step = 1,
   type = "number",
}: {
   field: {
      name: string;
      state: { value: number; meta: { isTouched: boolean; errors: unknown[] } };
      handleBlur: () => void;
      handleChange: (value: number) => void;
   };
   label: string;
   step?: number;
   type?: "money" | "number";
}) {
   return (
      <Field data-invalid={isFieldInvalid(field) || undefined}>
         <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
         {type === "money" ? (
            <MoneyInput
               aria-invalid={isFieldInvalid(field)}
               id={field.name}
               name={field.name}
               onBlur={field.handleBlur}
               onChange={(value) => field.handleChange(value ?? 0)}
               value={field.state.value}
               valueInCents={false}
            />
         ) : (
            <NumberInput
               aria-invalid={isFieldInvalid(field)}
               id={field.name}
               min={0}
               name={field.name}
               onBlur={field.handleBlur}
               onChange={(value) => field.handleChange(value)}
               step={step}
               value={field.state.value}
            />
         )}
         {isFieldInvalid(field) ? (
            <FieldError>
               {getFieldErrorMessage(field.state.meta.errors[0])}
            </FieldError>
         ) : null}
      </Field>
   );
}
