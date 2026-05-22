import { Button } from "@packages/ui/components/button";
import { Combobox } from "@packages/ui/components/combobox";
import { Field, FieldError, FieldLabel } from "@packages/ui/components/field";
import { Input } from "@packages/ui/components/input";
import { MoneyInput } from "@packages/ui/components/money-input";
import { NumberInput } from "@packages/ui/components/number-input";
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
import { z } from "zod";
import { QueryBoundary } from "@/components/query-boundary";
import { useSheet } from "@/hooks/use-sheet";
import { orpc } from "@/integrations/orpc/client";
import type { ProdutoRow } from "./produtos-columns";

const formSchema = z.object({
   sku: z.string().trim().min(2, "Informe o SKU."),
   nome: z.string().trim().min(2, "Informe o produto."),
   categoryId: z.string(),
   tagId: z.string(),
   saldo: z.number().int().min(0, "Saldo não pode ser negativo."),
   minimo: z.number().int().min(0, "Mínimo não pode ser negativo."),
   custoUnitario: z.number().min(0, "Custo não pode ser negativo."),
   precoVenda: z.number().min(0, "Preço não pode ser negativo."),
});

type FormValues = z.input<typeof formSchema>;

const defaultValues: FormValues = {
   sku: "",
   nome: "",
   categoryId: "",
   tagId: "",
   saldo: 0,
   minimo: 0,
   custoUnitario: 0,
   precoVenda: 0,
};

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

export function ProdutoFormSheet({
   onCreate,
}: {
   onCreate: (row: ProdutoRow) => void;
}) {
   return (
      <QueryBoundary
         fallback={
            <div className="flex flex-col gap-4 p-4">
               <SheetHeader>
                  <SheetTitle>Novo produto</SheetTitle>
                  <SheetDescription>
                     Carregando classificações...
                  </SheetDescription>
               </SheetHeader>
            </div>
         }
         errorTitle="Erro ao carregar classificações"
      >
         <ProdutoFormSheetContent onCreate={onCreate} />
      </QueryBoundary>
   );
}

function ProdutoFormSheetContent({
   onCreate,
}: {
   onCreate: (row: ProdutoRow) => void;
}) {
   const { closeTopSheet } = useSheet();
   const { data: categories } = useSuspenseQuery(
      orpc.categories.getAll.queryOptions({ input: { type: "expense" } }),
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
      defaultValues,
      validators: { onMount: formSchema, onChange: formSchema },
      onSubmit: ({ value }) => {
         onCreate({
            id: crypto.randomUUID(),
            sku: value.sku.trim(),
            nome: value.nome.trim(),
            categoryId: value.categoryId,
            categoryName: resolveOptionLabel(categoryOptions, value.categoryId),
            tagId: value.tagId,
            tagName: resolveOptionLabel(tagOptions, value.tagId),
            saldo: value.saldo,
            minimo: value.minimo,
            custoUnitario: value.custoUnitario,
            precoVenda: value.precoVenda,
            movements: [],
         });
         toast.success("Produto criado no estoque da demo.");
         closeTopSheet();
      },
   });

   return (
      <>
         <SheetHeader>
            <SheetTitle>Novo produto</SheetTitle>
            <SheetDescription>
               Cadastre um produto físico simples com classificação financeira
               padrão.
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
               name="sku"
               children={(field) => (
                  <TextField field={field} label="SKU" placeholder="SKU-5050" />
               )}
            />
            <form.Field
               name="nome"
               children={(field) => (
                  <TextField
                     field={field}
                     label="Produto"
                     placeholder="Cápsula de café"
                  />
               )}
            />
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
            <div className="grid gap-4 md:grid-cols-2">
               <form.Field
                  name="saldo"
                  children={(field) => (
                     <NumberField field={field} label="Saldo" step={1} />
                  )}
               />
               <form.Field
                  name="minimo"
                  children={(field) => (
                     <NumberField
                        field={field}
                        label="Estoque mínimo"
                        step={1}
                     />
                  )}
               />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
               <form.Field
                  name="custoUnitario"
                  children={(field) => (
                     <MoneyField field={field} label="Custo unitário" />
                  )}
               />
               <form.Field
                  name="precoVenda"
                  children={(field) => (
                     <MoneyField field={field} label="Preço de venda" />
                  )}
               />
            </div>
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
                     Criar produto
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
}: {
   field: {
      name: string;
      state: { value: string; meta: { isTouched: boolean; errors: unknown[] } };
      handleBlur: () => void;
      handleChange: (value: string) => void;
   };
   label: string;
   placeholder: string;
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
   step,
}: {
   field: {
      name: string;
      state: { value: number; meta: { isTouched: boolean; errors: unknown[] } };
      handleBlur: () => void;
      handleChange: (value: number) => void;
   };
   label: string;
   step: number;
}) {
   return (
      <Field data-invalid={isFieldInvalid(field) || undefined}>
         <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
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
         {isFieldInvalid(field) ? (
            <FieldError>
               {getFieldErrorMessage(field.state.meta.errors[0])}
            </FieldError>
         ) : null}
      </Field>
   );
}

function MoneyField({
   field,
   label,
}: {
   field: {
      name: string;
      state: { value: number; meta: { isTouched: boolean; errors: unknown[] } };
      handleBlur: () => void;
      handleChange: (value: number) => void;
   };
   label: string;
}) {
   return (
      <Field data-invalid={isFieldInvalid(field) || undefined}>
         <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
         <MoneyInput
            aria-invalid={isFieldInvalid(field)}
            id={field.name}
            name={field.name}
            onBlur={field.handleBlur}
            onChange={(value) => field.handleChange(value ?? 0)}
            value={field.state.value}
            valueInCents={false}
         />
         {isFieldInvalid(field) ? (
            <FieldError>
               {getFieldErrorMessage(field.state.meta.errors[0])}
            </FieldError>
         ) : null}
      </Field>
   );
}
