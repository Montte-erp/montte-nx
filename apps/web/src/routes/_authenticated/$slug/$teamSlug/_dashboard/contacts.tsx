import { Button } from "@packages/ui/components/button";
import {
   DataTable,
   type DataTableStoredState,
} from "@packages/ui/components/data-table";
import {
   Empty,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import {
   SelectionActionBar,
   SelectionActionButton,
} from "@packages/ui/components/selection-action-bar";
import { Skeleton } from "@packages/ui/components/skeleton";
import { useRowSelection } from "@packages/ui/hooks/use-row-selection";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { createLocalStorageState } from "foxact/create-local-storage-state";
import { Pencil, Plus, Trash2, Users } from "lucide-react";

import { Suspense, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { DefaultHeader } from "@/components/default-header";
import {
   EarlyAccessBanner,
   type EarlyAccessBannerTemplate,
} from "@/features/billing/ui/early-access-banner";

import {
   buildContactColumns,
   type ContactRow,
} from "@/features/contacts/ui/contacts-columns";
import { ContactForm } from "@/features/contacts/ui/contacts-form";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useCredenza } from "@/hooks/use-credenza";
import { orpc } from "@/integrations/orpc/client";
import { tableSearchSchema } from "@/lib/table-search-schema";
import type {
   ColumnFiltersState,
   OnChangeFn,
   SortingState,
} from "@tanstack/react-table";
import { z } from "zod";

const [useContactsTableState] =
   createLocalStorageState<DataTableStoredState | null>(
      "montte:datatable:contacts",
      null,
   );

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/contacts",
)({
   validateSearch: tableSearchSchema.extend({
      typeFilter: z
         .enum(["all", "cliente", "fornecedor", "ambos"])
         .catch("all")
         .default("all"),
   }),
   loader: ({ context }) => {
      context.queryClient.prefetchQuery(orpc.contacts.getAll.queryOptions({}));
   },
   pendingMs: 300,
   pendingComponent: ContactsSkeleton,
   head: () => ({
      meta: [{ title: "Contatos — Montte" }],
   }),
   component: ContactsPage,
});

const CONTACTS_BANNER: EarlyAccessBannerTemplate = {
   badgeLabel: "Contatos",
   message: "Esta funcionalidade está em fase alpha.",
   ctaLabel: "Deixar feedback",
   stage: "alpha",
   icon: Users,
   bullets: [
      "Cadastre clientes e fornecedores",
      "Vincule contatos a transações e cobranças",
      "Seu feedback nos ajuda a melhorar",
   ],
};

function ContactsSkeleton() {
   return (
      <div className="flex flex-col gap-4">
         {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton className="h-12 w-full" key={`skeleton-${index + 1}`} />
         ))}
      </div>
   );
}

type TypeFilter = "all" | "cliente" | "fornecedor" | "ambos";

const TYPE_FILTER_LABELS: Record<TypeFilter, string> = {
   all: "Todos",
   cliente: "Clientes",
   fornecedor: "Fornecedores",
   ambos: "Ambos",
};

