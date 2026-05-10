import { Button } from "@packages/ui/components/button";
import { Field, FieldError, FieldLabel } from "@packages/ui/components/field";
import { Input } from "@packages/ui/components/input";
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
import { toast } from "@packages/ui/components/sonner";
import {
   Tooltip,
   TooltipContent,
   TooltipTrigger,
} from "@packages/ui/components/tooltip";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { fromPromise } from "neverthrow";
import { z } from "zod";
import { useSheet } from "@/hooks/use-sheet";
import { orpc, type Outputs } from "@/integrations/orpc/client";
import { CATEGORY_ICON_OPTIONS } from "./category-icons";

const CATEGORY_TYPES = ["income", "expense", "transfer"] as const;
type CategoryType = (typeof CATEGORY_TYPES)[number];
type CategoryOption = Outputs["categories"]["getAll"][number];

const NO_PARENT_VALUE = "sem-categoria-pai";

function parseCategoryType(value: string): CategoryType | undefined {
   return CATEGORY_TYPES.find((t) => t === value);
}

const TYPE_OPTIONS: { value: CategoryType; label: string }[] = [
   { value: "expense", label: "Despesa" },
   { value: "income", label: "Receita" },
   { value: "transfer", label: "Transferência" },
];

const formSchema = z.object({
   type: z.enum(CATEGORY_TYPES),
   name: z
      .string()
      .trim()
      .min(2, "Nome deve ter no mínimo 2 caracteres.")
      .max(120, "Nome deve ter no máximo 120 caracteres."),
   parentId: z.string().min(1).optional().nullable(),
   icon: z.string().min(1),
});

type FormValues = z.input<typeof formSchema>;

const DEFAULT_VALUES: FormValues = {
   type: "expense",
   name: "",
   parentId: NO_PARENT_VALUE,
   icon: "briefcase",
};

function isFieldInvalid(field: {
   state: { meta: { isTouched: boolean; errors: unknown[] } };
}) {
   return field.state.meta.isTouched && field.state.meta.errors.length > 0;
}

