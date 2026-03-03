import { Button } from "@packages/ui/components/button";
import { DataTable } from "@packages/ui/components/data-table";
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
import { FileText, Plus, Trash2, XCircle } from "lucide-react";
import { Suspense, useCallback, useState } from "react";
import { toast } from "sonner";
import { DefaultHeader } from "@/components/default-header";
import { BillPayCredenza } from "@/features/bills/ui/bill-pay-credenza";
import {
   type BillRow,
   buildBillsColumns,
} from "@/features/bills/ui/bills-columns";
import { BillForm } from "@/features/bills/ui/bills-form";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useCredenza } from "@/hooks/use-credenza";
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
   const { openCredenza, closeCredenza } = useCredenza();
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

   const unpayMutation = useMutation(
      orpc.bills.unpay.mutationOptions({
         onSuccess: () => {
            toast.success("Pagamento revertido com sucesso.");
         },
         onError: (error) => {
            toast.error(error.message || "Erro ao reverter pagamento.");
         },
      }),
   );

   const handlePay = useCallback(
      (bill: BillRow) => {
         openCredenza({
            children: <BillPayCredenza bill={bill} onSuccess={closeCredenza} />,
         });
      },
      [openCredenza, closeCredenza],
   );

   const handleEdit = useCallback(
      (bill: BillRow) => {
         openCredenza({
            children: (
               <BillForm bill={bill} mode="edit" onSuccess={closeCredenza} />
            ),
         });
      },
      [openCredenza, closeCredenza],
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

   const columns = buildBillsColumns(
      handlePay,
      handleEdit,
      handleCancel,
      handleDelete,
   );

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
                     ? "Adicione uma conta a pagar para começar a controlar seus pagamentos."
                     : "Adicione uma conta a receber para começar a controlar seus recebimentos."}
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
            renderMobileCard={({
               row,
               toggleExpanded,
               isExpanded,
               canExpand,
            }) => (
               <div className="rounded-lg border bg-background p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                     <div className="min-w-0">
                        <p className="font-medium truncate">
                           {row.original.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                           Venc. {(() => {
                              const [year, month, day] =
                                 row.original.dueDate.split("-");
                              return `${day}/${month}/${year}`;
                           })()}
                        </p>
                     </div>
                  </div>
                  <div className="flex items-center gap-2">
                     {row.original.status === "pending" && (
                        <Button
                           onClick={() => handlePay(row.original)}
                           size="sm"
                           variant="default"
                        >
                           {type === "payable" ? "Pagar" : "Receber"}
                        </Button>
                     )}
                     <Button
                        onClick={() => handleEdit(row.original)}
                        size="sm"
                        variant="outline"
                     >
                        Editar
                     </Button>
                     {canExpand && (
                        <Button
                           onClick={toggleExpanded}
                           size="sm"
                           variant="ghost"
                        >
                           {isExpanded ? "Ocultar" : "Mais"}
                        </Button>
                     )}
                  </div>
               </div>
            )}
            renderSubComponent={({ row }) => {
               const bill = row.original;
               const isPaid = bill.status === "paid";
               return (
                  <div className="px-4 py-4 flex items-center gap-2 flex-wrap border-t">
                     {isPaid && (
                        <Button
                           className="text-muted-foreground hover:text-foreground"
                           onClick={() => unpayMutation.mutate({ id: bill.id })}
                           size="sm"
                           variant="ghost"
                        >
                           <XCircle className="size-3 mr-2" />
                           Marcar como não pago
                        </Button>
                     )}
                     {!isPaid && (
                        <Button
                           className="text-destructive hover:text-destructive"
                           onClick={() => handleDelete(bill)}
                           size="sm"
                           variant="ghost"
                        >
                           <Trash2 className="size-3 mr-2" />
                           Excluir
                        </Button>
                     )}
                  </div>
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
   const { openCredenza, closeCredenza } = useCredenza();
   const [tab, setTab] = useState<"payable" | "receivable">("payable");

   const handleCreate = useCallback(() => {
      openCredenza({
         children: (
            <BillForm
               defaultType={tab}
               mode="create"
               onSuccess={closeCredenza}
            />
         ),
      });
   }, [openCredenza, closeCredenza, tab]);

   return (
      <main className="flex flex-col gap-4">
         <DefaultHeader
            actions={
               <Button onClick={handleCreate} size="sm">
                  <Plus className="size-4 mr-1" />
                  Nova Conta
               </Button>
            }
            description="Gerencie suas contas a pagar e a receber"
            title="Contas"
         />
         <Tabs
            onValueChange={(v) => setTab(v as "payable" | "receivable")}
            value={tab}
         >
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
