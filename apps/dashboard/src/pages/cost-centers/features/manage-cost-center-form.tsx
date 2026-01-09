import type { CostCenter } from "@packages/database/repositories/cost-center-repository";
import { Button } from "@packages/ui/components/button";
import {
   Field,
   FieldError,
   FieldGroup,
   FieldLabel,
} from "@packages/ui/components/field";
import { Input } from "@packages/ui/components/input";
import {
   SheetDescription,
   SheetFooter,
   SheetHeader,
   SheetTitle,
} from "@packages/ui/components/sheet";
import { createCodeFromName } from "@packages/utils/text";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { useMemo } from "react";
import { useSheet } from "@/hooks/use-sheet";
import { useTRPC } from "@/integrations/clients";

type ManageCostCenterFormProps = {
   costCenter?: CostCenter;
};

export function ManageCostCenterForm({
   costCenter,
}: ManageCostCenterFormProps) {
   const trpc = useTRPC();
   const { closeSheet } = useSheet();
   const isEditMode = !!costCenter;

   const modeTexts = useMemo(() => {
      const createTexts = {
         description: "Adicione um novo centro de custo para organizar suas transações.",
         title: "Criar Novo Centro de Custo",
      };

      const editTexts = {
         description: "Atualize os detalhes do seu centro de custo.",
         title: "Editar Centro de Custo",
      };

      return isEditMode ? editTexts : createTexts;
   }, [isEditMode]);

   const createCostCenterMutation = useMutation(
      trpc.costCenters.create.mutationOptions({
         onSuccess: () => {
            closeSheet();
         },
      }),
   );

   const updateCostCenterMutation = useMutation(
      trpc.costCenters.update.mutationOptions({
         onError: (error) => {
            console.error("Failed to update cost center:", error);
         },
         onSuccess: () => {
            closeSheet();
         },
      }),
   );

   const form = useForm({
      defaultValues: {
         name: costCenter?.name || "",
      },
      onSubmit: async ({ value }) => {
         if (!value.name) {
            return;
         }

         const code = createCodeFromName(value.name);

         try {
            if (isEditMode && costCenter) {
               await updateCostCenterMutation.mutateAsync({
                  data: {
                     code: code || undefined,
                     name: value.name,
                  },
                  id: costCenter.id,
               });
            } else {
               await createCostCenterMutation.mutateAsync({
                  code: code || undefined,
                  name: value.name,
               });
            }
         } catch (error) {
            console.error(
               `Failed to ${isEditMode ? "update" : "create"} cost center:`,
               error,
            );
         }
      },
   });

   return (
      <form
         className="h-full flex flex-col"
         onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
         }}
      >
         <SheetHeader>
            <SheetTitle>{modeTexts.title}</SheetTitle>
            <SheetDescription>{modeTexts.description}</SheetDescription>
         </SheetHeader>
         <div className="grid gap-4 px-4">
            <FieldGroup>
               <form.Field name="name">
                  {(field) => {
                     const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid;
                     return (
                        <Field data-invalid={isInvalid}>
                           <FieldLabel>
                              Nome
                           </FieldLabel>
                           <Input
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                 field.handleChange(e.target.value)
                              }
                              placeholder="Digite seu nome completo"
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

         <SheetFooter>
            <form.Subscribe>
               {(state) => (
                  <Button
                     className="w-full"
                     disabled={
                        !state.canSubmit ||
                        state.isSubmitting ||
                        createCostCenterMutation.isPending ||
                        updateCostCenterMutation.isPending
                     }
                     type="submit"
                  >
                     {modeTexts.title}
                  </Button>
               )}
            </form.Subscribe>
         </SheetFooter>
      </form>
   );
}