export function CategoryFormSheet({
   categories,
}: {
   categories: CategoryOption[];
}) {
   const { closeTopSheet } = useSheet();

   const createMutation = useMutation(
      orpc.categories.create.mutationOptions({
         onSuccess: () => {
            toast.success("Categoria criada com sucesso.");
            closeTopSheet();
         },
         onError: (e) => toast.error(e.message),
      }),
   );

   const form = useForm({
      defaultValues: DEFAULT_VALUES,
      validators: { onMount: formSchema, onChange: formSchema },
      onSubmit: async ({ value }) => {
         const selectedParent = categories.find(
            (category) =>
               category.id === value.parentId &&
               category.type === value.type &&
               category.level < 3 &&
               !category.isArchived,
         );
         const result = await fromPromise(
            createMutation.mutateAsync({
               name: value.name.trim(),
               type: value.type,
               parentId: selectedParent?.id ?? null,
               icon: selectedParent ? null : value.icon,
               participatesDre: false,
            }),
            (e) => e,
         );
         if (result.isErr()) return;
      },
   });

   return (
      <>
         <SheetHeader>
            <SheetTitle>Nova categoria</SheetTitle>
            <SheetDescription>
               Cadastre uma categoria de receita, despesa ou transferência.
            </SheetDescription>
         </SheetHeader>

         <form
            className="flex flex-1 min-h-0 flex-col gap-4 overflow-y-auto px-4"
            onSubmit={(e) => {
               e.preventDefault();
               form.handleSubmit();
            }}
         >
            <form.Field name="type">
               {(field) => (
                  <Field>
                     <FieldLabel htmlFor={field.name}>Tipo</FieldLabel>
                     <Select
                        value={field.state.value}
                        onValueChange={(v) => {
                           const parsed = parseCategoryType(v);
                           if (!parsed) return;
                           field.handleChange(parsed);
                           form.setFieldValue("parentId", NO_PARENT_VALUE);
                        }}
                     >
                        <SelectTrigger id={field.name} name={field.name}>
                           <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                           {TYPE_OPTIONS.map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                 {o.label}
                              </SelectItem>
                           ))}
                        </SelectContent>
                     </Select>
                  </Field>
               )}
            </form.Field>

            <form.Subscribe selector={(s) => s.values.type}>
               {(selectedType) => {
                  const parentOptions = categories.filter(
                     (c) =>
                        c.type === selectedType && c.level < 3 && !c.isArchived,
                  );

                  return (
                     <form.Field
                        name="parentId"
                        children={(field) => (
                           <Field>
                              <FieldLabel htmlFor={field.name}>
                                 Categoria pai
                              </FieldLabel>
                              <Select
                                 value={field.state.value ?? NO_PARENT_VALUE}
                                 onValueChange={field.handleChange}
                              >
                                 <SelectTrigger
                                    aria-invalid={isFieldInvalid(field)}
                                    id={field.name}
                                    name={field.name}
                                 >
                                    <SelectValue />
                                 </SelectTrigger>
                                 <SelectContent>
                                    <SelectItem value={NO_PARENT_VALUE}>
                                       Sem categoria pai
                                    </SelectItem>
                                    {parentOptions.map((c) => (
                                       <SelectItem key={c.id} value={c.id}>
                                          {c.level > 1 ? "Sub: " : ""}
                                          {c.name}
                                       </SelectItem>
                                    ))}
                                 </SelectContent>
                              </Select>
                           </Field>
                        )}
                     />
                  );
               }}
            </form.Subscribe>

            <form.Subscribe selector={(s) => s.values.parentId}>
               {(parentId) => {
                  if (parentId && parentId !== NO_PARENT_VALUE) return null;

                  return (
                     <form.Field
                        name="icon"
                        children={(field) => (
                           <Field>
                              <FieldLabel htmlFor={field.name}>
                                 Ícone
                              </FieldLabel>
                              <div
                                 aria-label="Ícone"
                                 className="grid grid-cols-5 gap-2"
                                 role="radiogroup"
                              >
                                 {CATEGORY_ICON_OPTIONS.map((option) => {
                                    const Icon = option.icon;
                                    const checked =
                                       field.state.value === option.value;
                                    return (
                                       <Tooltip key={option.value}>
                                          <TooltipTrigger asChild>
                                             <Button
                                                aria-checked={checked}
                                                aria-label={`Ícone ${option.label}`}
                                                id={
                                                   checked
                                                      ? field.name
                                                      : undefined
                                                }
                                                role="radio"
                                                size="icon-sm"
                                                type="button"
                                                variant={
                                                   checked
                                                      ? "default"
                                                      : "outline"
                                                }
                                                onBlur={field.handleBlur}
                                                onClick={() =>
                                                   field.handleChange(
                                                      option.value,
                                                   )
                                                }
                                             >
                                                <Icon className="size-4" />
                                             </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                             {option.label}
                                          </TooltipContent>
                                       </Tooltip>
                                    );
                                 })}
                              </div>
                           </Field>
                        )}
                     />
                  );
               }}
            </form.Subscribe>

            <form.Field name="name">
               {(field) => (
                  <Field data-invalid={isFieldInvalid(field) || undefined}>
                     <FieldLabel htmlFor={field.name}>Nome</FieldLabel>
                     <Input
                        aria-invalid={isFieldInvalid(field)}
                        id={field.name}
                        name={field.name}
                        placeholder="Ex.: Aluguel"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                     />
                     {isFieldInvalid(field) ? (
                        <FieldError>
                           {field.state.meta.errors[0]?.message}
                        </FieldError>
                     ) : null}
                  </Field>
               )}
            </form.Field>
         </form>

         <SheetFooter>
            <SheetClose asChild>
               <Button variant="outline">Cancelar</Button>
            </SheetClose>
            <form.Subscribe
               selector={(s) => ({
                  canSubmit: s.canSubmit,
                  isSubmitting: s.isSubmitting,
               })}
            >
               {({ canSubmit, isSubmitting }) => (
                  <Button
                     disabled={!canSubmit || isSubmitting}
                     onClick={() => form.handleSubmit()}
                  >
                     Criar categoria
                  </Button>
               )}
            </form.Subscribe>
         </SheetFooter>
      </>
   );
}