function ContactsList() {
   const navigate = Route.useNavigate();
   const { sorting, columnFilters, typeFilter } = Route.useSearch();
   const [tableState, setTableState] = useContactsTableState();
   const { openCredenza, closeCredenza } = useCredenza();
   const { openAlertDialog } = useAlertDialog();
   const {
      rowSelection,
      onRowSelectionChange,
      selectedCount,
      selectedIds,
      onClear,
   } = useRowSelection();

   const { data: contacts } = useSuspenseQuery(
      orpc.contacts.getAll.queryOptions({
         input: typeFilter !== "all" ? { type: typeFilter } : {},
      }),
   );

   const deleteMutation = useMutation(
      orpc.contacts.remove.mutationOptions({
         onSuccess: () => {
            toast.success("Contato excluído com sucesso.");
         },
         onError: (error) => {
            toast.error(error.message || "Erro ao excluir contato.");
         },
      }),
   );

   const handleSortingChange: OnChangeFn<SortingState> = useCallback(
      (updater) => {
         const next =
            typeof updater === "function"
               ? updater(sorting as SortingState)
               : updater;
         navigate({
            search: (prev: z.infer<typeof tableSearchSchema>) => ({
               ...prev,
               sorting: next,
            }),
            replace: true,
         });
      },
      [navigate, sorting],
   );

   const handleColumnFiltersChange: OnChangeFn<ColumnFiltersState> =
      useCallback(
         (updater) => {
            const next =
               typeof updater === "function"
                  ? updater(columnFilters as ColumnFiltersState)
                  : updater;
            navigate({
               search: (prev: z.infer<typeof tableSearchSchema>) => ({
                  ...prev,
                  columnFilters: next,
               }),
               replace: true,
            });
         },
         [navigate, columnFilters],
      );

   const handleEdit = useCallback(
      (contact: ContactRow) => {
         openCredenza({
            children: (
               <ContactForm
                  contact={contact}
                  mode="edit"
                  onSuccess={closeCredenza}
               />
            ),
         });
      },
      [openCredenza, closeCredenza],
   );

   const handleDelete = useCallback(
      (contact: ContactRow) => {
         openAlertDialog({
            title: "Excluir contato",
            description: `Tem certeza que deseja excluir "${contact.name}"? Esta ação não pode ser desfeita.`,
            actionLabel: "Excluir",
            cancelLabel: "Cancelar",
            variant: "destructive",
            onAction: async () => {
               await deleteMutation.mutateAsync({ id: contact.id });
            },
         });
      },
      [openAlertDialog, deleteMutation],
   );

   const handleBulkDelete = useCallback(() => {
      openAlertDialog({
         title: `Excluir ${selectedCount} ${selectedCount === 1 ? "contato" : "contatos"}`,
         description:
            "Tem certeza que deseja excluir os contatos selecionados? Esta ação não pode ser desfeita.",
         actionLabel: "Excluir",
         cancelLabel: "Cancelar",
         variant: "destructive",
         onAction: async () => {
            await Promise.all(
               selectedIds.map((id) => deleteMutation.mutateAsync({ id })),
            );
            onClear();
         },
      });
   }, [openAlertDialog, selectedCount, selectedIds, deleteMutation, onClear]);

   if (contacts.length === 0) {
      return (
         <Empty>
            <EmptyHeader>
               <EmptyMedia variant="icon">
                  <Users className="size-6" />
               </EmptyMedia>
               <EmptyTitle>Nenhum contato</EmptyTitle>
               <EmptyDescription>
                  Cadastre clientes e fornecedores para organizar suas
                  transações.
               </EmptyDescription>
            </EmptyHeader>
         </Empty>
      );
   }

   const columns = useMemo(() => buildContactColumns(), []);

   return (
      <>
         <DataTable
            columns={columns}
            data={contacts as ContactRow[]}
            getRowId={(row) => row.id}
            sorting={sorting as SortingState}
            onSortingChange={handleSortingChange}
            columnFilters={columnFilters as ColumnFiltersState}
            onColumnFiltersChange={handleColumnFiltersChange}
            tableState={tableState}
            onTableStateChange={setTableState}
            onRowSelectionChange={onRowSelectionChange}
            renderActions={({ row }) => (
               <>
                  <Button
                     onClick={() => handleEdit(row.original)}
                     tooltip="Editar"
                     variant="outline"
                  >
                     <Pencil className="size-4" />
                  </Button>
                  <Button
                     className="text-destructive hover:text-destructive"
                     onClick={() => handleDelete(row.original)}
                     tooltip="Excluir"
                     variant="outline"
                  >
                     <Trash2 className="size-4" />
                  </Button>
               </>
            )}
            rowSelection={rowSelection}
         />
         <SelectionActionBar onClear={onClear} selectedCount={selectedCount}>
            <SelectionActionButton
               icon={<Trash2 className="size-3.5" />}
               onClick={handleBulkDelete}
               variant="destructive"
            >
               Excluir
            </SelectionActionButton>
         </SelectionActionBar>
      </>
   );
}

function ContactsPage() {
   const { openCredenza, closeCredenza } = useCredenza();
   const { typeFilter } = Route.useSearch();
   const navigate = Route.useNavigate();

   const handleCreate = useCallback(() => {
      openCredenza({
         children: <ContactForm mode="create" onSuccess={closeCredenza} />,
      });
   }, [openCredenza, closeCredenza]);

   return (
      <main className="flex flex-col gap-4">
         <DefaultHeader
            actions={
               <Button onClick={handleCreate}>
                  <Plus className="size-4" />
                  Novo Contato
               </Button>
            }
            description="Gerencie clientes e fornecedores"
            title="Contatos"
         />
         <EarlyAccessBanner template={CONTACTS_BANNER} />

         <div className="flex gap-2 flex-wrap">
            {(Object.keys(TYPE_FILTER_LABELS) as TypeFilter[]).map((key) => (
               <Button
                  key={key}
                  onClick={() =>
                     navigate({
                        search: (prev) => ({
                           ...prev,
                           typeFilter: key as TypeFilter,
                        }),
                        replace: true,
                     })
                  }
                  variant={typeFilter === key ? "default" : "outline"}
               >
                  {TYPE_FILTER_LABELS[key]}
               </Button>
            ))}
         </div>

         <Suspense fallback={<ContactsSkeleton />}>
            <ContactsList />
         </Suspense>
      </main>
   );
}
