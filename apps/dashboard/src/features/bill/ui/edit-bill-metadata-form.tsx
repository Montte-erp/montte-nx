import type { BillWithRelations } from "@packages/database/repositories/bill-repository";
import { Button } from "@packages/ui/components/button";
import { Combobox } from "@packages/ui/components/combobox";
import {
   Field,
   FieldError,
   FieldGroup,
   FieldLabel,
} from "@packages/ui/components/field";
import {
   SheetDescription,
   SheetFooter,
   SheetHeader,
   SheetTitle,
} from "@packages/ui/components/sheet";
import { Textarea } from "@packages/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FormEvent } from "react";
import { useCallback } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { useSheet } from "@/hooks/use-sheet";
import { useTRPC } from "@/integrations/clients";

type Bill = BillWithRelations;

type EditBillMetadataFormProps = {
   bill: Bill;
   onSuccess?: () => void;
};

export function EditBillMetadataForm({
   bill,
   onSuccess,
}: EditBillMetadataFormProps) {
   const trpc = useTRPC();
   const queryClient = useQueryClient();
   const { closeSheet } = useSheet();

   const existingCounterpartyId = bill.counterpartyId || "";
   const existingNotes = bill.notes || "";

   const metadataSchema = z.object({
      counterpartyId: z.string(),
      notes: z.string(),
   });

   const { data: counterparties = [] } = useQuery(
      trpc.counterparties.getAll.queryOptions({ isActive: true }),
   );

   const updateBillMutation = useMutation(
      trpc.bills.update.mutationOptions({
         onError: (error) => {
            toast.error(
               error.message || "Erro ao atualizar conta",
            );
         },
         onSuccess: () => {
            queryClient.invalidateQueries({
               queryKey: trpc.bills.getById.queryKey({ id: bill.id }),
            });
            queryClient.invalidateQueries({
               queryKey: trpc.bills.getAllPaginated.queryKey(),
            });
            toast.success("Conta atualizada com sucesso");
            onSuccess?.();
            closeSheet();
         },
      }),
   );

   const form = useForm({
      defaultValues: {
         counterpartyId: existingCounterpartyId,
         notes: existingNotes,
      },
      onSubmit: async ({ value }) => {
         const updateData: Record<string, unknown> = {};

         if (value.counterpartyId !== existingCounterpartyId) {
            updateData.counterpartyId = value.counterpartyId || undefined;
         }

         if (value.notes !== existingNotes) {
            updateData.notes = value.notes || undefined;
         }

         if (Object.keys(updateData).length === 0) {
            toast.info("Nenhuma alteração detectada");
            closeSheet();
            return;
         }

         await updateBillMutation.mutateAsync({
            data: updateData,
            id: bill.id,
         });
      },
      validators: {
         onBlur: metadataSchema,
      },
   });

   const isLoading = updateBillMutation.isPending;

   const counterpartyOptions = [
      { label: "Nenhum", value: "" },
      ...counterparties.map((cp) => ({
         label: cp.name,
         value: cp.id,
      })),
   ];

   const handleSubmit = useCallback(
      (e: FormEvent) => {
         e.preventDefault();
         e.stopPropagation();
         form.handleSubmit();
      },
      [form],
   );

   return (
      <form className="h-full flex flex-col" onSubmit={handleSubmit}>
         <SheetHeader>
            <SheetTitle>
               Editar Conta
            </SheetTitle>
            <SheetDescription>
               Atualize o fornecedor/cliente e observações desta conta.
            </SheetDescription>
         </SheetHeader>

         <div className="px-4 flex-1 overflow-y-auto">
            <div className="space-y-4 py-4">
               <FieldGroup>
                  <form.Field name="counterpartyId">
                     {(field) => {
                        const isInvalid =
                           field.state.meta.isTouched &&
                           !field.state.meta.isValid;
                        return (
                           <Field data-invalid={isInvalid}>
                              <FieldLabel htmlFor={field.name}>
                                 Fornecedor/Cliente
                              </FieldLabel>
                              <Combobox
                                 className="w-full justify-between"
                                 emptyMessage="Nenhum resultado encontrado"
                                 onValueChange={(value) =>
                                    field.handleChange(value || "")
                                 }
                                 options={counterpartyOptions}
                                 placeholder="Nome do fornecedor ou cliente"
                                 searchPlaceholder="Pesquisar"
                                 value={field.state.value}
                              />
                              {isInvalid && (
                                 <FieldError errors={field.state.meta.errors} />
                              )}
                           </Field>
                        );
                     }}
                  </form.Field>
               </FieldGroup>

               <FieldGroup>
                  <form.Field name="notes">
                     {(field) => {
                        const isInvalid =
                           field.state.meta.isTouched &&
                           !field.state.meta.isValid;
                        return (
                           <Field data-invalid={isInvalid}>
                              <FieldLabel htmlFor={field.name}>
                                 Observações
                              </FieldLabel>
                              <Textarea
                                 className="min-h-[100px]"
                                 onChange={(e) =>
                                    field.handleChange(e.target.value)
                                 }
                                 placeholder="Digite suas observações"
                                 value={field.state.value}
                              />
                              {isInvalid && (
                                 <FieldError errors={field.state.meta.errors} />
                              )}
                           </Field>
                        );
                     }}
                  </form.Field>
               </FieldGroup>
            </div>
         </div>

         <form.Subscribe
            selector={(state) => ({
               isSubmitting: state.isSubmitting,
            })}
         >
            {({ isSubmitting }) => (
               <SheetFooter className="px-4">
                  <Button
                     className="w-full"
                     disabled={isSubmitting || isLoading}
                     type="submit"
                  >
                     {isLoading
                        ? "Carregando..."
                        : "Salvar"}
                  </Button>
               </SheetFooter>
            )}
         </form.Subscribe>
      </form>
   );
}
