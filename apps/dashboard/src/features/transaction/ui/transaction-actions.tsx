import type { RouterOutput } from "@packages/api/client";
import { Button } from "@packages/ui/components/button";
import { Link } from "@tanstack/react-router";
import {
   ArrowLeftRight,
   CalendarPlus,
   Copy,
   Eye,
   FolderOpen,
   Paperclip,
   Pencil,
   RotateCcw,
   Split,
   Trash2,
} from "lucide-react";
import { useTransactionActions } from "../lib/use-transaction-actions";

type Transaction =
   RouterOutput["transactions"]["getAllPaginated"]["transactions"][number];

type TransactionActionsProps = {
   transaction: Transaction;
   onDeleteSuccess?: () => void;
   variant?: "full" | "compact";
   showViewDetails?: boolean;
   slug?: string;
};

export function TransactionActions({
   transaction,
   onDeleteSuccess,
   variant = "full",
   showViewDetails = false,
   slug,
}: TransactionActionsProps) {
   const {
      handleCategorize,
      handleCreateRecurrence,
      handleDelete,
      handleDuplicate,
      handleEdit,
      handleLinkFile,
      handleMarkAsTransfer,
      handleRefund,
      handleSplitCategories,
   } = useTransactionActions(transaction, { onDeleteSuccess });

   const isNotTransfer = transaction.type !== "transfer";

   return (
      <div className="flex flex-wrap items-center gap-2">
         {/* Group 1: Classification Actions */}
         {isNotTransfer && (
            <>
               <Button
                  onClick={handleMarkAsTransfer}
                  size="sm"
                  variant="outline"
               >
                  <ArrowLeftRight className="size-4" />
                  Marcar Transferência
               </Button>
               <Button
                  onClick={handleSplitCategories}
                  size="sm"
                  variant="outline"
               >
                  <Split className="size-4" />
                  Dividir Categorias
               </Button>
               <Button onClick={handleCategorize} size="sm" variant="outline">
                  <FolderOpen className="size-4" />
                  Categorizar
               </Button>
            </>
         )}

         <Button onClick={handleLinkFile} size="sm" variant="outline">
            <Paperclip className="size-4" />
            Anexar Arquivo
         </Button>

         {/* Separator */}
         <div className="h-4 w-px bg-border" />

         {/* View Details (optional) */}
         {showViewDetails && slug && (
            <Button asChild size="sm" variant="outline">
               <Link
                  params={{ slug, transactionId: transaction.id }}
                  to="/$slug/transactions/$transactionId"
               >
                  <Eye className="size-4" />
                  Ver Detalhes
               </Link>
            </Button>
         )}

         {/* Group 2: Management Actions */}
         <Button onClick={handleEdit} size="sm" variant="outline">
            <Pencil className="size-4" />
            {variant === "full"
               ? "Editar Transação"
               : "Editar"}
         </Button>
         <Button onClick={handleDuplicate} size="sm" variant="outline">
            <Copy className="size-4" />
            Duplicar
         </Button>
         <Button onClick={handleRefund} size="sm" variant="outline">
            <RotateCcw className="size-4" />
            Estornar
         </Button>
         <Button onClick={handleCreateRecurrence} size="sm" variant="outline">
            <CalendarPlus className="size-4" />
            Criar Recorrencia
         </Button>

         {/* Separator */}
         <div className="h-4 w-px bg-border" />

         {/* Group 3: Destructive Action */}
         <Button onClick={handleDelete} size="sm" variant="destructive">
            <Trash2 className="size-4" />
            Excluir
         </Button>
      </div>
   );
}
