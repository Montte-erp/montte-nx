import { Button } from "@packages/ui/components/button";
import {
   Collapsible,
   CollapsibleContent,
   CollapsibleTrigger,
} from "@packages/ui/components/collapsible";
import {
   ColorPicker,
   ColorPickerEyeDropper,
   ColorPickerFormat,
   ColorPickerHue,
   ColorPickerOutput,
   ColorPickerSelection,
} from "@packages/ui/components/color-picker";
import { Field, FieldError, FieldLabel } from "@packages/ui/components/field";
import { Input } from "@packages/ui/components/input";
import {
   Popover,
   PopoverContent,
   PopoverTrigger,
} from "@packages/ui/components/popover";
import { Textarea } from "@packages/ui/components/textarea";
import {
   SheetClose,
   SheetDescription,
   SheetFooter,
   SheetHeader,
   SheetTitle,
} from "@packages/ui/components/sheet";
import { toast } from "@packages/ui/hooks/use-toast";
import type { Collection } from "@tanstack/react-db";
import { useForm } from "@tanstack/react-form";
import dayjs from "dayjs";
import { ChevronDown, ChevronsUpDown } from "lucide-react";
import { fromPromise } from "neverthrow";
import { useState } from "react";
import { z } from "zod";
import { cn } from "@packages/ui/lib/utils";
import { useSheet } from "@/hooks/use-sheet";
import { createTagAction } from "@/integrations/tanstack-db/tags";
import type { TagRow } from "./tags-columns";

const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{6})$/;

const formSchema = z.object({
   name: z
      .string()
      .trim()
      .min(2, "Nome deve ter no mínimo 2 caracteres.")
      .max(120, "Nome deve ter no máximo 120 caracteres."),
   description: z.string().trim().max(255, "Máximo 255 caracteres."),
   color: z.string().regex(HEX_COLOR_REGEX, "Cor inválida."),
});

type FormValues = z.input<typeof formSchema>;

const DEFAULT_VALUES: FormValues = {
   name: "",
   description: "",
   color: "#6366f1",
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
   ) {
      return error.message;
   }
   return undefined;
}

function getErrorMessage(error: unknown) {
   if (
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof error.message === "string" &&
      error.message.length > 0
   ) {
      return error.message;
   }
   return "Erro ao criar centro de custo.";
}

function isConflictError(error: unknown) {
   return (
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      error.status === 409
   );
}

type TagsFormSheetProps = {
   collection: Collection<TagRow, string>;
   teamId: string | null;
};

