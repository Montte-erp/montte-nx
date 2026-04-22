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
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { createLocalStorageState } from "foxact/create-local-storage-state";
import { Trash2, Users } from "lucide-react";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { DefaultHeader } from "@/components/default-header";
import {
   EarlyAccessBanner,
   type EarlyAccessBannerTemplate,
} from "@/features/billing/ui/early-access-banner";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { QueryBoundary } from "@/components/query-boundary";
import { useOrgSlug, useTeamSlug } from "@/hooks/use-dashboard-slugs";
import { DataTableSkeleton } from "@/components/data-table/data-table-skeleton";
import { orpc } from "@/integrations/orpc/client";
import {
   buildContactColumns,
   type ContactRow,
} from "./-contacts/contacts-columns";

const [useContactsTableState, setContactsTableState] =
   createLocalStorageState<DataTableStoredState | null>(
      "montte:datatable:contacts",
      null,
   );

const tableSearchSchema = z.object({
   sorting: z
      .array(z.object({ id: z.string(), desc: z.boolean() }))
      .catch([])
      .default([]),
   columnFilters: z
      .array(z.object({ id: z.string(), value: z.unknown() }))
      .catch([])
      .default([]),
   selectedIds: z.array(z.string()).catch([]).default([]),
   typeFilter: z
      .enum(["all", "cliente", "fornecedor", "ambos"])
      .catch("all")
      .default("all"),
});

type TypeFilter = "all" | "cliente" | "fornecedor" | "ambos";

const TYPE_FILTER_LABELS: Record<TypeFilter, string> = {
   all: "Todos",
   cliente: "Clientes",
   fornecedor: "Fornecedores",
   ambos: "Ambos",
};

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

const skeletonColumns = buildContactColumns();

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/contacts",
)({
   validateSearch: tableSearchSchema,
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

function ContactsSkeleton() {
   return <DataTableSkeleton columns={skeletonColumns} />;
}

function ContactsList() {
   const navigate = Route.useNavigate();
   const { sorting, columnFilters, typeFilter, selectedIds } =
      Route.useSearch();
   const { openAlertDialog } = useAlertDialog();
   const [tableState] = useContactsTableState();
   const slug = useOrgSlug();
   const teamSlug = useTeamSlug();

   const rowSelection = useMemo(
      () => Object.fromEntries(selectedIds.map((id) => [id, true])),
      [selectedIds],
   );

   const onRowSelectionChange = useCallback(
      (
         updater:
            | Record<string, boolean>
            | ((prev: Record<string, boolean>) => Record<string, boolean>),
      ) => {
         const next =
            typeof updater === "function" ? updater(rowSelection) : updater;
         const nextIds = Object.keys(next).filter((id) => next[id]);
         navigate({
            search: (prev) => ({ ...prev, selectedIds: nextIds }),
            replace: true,
         });
      },
      [navigate, rowSelection],
   );

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

   const bulkDeleteMutation = useMutation(
      orpc.contacts.bulkRemove.mutationOptions({
         onSuccess: () => {
            toast.success("Contatos excluídos com sucesso");
         },
         onError: () => {
            toast.error("Erro ao excluir contatos");
         },
      }),
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

   const selectedContacts = contacts.filter((c) => selectedIds.includes(c.id));

   const clearSelection = useCallback(
      () =>
         navigate({
            search: (prev) => ({ ...prev, selectedIds: [] }),
            replace: true,
         }),
      [navigate],
   );

   const handleBulkDelete = useCallback(() => {
      const ids = selectedContacts.map((c) => c.id);
      openAlertDialog({
         title: `Excluir ${ids.length} ${ids.length === 1 ? "contato" : "contatos"}`,
         description:
            "Tem certeza que deseja excluir os contatos selecionados? Esta ação não pode ser desfeita.",
         actionLabel: "Excluir",
         cancelLabel: "Cancelar",
         variant: "destructive",
         onAction: async () => {
            await bulkDeleteMutation.mutateAsync({ ids });
            clearSelection();
         },
      });
   }, [selectedContacts, openAlertDialog, bulkDeleteMutation, clearSelection]);

   const columns = useMemo(
      () => buildContactColumns({ slug, teamSlug }),
      [slug, teamSlug],
   );

   return (
      <div className="flex flex-col gap-4">
         <div className="flex flex-wrap items-center gap-2">
            {(["cliente", "fornecedor", "ambos"] as const).map((key) => (
               <Button
                  key={key}
                  size="sm"
                  variant={typeFilter === key ? "default" : "outline"}
                  onClick={() =>
                     navigate({
                        search: (prev) => ({
                           ...prev,
                           typeFilter: typeFilter === key ? "all" : key,
                        }),
                        replace: true,
                     })
                  }
               >
                  {TYPE_FILTER_LABELS[key]}
               </Button>
            ))}
         </div>

         {contacts.length === 0 ? (
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
         ) : (
            <DataTable
               columns={columns}
               data={contacts}
               getRowId={(row) => row.id}
               sorting={sorting}
               onSortingChange={(updater) => {
                  const next =
                     typeof updater === "function" ? updater(sorting) : updater;
                  navigate({
                     search: (prev) => ({ ...prev, sorting: next }),
                     replace: true,
                  });
               }}
               columnFilters={columnFilters}
               onColumnFiltersChange={(updater) => {
                  const next =
                     typeof updater === "function"
                        ? updater(columnFilters)
                        : updater;
                  navigate({
                     search: (prev) => ({ ...prev, columnFilters: next }),
                     replace: true,
                  });
               }}
               tableState={tableState}
               onTableStateChange={setContactsTableState}
               rowSelection={rowSelection}
               onRowSelectionChange={onRowSelectionChange}
               renderActions={({ row }) => (
                  <Button
                     className="text-destructive hover:text-destructive"
                     onClick={() => handleDelete(row.original)}
                     size="icon"
                     variant="ghost"
                  >
                     <Trash2 className="size-4" />
                     <span className="sr-only">Excluir</span>
                  </Button>
               )}
            />
         )}

         <SelectionActionBar
            selectedCount={selectedIds.length}
            onClear={clearSelection}
         >
            <SelectionActionButton
               icon={<Trash2 className="size-3.5" />}
               variant="destructive"
               onClick={handleBulkDelete}
            >
               Excluir
            </SelectionActionButton>
         </SelectionActionBar>
      </div>
   );
}

function ContactsPage() {
   return (
      <main className="flex flex-col gap-4">
         <DefaultHeader
            description="Gerencie clientes e fornecedores"
            title="Contatos"
         />
         <EarlyAccessBanner template={CONTACTS_BANNER} />
         <QueryBoundary fallback={<ContactsSkeleton />}>
            <ContactsList />
         </QueryBoundary>
      </main>
   );
}
