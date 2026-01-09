import type { RouterOutput } from "@packages/api/client";
import { formatDecimalCurrency } from "@packages/money";
import { Card, CardContent } from "@packages/ui/components/card";
import { DataTable } from "@packages/ui/components/data-table";
import {
   Empty,
   EmptyContent,
   EmptyDescription,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import {
   InputGroup,
   InputGroupAddon,
   InputGroupInput,
} from "@packages/ui/components/input-group";
import { ItemGroup, ItemSeparator } from "@packages/ui/components/item";
import {
   SelectionActionBar,
   SelectionActionButton,
} from "@packages/ui/components/selection-action-bar";
import { Skeleton } from "@packages/ui/components/skeleton";
import type { RowSelectionState } from "@tanstack/react-table";
import {
   ArrowLeftRight,
   FolderOpen,
   Search,
   Trash2,
   Wallet,
} from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useSheet } from "@/hooks/use-sheet";
import { useTransactionBulkActions } from "../lib/use-transaction-bulk-actions";
import { CategorizeForm } from "./categorize-form";
import { MarkAsTransferForm } from "./mark-as-transfer-form";
import { TransactionExpandedContent } from "./transaction-expanded-content";
import { TransactionMobileCard } from "./transaction-mobile-card";
import { createTransactionColumns } from "./transaction-table-columns";

export type Transaction =
   RouterOutput["transactions"]["getAllPaginated"]["transactions"][number];

export type Category = {
   id: string;
   name: string;
   color: string;
   icon: string | null;
};

export type BankAccount = {
   id: string;
   name: string | null;
   bank: string;
};

type TransactionListProps = {
   transactions: Transaction[];
   categories: Category[];
   pagination: {
      currentPage: number;
      totalPages: number;
      totalCount: number;
      pageSize: number;
      onPageChange: (page: number) => void;
      onPageSizeChange?: (size: number) => void;
   };
   filters: {
      searchTerm: string;
      onSearchChange: (value: string) => void;
   };
   bankAccountId?: string;
   emptyStateTitle?: string;
   emptyStateDescription?: string;
};

export function TransactionListSkeleton() {
   return (
      <Card>
         <CardContent className="pt-6 grid gap-4">
            <div className="flex flex-col sm:flex-row gap-3">
               <Skeleton className="h-9 flex-1 sm:max-w-md" />
            </div>
            <ItemGroup>
               {Array.from({ length: 5 }).map((_, index) => (
                  <Fragment key={`transaction-skeleton-${index + 1}`}>
                     <div className="flex items-center p-4 gap-4">
                        <Skeleton className="size-10 rounded-full" />
                        <div className="space-y-2 flex-1">
                           <Skeleton className="h-4 w-32" />
                           <Skeleton className="h-3 w-24" />
                        </div>
                        <Skeleton className="h-4 w-20" />
                     </div>
                     {index !== 4 && <ItemSeparator />}
                  </Fragment>
               ))}
            </ItemGroup>
            <div className="flex items-center justify-end gap-2 pt-4">
               <Skeleton className="h-10 w-24" />
               <Skeleton className="h-10 w-10" />
               <Skeleton className="h-10 w-24" />
            </div>
         </CardContent>
      </Card>
   );
}