export function TagsFormSheet({ collection, teamId }: TagsFormSheetProps) {
   const { closeTopSheet } = useSheet();
   const [moreOpen, setMoreOpen] = useState(false);

   const form = useForm({
      defaultValues: DEFAULT_VALUES,
      validators: { onMount: formSchema, onChange: formSchema },
      onSubmit: async ({ value, formApi }) => {
         if (!teamId) {
            toast.error("Time ativo não encontrado.");
            return;
         }
         const now = dayjs().toDate();
         const id = crypto.randomUUID();
         const createTag = createTagAction(collection);
         const transaction = createTag({
            row: {
               id,
               teamId,
               name: value.name.trim(),
               color: value.color,
               description: value.description.trim() || null,
               isDefault: false,
               isArchived: false,
               dreType: null,
               dreOrder: null,
               createdAt: now,
               updatedAt: now,
            },
         });
         const result = await fromPromise(
            transaction.isPersisted.promise,
            (e) => e,
         );
         if (result.isErr()) {
            const message = getErrorMessage(result.error);
            if (!isConflictError(result.error)) {
               toast.error(message);
               return;
            }

            formApi.setFieldMeta("name", (prev) => ({
               ...prev,
               isTouched: true,
               errorMap: {
                  ...prev.errorMap,
                  onServer: message,
               },
               errorSourceMap: {
                  ...prev.errorSourceMap,
                  onServer: "form",
               },
            }));
            return;
         }
         toast.success("Centro de custo criado com sucesso.");
         closeTopSheet();
      },
   });

   return (
      <>
         <SheetHeader>
            <SheetTitle>Novo centro de custo</SheetTitle>
            <SheetDescription>
               Cadastre um centro de custo para categorizar suas transações por
               setor, projeto ou responsabilidade.
            </SheetDescription>
         </SheetHeader>

         <form
            className="flex flex-1 min-h-0 flex-col gap-4 overflow-y-auto px-4"
            onSubmit={(e) => {
               e.preventDefault();
               form.handleSubmit();
            }}
         >
            <form.Field name="name">
               {(field) => (
                  <Field data-invalid={isFieldInvalid(field) || undefined}>
                     <FieldLabel htmlFor={field.name}>Nome</FieldLabel>
                     <Input
                        aria-invalid={isFieldInvalid(field)}
                        id={field.name}
                        name={field.name}
                        placeholder="Ex.: Marketing"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                     />
                     {isFieldInvalid(field) ? (
                        <FieldError>
                           {getFieldErrorMessage(field.state.meta.errors[0])}
                        </FieldError>
                     ) : null}
                  </Field>
               )}
            </form.Field>

            <form.Field name="description">
               {(field) => (
                  <Field data-invalid={isFieldInvalid(field) || undefined}>
                     <FieldLabel htmlFor={field.name}>Descrição</FieldLabel>
                     <Textarea
                        aria-invalid={isFieldInvalid(field)}
                        id={field.name}
                        name={field.name}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="Ex.: Campanhas e aquisição de clientes"
                        value={field.state.value}
                     />
                     {isFieldInvalid(field) ? (
                        <FieldError>
                           {getFieldErrorMessage(field.state.meta.errors[0])}
                        </FieldError>
                     ) : null}
                  </Field>
               )}
            </form.Field>

            <Collapsible open={moreOpen} onOpenChange={setMoreOpen}>
               <CollapsibleTrigger asChild>
                  <Button
                     className="w-full justify-between"
                     type="button"
                     variant="ghost"
                  >
                     Mais opções
                     <ChevronDown
                        className={cn(
                           "size-4 transition-transform",
                           moreOpen && "rotate-180",
                        )}
                     />
                  </Button>
               </CollapsibleTrigger>
               <CollapsibleContent className="flex flex-col gap-4 pt-4">
                  <form.Field name="color">
                     {(field) => (
                        <Field
                           data-invalid={isFieldInvalid(field) || undefined}
                        >
                           <FieldLabel htmlFor={field.name}>Cor</FieldLabel>
                           <ColorField
                              id={field.name}
                              value={field.state.value}
                              onChange={field.handleChange}
                           />
                           {isFieldInvalid(field) ? (
                              <FieldError>
                                 {getFieldErrorMessage(
                                    field.state.meta.errors[0],
                                 )}
                              </FieldError>
                           ) : null}
                        </Field>
                     )}
                  </form.Field>
               </CollapsibleContent>
            </Collapsible>
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
                     Criar centro de custo
                  </Button>
               )}
            </form.Subscribe>
         </SheetFooter>
      </>
   );
}

function rgbaToHex(rgba: [number, number, number, number]) {
   const toHex = (n: number) => Math.round(n).toString(16).padStart(2, "0");
   return `#${toHex(rgba[0])}${toHex(rgba[1])}${toHex(rgba[2])}`;
}

function ColorField({
   id,
   value,
   onChange,
}: {
   id: string;
   value: string;
   onChange: (value: string) => void;
}) {
   const [open, setOpen] = useState(false);
   const display = value || "#6366f1";

   return (
      <Popover open={open} onOpenChange={setOpen}>
         <PopoverTrigger asChild>
            <Button
               className="w-full justify-between"
               id={id}
               type="button"
               variant="outline"
            >
               <span className="flex items-center gap-2">
                  <span
                     className="size-4 rounded-full border"
                     style={{ background: display }}
                  />
                  {display.toUpperCase()}
               </span>
               <ChevronsUpDown className="size-4 opacity-50" />
            </Button>
         </PopoverTrigger>
         <PopoverContent align="start" className="w-72 p-4">
            <ColorPicker
               value={display}
               onChange={(rgba) => onChange(rgbaToHex(rgba))}
            >
               <ColorPickerSelection className="h-40" />
               <div className="flex items-center gap-4">
                  <ColorPickerEyeDropper />
                  <div className="flex w-full flex-col gap-4">
                     <ColorPickerHue />
                  </div>
               </div>
               <div className="flex items-center gap-2">
                  <ColorPickerOutput />
                  <ColorPickerFormat />
               </div>
            </ColorPicker>
         </PopoverContent>
      </Popover>
   );
}
