import type { BillWithRelations } from "@packages/database/repositories/bill-repository";
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import { Combobox } from "@packages/ui/components/combobox";
import {
   Field,
   FieldDescription,
   FieldGroup,
   FieldLabel,
} from "@packages/ui/components/field";
import {
   SheetDescription,
   SheetFooter,
   SheetHeader,
   SheetTitle,
} from "@packages/ui/components/sheet";
import { getRandomColor } from "@packages/utils/colors";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { CostCenterCombobox } from "@/features/cost-center/ui/cost-center-combobox";
import type { IconName } from "@/features/icon-selector/lib/available-icons";
import { IconDisplay } from "@/features/icon-selector/ui/icon-display";
import { TagMultiSelect } from "@/features/tag/ui/tag-multi-select";
import { useTRPC } from "@/integrations/clients";

type Bill = BillWithRelations;

type ChangeBillCategoryFormProps = {
   bill: Bill;
   onSuccess?: () => void;
};

export function ChangeBillCategoryForm({
   bill,
   onSuccess,
}: ChangeBillCategoryFormProps) {
   const trpc = useTRPC();
   const queryClient = useQueryClient();

   // Fetch existing bill tags
   const { data: billTags = [] } = useQuery(
      trpc.bills.getBillTags.queryOptions({ billId: bill.id }),
   );

   const [selectedCategoryId, setSelectedCategoryId] = useState<string>(
      bill.categoryId || "",
   );
   const [selectedTagIds, setSelectedTagIds] = useState<string[]>(
      billTags.map((t) => t.id),
   );
   const [selectedCostCenterId, setSelectedCostCenterId] = useState<string>(
      bill.costCenterId || "",
   );

   // Update selectedTagIds when billTags loads
   const initialTagIds = billTags.map((t) => t.id);
   useEffect(() => {
      if (
         billTags.length > 0 &&
         selectedTagIds.length === 0 &&
         initialTagIds.length > 0
      ) {
         setSelectedTagIds(initialTagIds);
      }
   }, [billTags, initialTagIds, selectedTagIds]);

   const { data: allCategories = [] } = useQuery(
      trpc.categories.getAll.queryOptions(),
   );

   const { data: tags = [] } = useQuery(trpc.tags.getAll.queryOptions());

   const { data: costCenters = [] } = useQuery(
      trpc.costCenters.getAll.queryOptions(),
   );

   // Filter categories based on bill type
   const categories = allCategories.filter((cat) => {
      if (!cat.transactionTypes || cat.transactionTypes.length === 0) {
         return true;
      }
      return cat.transactionTypes.includes(bill.type as "income" | "expense");
   });

   const updateBillMutation = useMutation(
      trpc.bills.update.mutationOptions({
         onError: (error) => {
            toast.error(error.message || "Erro ao atualizar categorização");
         },
         onSuccess: () => {
            queryClient.invalidateQueries({
               queryKey: trpc.bills.getById.queryKey({ id: bill.id }),
            });
            queryClient.invalidateQueries({
               queryKey: trpc.bills.getAllPaginated.queryKey(),
            });
            queryClient.invalidateQueries({
               queryKey: trpc.bills.getBillTags.queryKey({ billId: bill.id }),
            });
            toast.success("Categorização atualizada com sucesso");
            onSuccess?.();
         },
      }),
   );

   const createCategoryMutation = useMutation(
      trpc.categories.create.mutationOptions({
         onError: (error) => {
            toast.error(error.message || "Falha ao criar categoria");
         },
         onSuccess: (data) => {
            if (!data) return;
            setSelectedCategoryId(data.id);
            toast.success(`Categoria "${data.name}" criada`);
         },
      }),
   );

   const createTagMutation = useMutation(
      trpc.tags.create.mutationOptions({
         onError: (error) => {
            toast.error(error.message || "Falha ao criar tag");
         },
         onSuccess: (data) => {
            if (!data) return;
            setSelectedTagIds((prev) => [...prev, data.id]);
            toast.success(`Tag "${data.name}" criada`);
         },
      }),
   );

   const createCostCenterMutation = useMutation(
      trpc.costCenters.create.mutationOptions({
         onError: (error) => {
            toast.error(error.message || "Falha ao criar centro de custo");
         },
         onSuccess: (data) => {
            if (!data) return;
            setSelectedCostCenterId(data.id);
            toast.success(`Centro de custo "${data.name}" criado`);
         },
      }),
   );

   const handleCreateCategory = useCallback(
      (name: string) => {
         createCategoryMutation.mutate({
            color: getRandomColor(),
            name,
            transactionTypes: [bill.type as "income" | "expense"],
         });
      },
      [createCategoryMutation.mutate, bill.type],
   );

   const handleCreateTag = useCallback(
      (name: string) => {
         createTagMutation.mutate({
            color: getRandomColor(),
            name,
         });
      },
      [createTagMutation.mutate],
   );

   const handleCreateCostCenter = useCallback(
      (name: string) => {
         createCostCenterMutation.mutate({
            name,
         });
      },
      [createCostCenterMutation.mutate],
   );

   const handleSubmit = () => {
      const updateData: Record<string, unknown> = {};

      if (selectedCategoryId !== (bill.categoryId || "")) {
         updateData.categoryId = selectedCategoryId || undefined;
      }

      if (selectedCostCenterId !== (bill.costCenterId || "")) {
         updateData.costCenterId = selectedCostCenterId || undefined;
      }

      const existingTagIds = billTags.map((t) => t.id).sort();
      const newTagIds = [...selectedTagIds].sort();
      if (JSON.stringify(existingTagIds) !== JSON.stringify(newTagIds)) {
         updateData.tagIds = selectedTagIds;
      }

      if (Object.keys(updateData).length === 0) {
         toast.info("Nenhuma alteração detectada");
         onSuccess?.();
         return;
      }

      updateBillMutation.mutate({
         data: updateData,
         id: bill.id,
      });
   };

   const categoryOptions = categories.map((category) => ({
      icon: (
         <div
            className="flex size-4 items-center justify-center rounded"
            style={{ backgroundColor: category.color }}
         >
            <IconDisplay iconName={category.icon as IconName} size={10} />
         </div>
      ),
      label: category.name,
      value: category.id,
   }));

   const isLoading = updateBillMutation.isPending;
   const isCreating =
      createCategoryMutation.isPending ||
      createTagMutation.isPending ||
      createCostCenterMutation.isPending;

   return (
      <>
         <SheetHeader>
            <SheetTitle>Categorizar Conta</SheetTitle>
            <SheetDescription>
               Associe categoria, tags e centro de custo a esta conta
            </SheetDescription>
         </SheetHeader>

         <div className="px-4 flex-1 overflow-y-auto">
            <div className="space-y-4 py-4">
               <FieldGroup>
                  <Field>
                     <FieldLabel>Categoria</FieldLabel>
                     <Combobox
                        className="w-full justify-between"
                        createLabel="Criar categoria"
                        disabled={isLoading || isCreating}
                        emptyMessage="Nenhum resultado encontrado"
                        onCreate={handleCreateCategory}
                        onValueChange={(value) =>
                           setSelectedCategoryId(value || "")
                        }
                        options={categoryOptions}
                        placeholder="Selecione uma categoria"
                        searchPlaceholder="Pesquisar"
                        value={selectedCategoryId}
                     />
                     <FieldDescription>
                        Agrupe suas transações por tipo de gasto ou receita para
                        análises detalhadas
                     </FieldDescription>
                  </Field>
               </FieldGroup>

               <FieldGroup>
                  <Field>
                     <FieldLabel>Tags</FieldLabel>
                     {selectedTagIds.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-2">
                           {selectedTagIds.map((tagId) => {
                              const tag = tags.find((t) => t.id === tagId);
                              if (!tag) return null;
                              return (
                                 <Badge
                                    key={tag.id}
                                    style={{ backgroundColor: tag.color }}
                                    variant="secondary"
                                 >
                                    {tag.name}
                                    <button
                                       className="ml-1 rounded-full hover:bg-black/20"
                                       onClick={() =>
                                          setSelectedTagIds((prev) =>
                                             prev.filter((id) => id !== tag.id),
                                          )
                                       }
                                       type="button"
                                    >
                                       <X className="size-3" />
                                    </button>
                                 </Badge>
                              );
                           })}
                        </div>
                     )}
                     <TagMultiSelect
                        className="flex-1"
                        onChange={(val) => setSelectedTagIds(val)}
                        onCreate={handleCreateTag}
                        placeholder="Selecione as tags"
                        selected={selectedTagIds}
                        tags={tags}
                     />
                     <FieldDescription>
                        Adicione marcadores personalizados para filtrar e
                        organizar suas transações
                     </FieldDescription>
                  </Field>
               </FieldGroup>

               <FieldGroup>
                  <Field>
                     <FieldLabel>Centro de Custo</FieldLabel>
                     <CostCenterCombobox
                        className="w-full justify-between"
                        costCenters={costCenters}
                        disabled={isLoading || isCreating}
                        onCreate={handleCreateCostCenter}
                        onValueChange={(value) =>
                           setSelectedCostCenterId(value || "")
                        }
                        value={selectedCostCenterId}
                     />
                     <FieldDescription>
                        Associe a departamentos, projetos ou áreas para controle
                        orçamentário
                     </FieldDescription>
                  </Field>
               </FieldGroup>
            </div>
         </div>

         <SheetFooter className="px-4">
            <Button
               className="w-full"
               disabled={isLoading || isCreating}
               onClick={handleSubmit}
            >
               {isLoading ? "Carregando..." : "Salvar"}
            </Button>
         </SheetFooter>
      </>
   );
}