export function TransactionList({
   transactions,
   categories,
   pagination,
   filters,
   bankAccountId,
   emptyStateTitle,
   emptyStateDescription,
}: TransactionListProps) {
   const { activeOrganization } = useActiveOrganization();
   const { openAlertDialog } = useAlertDialog();
   const { openSheet } = useSheet();
   const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

   const { deleteSelected } = useTransactionBulkActions({
      bankAccountId,
      onSuccess: () => {
         setRowSelection({});
      },
   });

   const hasSearchTerm = filters.searchTerm.length > 0;

   const selectedIds = Object.keys(rowSelection).filter(
      (id) => rowSelection[id],
   );
   const selectedTransactions = transactions.filter((t) =>
      selectedIds.includes(t.id),
   );
   const selectedTotal = useMemo(() => {
      return selectedTransactions.reduce((sum, t) => {
         const amount = Number.parseFloat(t.amount);
         return t.type === "expense" ? sum - amount : sum + amount;
      }, 0);
   }, [selectedTransactions]);

   const handleClearSelection = () => {
      setRowSelection({});
   };

   if (transactions.length === 0 && !hasSearchTerm) {
      return (
         <Card>
            <CardContent className="pt-6">
               <Empty>
                  <EmptyContent>
                     <EmptyMedia variant="icon">
                        <Wallet className="size-12 text-muted-foreground" />
                     </EmptyMedia>
                     <EmptyTitle>
                        {emptyStateTitle ?? "Nenhuma Transação Encontrada"}
                     </EmptyTitle>
                     <EmptyDescription>
                        {emptyStateDescription ??
                           "Tente ajustar seus filtros ou adicionar uma nova transação."}
                     </EmptyDescription>
                  </EmptyContent>
               </Empty>
            </CardContent>
         </Card>
      );
   }

   return (
      <>
         <Card>
            <CardContent className="space-y-4">
               <InputGroup className="sm:max-w-md">
                  <InputGroupInput
                     onChange={(e) => filters.onSearchChange(e.target.value)}
                     placeholder="Digite para pesquisar"
                     value={filters.searchTerm}
                  />
                  <InputGroupAddon>
                     <Search />
                  </InputGroupAddon>
               </InputGroup>

               {transactions.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                     Nenhuma Transação Encontrada
                  </div>
               ) : (
                  <DataTable
                     columns={createTransactionColumns(
                        categories,
                        activeOrganization.slug,
                     )}
                     data={transactions}
                     enableRowSelection
                     getRowId={(row) => row.id}
                     onRowSelectionChange={setRowSelection}
                     pagination={{
                        currentPage: pagination.currentPage,
                        onPageChange: pagination.onPageChange,
                        onPageSizeChange: pagination.onPageSizeChange,
                        pageSize: pagination.pageSize,
                        totalCount: pagination.totalCount,
                        totalPages: pagination.totalPages,
                     }}
                     renderMobileCard={(props) => (
                        <TransactionMobileCard
                           {...props}
                           categories={categories}
                        />
                     )}
                     renderSubComponent={(props) => (
                        <TransactionExpandedContent
                           {...props}
                           categories={categories}
                           slug={activeOrganization.slug}
                        />
                     )}
                     rowSelection={rowSelection}
                  />
               )}
            </CardContent>
         </Card>

         <SelectionActionBar
            onClear={handleClearSelection}
            selectedCount={selectedIds.length}
            summary={formatDecimalCurrency(Math.abs(selectedTotal))}
         >
            <SelectionActionButton
               icon={<ArrowLeftRight className="size-3.5" />}
               onClick={() =>
                  openSheet({
                     children: (
                        <MarkAsTransferForm
                           onSuccess={() => setRowSelection({})}
                           transactions={selectedTransactions}
                        />
                     ),
                  })
               }
            >
               Transferência
            </SelectionActionButton>
            <SelectionActionButton
               icon={<FolderOpen className="size-3.5" />}
               onClick={() =>
                  openSheet({
                     children: (
                        <CategorizeForm
                           onSuccess={() => setRowSelection({})}
                           transactions={selectedTransactions}
                        />
                     ),
                  })
               }
            >
               Categorizar
            </SelectionActionButton>
            <SelectionActionButton
               icon={<Trash2 className="size-3.5" />}
               onClick={() =>
                  openAlertDialog({
                     actionLabel: "Excluir transação",
                     cancelLabel: "Cancelar",
                     description: `Tem certeza que deseja excluir ${selectedIds.length} itens? Esta ação não pode ser desfeita.`,
                     onAction: () => deleteSelected(selectedIds),
                     title: "Confirmar Exclusão",
                     variant: "destructive",
                  })
               }
               variant="destructive"
            >
               Excluir
            </SelectionActionButton>
         </SelectionActionBar>
      </>
   );
}
