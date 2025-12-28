import type { BillWithRelations } from "@packages/database/repositories/bill-repository";
import { useSheet } from "@/hooks/use-sheet";
import { useDeleteBillDialog } from "../hooks/use-delete-bill-dialog";
import { ChangeBillCategoryForm } from "../ui/change-bill-category-form";
import { CreateInstallmentsForm } from "../ui/create-installments-form";
import { DuplicateBillSheet } from "../ui/duplicate-bill-sheet";
import { EditBillMetadataForm } from "../ui/edit-bill-metadata-form";
import { LinkFileBillForm } from "../ui/link-file-bill-form";
import { ManageBillForm } from "../ui/manage-bill-form";
import { MarkAsRecurrentForm } from "../ui/mark-as-recurrent-form";

type Bill = BillWithRelations;

type UseBillActionsOptions = {
   onDeleteSuccess?: () => void;
};

export function useBillActions(bill: Bill, options?: UseBillActionsOptions) {
   const { openSheet, closeSheet } = useSheet();
   const { handleDeleteBill } = useDeleteBillDialog({
      bill,
      onSuccess: options?.onDeleteSuccess,
   });

   const handleDuplicate = () => {
      openSheet({
         children: (
            <DuplicateBillSheet
               bill={{
                  amount: bill.amount,
                  bankAccountId: bill.bankAccountId,
                  categoryId: bill.categoryId,
                  counterpartyId: bill.counterpartyId,
                  description: bill.description,
                  dueDate: new Date(bill.dueDate),
                  issueDate: bill.issueDate ? new Date(bill.issueDate) : null,
                  notes: bill.notes,
                  type: bill.type as "expense" | "income",
               }}
            />
         ),
      });
   };

   const handleLinkFile = () => {
      openSheet({
         children: <LinkFileBillForm bill={bill} onSuccess={closeSheet} />,
      });
   };

   const handleChangeCategory = () => {
      openSheet({
         children: (
            <ChangeBillCategoryForm bill={bill} onSuccess={closeSheet} />
         ),
      });
   };

   const handleMarkAsRecurrent = () => {
      openSheet({
         children: <MarkAsRecurrentForm bill={bill} onSuccess={closeSheet} />,
      });
   };

   const handleCreateInstallments = () => {
      openSheet({
         children: (
            <CreateInstallmentsForm bill={bill} onSuccess={closeSheet} />
         ),
      });
   };

   const handleEdit = () => {
      openSheet({
         children: <ManageBillForm bill={bill} />,
      });
   };

   const handleEditMetadata = () => {
      openSheet({
         children: <EditBillMetadataForm bill={bill} onSuccess={closeSheet} />,
      });
   };

   const handleComplete = () => {
      // CompleteBillDialog is used as a wrapper component with children
      // This function is for programmatic opening if needed
   };

   return {
      handleChangeCategory,
      handleComplete,
      handleCreateInstallments,
      handleDelete: handleDeleteBill,
      handleDuplicate,
      handleEdit,
      handleEditMetadata,
      handleLinkFile,
      handleMarkAsRecurrent,
   };
}
