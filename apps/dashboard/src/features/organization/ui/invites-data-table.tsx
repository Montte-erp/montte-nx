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
import { Mail, RefreshCw, Search, Trash2 } from "lucide-react";
import { Fragment, useState } from "react";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { InvitesExpandedContent } from "./invites-expanded-content";
import { InvitesFilterBar } from "./invites-filter-bar";
import { InvitesMobileCard } from "./invites-mobile-card";
import { createInviteColumns, type Invite } from "./invites-table-columns";

type InvitesDataTableProps = {
   invites: Invite[];
   filters: {
      searchTerm: string;
      onSearchChange: (value: string) => void;
      statusFilter: string;
      onStatusFilterChange: (value: string) => void;
      roleFilter: string;
      onRoleFilterChange: (value: string) => void;
      hasActiveFilters: boolean;
      onClearFilters: () => void;
   };
   pagination?: {
      currentPage: number;
      totalPages: number;
      totalCount: number;
      pageSize: number;
      onPageChange: (page: number) => void;
   };
   onResend?: (invite: Invite) => void;
   onRevoke?: (inviteId: string) => void;
   onBulkResend?: (inviteIds: string[]) => void;
   onBulkRevoke?: (inviteIds: string[]) => void;
};

export function InvitesDataTableSkeleton() {
   return (
      <Card>
         <CardContent className="pt-6 grid gap-4">
            <div className="flex flex-col sm:flex-row gap-3">
               <Skeleton className="h-9 flex-1 sm:max-w-md" />
            </div>
            <ItemGroup>
               {Array.from({ length: 5 }).map((_, index) => (
                  <Fragment key={`invite-skeleton-${index + 1}`}>
                     <div className="flex items-center p-4 gap-4">
                        <div className="space-y-2 flex-1">
                           <Skeleton className="h-4 w-48" />
                           <Skeleton className="h-3 w-24" />
                        </div>
                        <Skeleton className="h-6 w-16" />
                        <Skeleton className="h-6 w-16" />
                     </div>
                     {index !== 4 && <ItemSeparator />}
                  </Fragment>
               ))}
            </ItemGroup>
         </CardContent>
      </Card>
   );
}

export function InvitesDataTable({
   invites,
   filters,
   pagination,
   onResend,
   onRevoke,
   onBulkResend,
   onBulkRevoke,
}: InvitesDataTableProps) {
   const { openAlertDialog } = useAlertDialog();
   const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

   const hasSearchTerm = filters.searchTerm.length > 0;

   const selectedIds = Object.keys(rowSelection).filter(
      (id) => rowSelection[id],
   );

   const handleClearSelection = () => {
      setRowSelection({});
   };

   const handleRevokeInvite = (invite: Invite) => {
      if (!onRevoke) return;

      openAlertDialog({
         actionLabel: "Revogar",
         cancelLabel: "Cancelar",
         description: `Tem certeza que deseja excluir ${invite.email}?`,
         onAction: () => onRevoke(invite.id),
         title: "Confirmar exclusão",
         variant: "destructive",
      });
   };

   const handleBulkRevoke = () => {
      if (!onBulkRevoke || selectedIds.length === 0) return;

      openAlertDialog({
         actionLabel: "Revogar selecionados",
         cancelLabel: "Cancelar",
         description: `Tem certeza que deseja excluir ${selectedIds.length} itens selecionados?`,
         onAction: () => {
            onBulkRevoke(selectedIds);
            setRowSelection({});
         },
         title: "Confirmar exclusão",
         variant: "destructive",
      });
   };

   // Filter invites based on search, status, and role
   const filteredInvites = invites.filter((invite) => {
      const matchesSearch =
         filters.searchTerm === "" ||
         invite.email.toLowerCase().includes(filters.searchTerm.toLowerCase());

      const matchesStatus =
         filters.statusFilter === "all" ||
         invite.status.toLowerCase() === filters.statusFilter.toLowerCase();

      const matchesRole =
         filters.roleFilter === "all" ||
         invite.role.toLowerCase() === filters.roleFilter.toLowerCase();

      return matchesSearch && matchesStatus && matchesRole;
   });

   if (invites.length === 0 && !hasSearchTerm) {
      return (
         <Card>
            <CardContent className="pt-6">
               <Empty>
                  <EmptyContent>
                     <EmptyMedia variant="icon">
                        <Mail className="size-12 text-muted-foreground" />
                     </EmptyMedia>
                     <EmptyTitle>Nenhum convite encontrado</EmptyTitle>
                     <EmptyDescription>
                        Convide membros para sua organização para começar a
                        colaborar.
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
               <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <InputGroup className="sm:max-w-md">
                     <InputGroupInput
                        onChange={(e) => filters.onSearchChange(e.target.value)}
                        placeholder="Buscar por email..."
                        value={filters.searchTerm}
                     />
                     <InputGroupAddon>
                        <Search />
                     </InputGroupAddon>
                  </InputGroup>

                  <InvitesFilterBar
                     hasActiveFilters={filters.hasActiveFilters}
                     onClearFilters={filters.onClearFilters}
                     onRoleFilterChange={filters.onRoleFilterChange}
                     onStatusFilterChange={filters.onStatusFilterChange}
                     roleFilter={filters.roleFilter}
                     statusFilter={filters.statusFilter}
                  />
               </div>

               {filteredInvites.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                     Nenhum convite encontrado
                  </div>
               ) : (
                  <DataTable
                     columns={createInviteColumns(onResend, handleRevokeInvite)}
                     data={filteredInvites}
                     enableRowSelection
                     getRowId={(row) => row.id}
                     onRowSelectionChange={setRowSelection}
                     pagination={pagination}
                     renderMobileCard={(props) => (
                        <InvitesMobileCard
                           {...props}
                           onResend={onResend}
                           onRevoke={handleRevokeInvite}
                        />
                     )}
                     renderSubComponent={(props) => (
                        <InvitesExpandedContent
                           {...props}
                           onResend={onResend}
                           onRevoke={handleRevokeInvite}
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
         >
            {onBulkResend && (
               <SelectionActionButton
                  icon={<RefreshCw className="size-3.5" />}
                  onClick={() => {
                     onBulkResend(selectedIds);
                     setRowSelection({});
                  }}
               >
                  Reenviar selecionados
               </SelectionActionButton>
            )}
            {onBulkRevoke && (
               <SelectionActionButton
                  icon={<Trash2 className="size-3.5" />}
                  onClick={handleBulkRevoke}
                  variant="destructive"
               >
                  Revogar selecionados
               </SelectionActionButton>
            )}
         </SelectionActionBar>
      </>
   );
}
