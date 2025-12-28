import type { BillWithRelations } from "@packages/database/repositories/bill-repository";
import { translate } from "@packages/localization";
import { Button } from "@packages/ui/components/button";
import { Link } from "@tanstack/react-router";
import {
   CalendarDays,
   Copy,
   Eye,
   FolderOpen,
   Paperclip,
   Pencil,
   Split,
   Trash2,
   Wallet,
} from "lucide-react";
import { useBillActions } from "../lib/use-bill-actions";
import { CompleteBillDialog } from "./complete-bill-dialog";

type Bill = BillWithRelations;

type BillActionsProps = {
   bill: Bill;
   onDeleteSuccess?: () => void;
   variant?: "full" | "compact";
   showViewDetails?: boolean;
   slug?: string;
};

export function BillActions({
   bill,
   onDeleteSuccess,
   showViewDetails = false,
   slug,
}: BillActionsProps) {
   const {
      handleChangeCategory,
      handleCreateInstallments,
      handleDelete,
      handleDuplicate,
      handleEdit,
      handleEditMetadata,
      handleLinkFile,
      handleMarkAsRecurrent,
   } = useBillActions(bill, { onDeleteSuccess });

   const isCompleted = !!bill.completionDate;
   const isSingleBill = !bill.isRecurring && !bill.installmentGroupId;

   return (
      <div className="flex flex-wrap items-center gap-2">
         {/* Primary Actions */}
         {!isCompleted ? (
            <>
               <CompleteBillDialog bill={bill}>
                  <Button size="sm" variant="outline">
                     <Wallet className="size-4" />
                     {bill.type === "expense"
                        ? translate("dashboard.routes.bills.actions.pay")
                        : translate("dashboard.routes.bills.actions.receive")}
                  </Button>
               </CompleteBillDialog>
               <Button onClick={handleEdit} size="sm" variant="outline">
                  <Pencil className="size-4" />
                  {translate("dashboard.routes.bills.actions.edit")}
               </Button>
            </>
         ) : (
            <Button onClick={handleEditMetadata} size="sm" variant="outline">
               <Pencil className="size-4" />
               {translate("dashboard.routes.bills.actions.edit-metadata")}
            </Button>
         )}

         {/* Management Actions */}
         {showViewDetails && slug && (
            <Button asChild size="sm" variant="outline">
               <Link
                  params={{ billId: bill.id, slug }}
                  to="/$slug/bills/$billId"
               >
                  <Eye className="size-4" />
                  {translate(
                     "dashboard.routes.bills.list-section.actions.view-details",
                  )}
               </Link>
            </Button>
         )}

         <Button onClick={handleDuplicate} size="sm" variant="outline">
            <Copy className="size-4" />
            {translate("dashboard.routes.bills.actions.duplicate")}
         </Button>

         <Button onClick={handleLinkFile} size="sm" variant="outline">
            <Paperclip className="size-4" />
            {translate("dashboard.routes.bills.actions.link-file")}
         </Button>

         <Button onClick={handleChangeCategory} size="sm" variant="outline">
            <FolderOpen className="size-4" />
            {translate("dashboard.routes.bills.actions.change-category")}
         </Button>

         {/* Separator */}
         <div className="h-4 w-px bg-border" />

         {/* Bill-specific Actions (only for single bills) */}
         {isSingleBill && (
            <>
               <Button
                  onClick={handleMarkAsRecurrent}
                  size="sm"
                  variant="outline"
               >
                  <CalendarDays className="size-4" />
                  {translate(
                     "dashboard.routes.bills.actions.mark-as-recurrent",
                  )}
               </Button>
               <Button
                  onClick={handleCreateInstallments}
                  size="sm"
                  variant="outline"
               >
                  <Split className="size-4" />
                  {translate(
                     "dashboard.routes.bills.actions.create-installments",
                  )}
               </Button>
               {/* Separator */}
               <div className="h-4 w-px bg-border" />
            </>
         )}

         {/* Destructive Action */}
         <Button onClick={handleDelete} size="sm" variant="destructive">
            <Trash2 className="size-4" />
            {translate("dashboard.routes.bills.actions.delete")}
         </Button>
      </div>
   );
}
