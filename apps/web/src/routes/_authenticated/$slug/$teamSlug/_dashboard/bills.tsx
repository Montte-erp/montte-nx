import { Button } from "@packages/ui/components/button";
import { DataTable } from "@packages/ui/components/data-table";
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuSeparator,
   DropdownMenuTrigger,
} from "@packages/ui/components/dropdown-menu";
import {
   Empty,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import { Skeleton } from "@packages/ui/components/skeleton";
import {
   Tabs,
   TabsContent,
   TabsList,
   TabsTrigger,
} from "@packages/ui/components/tabs";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
   Check,
   FileText,
   MoreHorizontal,
   Pencil,
   Trash2,
   XCircle,
} from "lucide-react";
import { Suspense, useCallback } from "react";
import { toast } from "sonner";
import { DefaultHeader } from "@/components/default-header";
import { BillPayDialogStack } from "@/features/bills/ui/bill-pay-dialog-stack";
import {
   type BillRow,
   buildBillsColumns,
   computeDisplayStatus,
} from "@/features/bills/ui/bills-columns";
import { BillForm } from "@/features/bills/ui/bills-form";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useDialogStack } from "@/hooks/use-dialog-stack";
import { orpc } from "@/integrations/orpc/client";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/bills",
)({
   loader: ({ context }) => {
      context.queryClient.prefetchQuery(
         orpc.bills.getAll.queryOptions({ input: { type: "payable" } }),
      );
      context.queryClient.prefetchQuery(
         orpc.bills.getAll.queryOptions({ input: { type: "receivable" } }),
      );
   },
   component: BillsPage,
});

// =============================================================================
// Skeleton
// =============================================================================

function BillsSkeleton() {
   return (
      <div className="space-y-3">
         {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton className="h-12 w-full" key={`skeleton-${index + 1}`} />
         ))}
      </div>
   );
}

// =============================================================================
// Summary
// =============================================================================

interface BillsSummaryProps {
   items: BillRow[];
}

function BillsSummary({ items }: BillsSummaryProps) {
   const today = new Date().toISOString().substring(0, 10);

   const pending = items
      .filter((b) => b.status === "pending" && b.dueDate >= today)
      .reduce((sum, b) => sum + Number(b.amount), 0);

   const overdue = items
      .filter((b) => b.status === "pending" && b.dueDate < today)
      .reduce((sum, b) => sum + Number(b.amount), 0);

   const paid = items
      .filter((b) => b.status === "paid")
      .reduce((sum, b) => sum + Number(b.amount), 0);

   function formatBRL(value: number): string {
      return value.toLocaleString("pt-BR", {
         style: "currency",
         currency: "BRL",
      });
   }

   return (
      <div className="grid grid-cols-3 gap-3">
         <div className="rounded-lg border bg-background p-4 space-y-1">
            <p className="text-xs text-muted-foreground">Pendente</p>
            <p className="text-lg font-semibold tabular-nums">
               {formatBRL(pending)}
            </p>
         </div>
         <div className="rounded-lg border bg-background p-4 space-y-1">
            <p className="text-xs text-muted-foreground">Vencidas</p>
            <p className="text-lg font-semibold tabular-nums text-destructive">
               {formatBRL(overdue)}
            </p>
         </div>
         <div className="rounded-lg border bg-background p-4 space-y-1">
            <p className="text-xs text-muted-foreground">Pagas</p>
            <p className="text-lg font-semibold tabular-nums">
               {formatBRL(paid)}
            </p>
         </div>
      </div>
   );
}

// =============================================================================
// List
// =============================================================================

interface BillsListProps {
   type: "payable" | "receivable";
}

