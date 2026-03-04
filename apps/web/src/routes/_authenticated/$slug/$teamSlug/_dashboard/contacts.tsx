import { Button } from "@packages/ui/components/button";
import { DataTable } from "@packages/ui/components/data-table";
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
import {
   LayoutGrid,
   LayoutList,
   Pencil,
   Plus,
   Trash2,
   Users,
} from "lucide-react";

import { Suspense, useCallback, useState } from "react";
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
import {
   useViewSwitch,
   type ViewConfig,
} from "@/features/view-switch/hooks/use-view-switch";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useCredenza } from "@/hooks/use-credenza";
import { orpc } from "@/integrations/orpc/client";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/contacts",
)({
   loader: ({ context }) => {
      context.queryClient.prefetchQuery(orpc.contacts.getAll.queryOptions({}));
   },
   component: ContactsPage,
});

const CONTACT_VIEWS: [
   ViewConfig<"table" | "card">,
   ViewConfig<"table" | "card">,
] = [
   { id: "table", label: "Tabela", icon: <LayoutList className="size-4" /> },
   { id: "card", label: "Cards", icon: <LayoutGrid className="size-4" /> },
];

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

// =============================================================================
// Skeleton
// =============================================================================

function ContactsSkeleton() {
   return (
      <div className="space-y-3">
         {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton className="h-12 w-full" key={`skeleton-${index + 1}`} />
         ))}
      </div>
   );
}

// =============================================================================
// Type filter
// =============================================================================

type TypeFilter = "all" | "cliente" | "fornecedor" | "ambos";

const TYPE_FILTER_LABELS: Record<TypeFilter, string> = {
   all: "Todos",
   cliente: "Clientes",
   fornecedor: "Fornecedores",
   ambos: "Ambos",
};

// =============================================================================
// List
// =============================================================================

interface ContactsListProps {
   view: "table" | "card";
   typeFilter: TypeFilter;
}

function ContactsList({ view, typeFilter }: ContactsListProps) {
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

   if (view === "card") {
      return (
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {contacts.map((contact) => (
               <div
                  className="rounded-lg border bg-background p-4 space-y-2"
                  key={contact.id}
               >
                  <div className="flex items-start justify-between gap-2">
                     <div className="min-w-0">
                        <p className="font-medium truncate">{contact.name}</p>
                        {contact.email && (
                           <p className="text-sm text-muted-foreground truncate">
                              {contact.email}
                           </p>
                        )}
                        {contact.document && (
                           <p className="text-xs text-muted-foreground">
                              {contact.documentType?.toUpperCase()}{" "}
                              {contact.document}
                           </p>
                        )}
                     </div>
                  </div>
                  <div className="flex items-center gap-2">
                     <Button
                        onClick={() => handleEdit(contact as ContactRow)}
                        variant="outline"
                     >
                        Editar
                     </Button>
                     <Button
                        className="text-destructive"
                        onClick={() => handleDelete(contact as ContactRow)}
                        variant="ghost"
                     >
                        Excluir
                     </Button>
                  </div>
               </div>
            ))}
         </div>
      );
   }

   const columns = buildContactColumns();

   return (
      <>
         <DataTable
            columns={columns}
            data={contacts as ContactRow[]}
            enableRowSelection
            getRowId={(row) => row.id}
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
            renderMobileCard={({ row }) => (
               <div className="rounded-lg border bg-background p-4 space-y-2">
                  <p className="font-medium">{row.original.name}</p>
                  {row.original.email && (
                     <p className="text-sm text-muted-foreground">
                        {row.original.email}
                     </p>
                  )}
                  <div className="flex items-center gap-2">
                     <Button
                        onClick={() => handleEdit(row.original)}
                        variant="outline"
                     >
                        Editar
                     </Button>
                     <Button
                        className="text-destructive"
                        onClick={() => handleDelete(row.original)}
                        variant="ghost"
                     >
                        Excluir
                     </Button>
                  </div>
               </div>
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

// =============================================================================
// Page
// =============================================================================

function ContactsPage() {
   const { openCredenza, closeCredenza } = useCredenza();
   const { currentView, setView, views } = useViewSwitch(
      "finance:contacts:view",
      CONTACT_VIEWS,
   );
   const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

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
                  <Plus className="size-4 mr-1" />
                  Novo Contato
               </Button>
            }
            description="Gerencie clientes e fornecedores"
            title="Contatos"
            viewSwitch={{ options: views, currentView, onViewChange: setView }}
         />
         <EarlyAccessBanner template={CONTACTS_BANNER} />

         {/* Type filter tabs */}
         <div className="flex gap-2 flex-wrap">
            {(Object.keys(TYPE_FILTER_LABELS) as TypeFilter[]).map((key) => (
               <Button
                  key={key}
                  onClick={() => setTypeFilter(key)}
                  variant={typeFilter === key ? "default" : "outline"}
               >
                  {TYPE_FILTER_LABELS[key]}
               </Button>
            ))}
         </div>

         <Suspense fallback={<ContactsSkeleton />}>
            <ContactsList typeFilter={typeFilter} view={currentView} />
         </Suspense>
      </main>
   );
}