function BillsList({ type }: BillsListProps) {
   const { openDialogStack, closeDialogStack } = useDialogStack();
   const { openAlertDialog } = useAlertDialog();

   const { data } = useSuspenseQuery(
      orpc.bills.getAll.queryOptions({ input: { type } }),
   );

   const items = (data?.items ?? []) as BillRow[];

   const cancelMutation = useMutation(
      orpc.bills.cancel.mutationOptions({
         onSuccess: () => {
            toast.success("Conta cancelada com sucesso.");
         },
         onError: (error) => {
            toast.error(error.message || "Erro ao cancelar conta.");
         },
      }),
   );

   const deleteMutation = useMutation(
      orpc.bills.remove.mutationOptions({
         onSuccess: () => {
            toast.success("Conta excluída com sucesso.");
         },
         onError: (error) => {
            toast.error(error.message || "Erro ao excluir conta.");
         },
      }),
   );

   const handlePay = useCallback(
      (bill: BillRow) => {
         openDialogStack({
            children: (
               <BillPayDialogStack bill={bill} onSuccess={closeDialogStack} />
            ),
         });
      },
      [openDialogStack, closeDialogStack],
   );

   const handleEdit = useCallback(
      (bill: BillRow) => {
         openDialogStack({
            children: <BillForm bill={bill} onSuccess={closeDialogStack} />,
         });
      },
      [openDialogStack, closeDialogStack],
   );

   const handleCancel = useCallback(
      (bill: BillRow) => {
         openAlertDialog({
            title: "Cancelar conta",
            description: `Tem certeza que deseja cancelar a conta "${bill.name}"? Esta ação não pode ser desfeita.`,
            actionLabel: "Cancelar conta",
            cancelLabel: "Voltar",
            variant: "destructive",
            onAction: async () => {
               await cancelMutation.mutateAsync({ id: bill.id });
            },
         });
      },
      [openAlertDialog, cancelMutation],
   );

   const handleDelete = useCallback(
      (bill: BillRow) => {
         openAlertDialog({
            title: "Excluir conta",
            description: `Tem certeza que deseja excluir a conta "${bill.name}"? Esta ação não pode ser desfeita.`,
            actionLabel: "Excluir",
            cancelLabel: "Cancelar",
            variant: "destructive",
            onAction: async () => {
               await deleteMutation.mutateAsync({ id: bill.id });
            },
         });
      },
      [openAlertDialog, deleteMutation],
   );

   const columns = buildBillsColumns();

   if (items.length === 0) {
      return (
         <Empty>
            <EmptyHeader>
               <EmptyMedia variant="icon">
                  <FileText className="size-6" />
               </EmptyMedia>
               <EmptyTitle>Nenhuma conta encontrada</EmptyTitle>
               <EmptyDescription>
                  {type === "payable"
                     ? "Contas a pagar são criadas automaticamente a partir de lançamentos."
                     : "Contas a receber são criadas automaticamente a partir de lançamentos."}
               </EmptyDescription>
            </EmptyHeader>
         </Empty>
      );
   }

   return (
      <div className="space-y-4">
         <BillsSummary items={items} />
         <DataTable
            columns={columns}
            data={items}
            getRowId={(row) => row.id}
            renderActions={({ row }) => {
               const bill = row.original;
               const displayStatus = computeDisplayStatus(bill);
               const isPaid = displayStatus === "paid";
               const isCancelled = displayStatus === "cancelled";
               const payLabel = bill.type === "payable" ? "Pagar" : "Receber";
               return (
                  <>
                     {!isPaid && !isCancelled && (
                        <Button
                           className="gap-1.5"
                           onClick={() => handlePay(bill)}
                           variant="default"
                        >
                           <Check className="size-3.5" />
                           {payLabel}
                        </Button>
                     )}
                     <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                           <Button variant="outline">
                              <MoreHorizontal className="size-4" />
                              <span className="sr-only">Ações</span>
                           </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                           {!isPaid && !isCancelled && (
                              <DropdownMenuItem
                                 onClick={() => handleEdit(bill)}
                              >
                                 <Pencil className="size-3.5" />
                                 Editar
                              </DropdownMenuItem>
                           )}
                           {!isPaid && !isCancelled && (
                              <DropdownMenuItem
                                 onClick={() => handleCancel(bill)}
                              >
                                 <XCircle className="size-3.5" />
                                 Cancelar
                              </DropdownMenuItem>
                           )}
                           {!isPaid && (
                              <>
                                 <DropdownMenuSeparator />
                                 <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => handleDelete(bill)}
                                 >
                                    <Trash2 className="size-3.5" />
                                    Excluir
                                 </DropdownMenuItem>
                              </>
                           )}
                        </DropdownMenuContent>
                     </DropdownMenu>
                  </>
               );
            }}
         />
      </div>
   );
}

// =============================================================================
// Page
// =============================================================================

function BillsPage() {
   return (
      <main className="flex flex-col gap-4">
         <DefaultHeader
            description="Gerencie suas contas a pagar e a receber"
            title="Contas"
         />
         <Tabs defaultValue="payable">
            <TabsList>
               <TabsTrigger value="payable">A Pagar</TabsTrigger>
               <TabsTrigger value="receivable">A Receber</TabsTrigger>
            </TabsList>
            <TabsContent className="mt-4" value="payable">
               <Suspense fallback={<BillsSkeleton />}>
                  <BillsList type="payable" />
               </Suspense>
            </TabsContent>
            <TabsContent className="mt-4" value="receivable">
               <Suspense fallback={<BillsSkeleton />}>
                  <BillsList type="receivable" />
               </Suspense>
            </TabsContent>
         </Tabs>
      </main>
   );
}
