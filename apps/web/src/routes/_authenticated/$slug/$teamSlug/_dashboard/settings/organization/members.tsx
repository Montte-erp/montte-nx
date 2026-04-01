import { Button } from "@packages/ui/components/button";
import { DataTable, type DataTableStoredState } from "@packages/ui/components/data-table";
import { createErrorFallback } from "@packages/ui/components/error-fallback";
import { Input } from "@packages/ui/components/input";
import { useSuspenseQuery } from "@tanstack/react-query";
import { InviteMemberForm } from "./-members/invite-member-form";
import { MembersSkeleton } from "./-members/members-skeleton";
import { PendingInvitesSection } from "./-members/pending-invites-section";
import {
   buildMembersColumns,
   type MemberRow,
} from "./-members/members-columns";
import { createFileRoute } from "@tanstack/react-router";
import { createLocalStorageState } from "foxact/create-local-storage-state";
import type { OnChangeFn, SortingState, ColumnFiltersState } from "@tanstack/react-table";
import { ShieldCheck, Search, UserPlus } from "lucide-react";
import { Suspense, useMemo, useState, useTransition } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { toast } from "sonner";
import { z } from "zod";
import { useDialogStack } from "@/hooks/use-dialog-stack";
import { authClient } from "@/integrations/better-auth/auth-client";
import { orpc } from "@/integrations/orpc/client";

const searchSchema = z.object({
   sorting: z
      .array(z.object({ id: z.string(), desc: z.boolean() }))
      .optional()
      .default([]),
   columnFilters: z
      .array(z.object({ id: z.string(), value: z.unknown() }))
      .optional()
      .default([]),
});

const [useMembersTableState] = createLocalStorageState<DataTableStoredState | null>(
   "montte:datatable:members",
   null,
);

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/settings/organization/members",
)({
   validateSearch: searchSchema,
   component: MembersPage,
});

function MembersContent() {
   const navigate = Route.useNavigate();
   const { sorting, columnFilters } = Route.useSearch();
   const [tableState, setTableState] = useMembersTableState();

   const { openDialogStack, closeDialogStack } = useDialogStack();
   const [searchFilter, setSearchFilter] = useState("");
   const [isPending, startTransition] = useTransition();

   const { data: members } = useSuspenseQuery(
      orpc.organization.getMembers.queryOptions({}),
   );

   const { data: activeOrg } = useSuspenseQuery(
      orpc.organization.getActiveOrganization.queryOptions({}),
   );

   const { data: sessionData } = useSuspenseQuery(
      orpc.session.getSession.queryOptions({}),
   );

   const currentUserId = sessionData?.user?.id;
   const organizationId = activeOrg?.id ?? "";

   const filteredMembers = useMemo(() => {
      if (!searchFilter.trim()) return members;
      const query = searchFilter.toLowerCase();
      return members.filter(
         (m) =>
            m.name.toLowerCase().includes(query) ||
            m.email.toLowerCase().includes(query),
      );
   }, [members, searchFilter]);

   const columns = useMemo(
      () => buildMembersColumns(currentUserId),
      [currentUserId],
   );

   const handleSortingChange: OnChangeFn<SortingState> = (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      navigate({ search: (prev: z.infer<typeof searchSchema>) => ({ ...prev, sorting: next }) });
   };

   const handleColumnFiltersChange: OnChangeFn<ColumnFiltersState> = (
      updater,
   ) => {
      const next =
         typeof updater === "function" ? updater(columnFilters) : updater;
      navigate({ search: (prev: z.infer<typeof searchSchema>) => ({ ...prev, columnFilters: next }) });
   };

   function handleUpdateRole(member: MemberRow, newRole: string) {
      startTransition(async () => {
         const result = await authClient.organization.updateMemberRole({
            memberId: member.id,
            role: newRole,
            organizationId,
         });
         if (result.error) {
            toast.error(result.error.message ?? "Erro ao alterar função");
         } else {
            toast.success("Função atualizada com sucesso");
         }
      });
   }

   function handleOpenInviteCredenza() {
      openDialogStack({
         children: (
            <InviteMemberForm
               onSuccess={closeDialogStack}
               organizationId={organizationId}
            />
         ),
      });
   }

   return (
      <div className="flex flex-col gap-4">
         <div className="flex items-center justify-between">
            <div>
               <h1 className="text-2xl font-semibold font-serif">Membros</h1>
               <p className="text-sm text-muted-foreground mt-1">
                  Gerencie os membros da sua organização.
               </p>
            </div>
            <Button onClick={handleOpenInviteCredenza}>
               <UserPlus className="size-4 mr-2" />
               Convidar membro
            </Button>
         </div>

         <PendingInvitesSection organizationId={organizationId} />

         <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
               <div>
                  <h2 className="text-lg font-medium">
                     Membros da organização
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                     {members.length}{" "}
                     {members.length === 1 ? "membro" : "membros"} na
                     organização
                  </p>
               </div>
            </div>

            <div className="relative max-w-sm">
               <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground pointer-events-none" />
               <Input
                  className="pl-8 h-9"
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Pesquisar por nome ou e-mail..."
                  value={searchFilter}
               />
            </div>

            <DataTable
               columns={columns}
               data={filteredMembers}
               getRowId={(row) => row.id}
               sorting={sorting as SortingState}
               onSortingChange={handleSortingChange}
               columnFilters={columnFilters as ColumnFiltersState}
               onColumnFiltersChange={handleColumnFiltersChange}
               tableState={tableState}
               onTableStateChange={setTableState}
               renderActions={({ row }) => {
                  const member = row.original;
                  const isSelf = member.userId === currentUserId;
                  const isOwner = member.role === "owner";
                  const isDisabled = isSelf || isOwner || isPending;
                  const roleLabel =
                     member.role === "admin"
                        ? "Alterar para membro"
                        : "Alterar para administrador";
                  return (
                     <Button
                        disabled={isDisabled}
                        onClick={() =>
                           handleUpdateRole(
                              member,
                              member.role === "admin" ? "member" : "admin",
                           )
                        }
                        tooltip={roleLabel}
                        variant="outline"
                     >
                        <ShieldCheck className="size-4" />
                     </Button>
                  );
               }}
            />
         </section>
      </div>
   );
}

function MembersPage() {
   return (
      <ErrorBoundary
         FallbackComponent={createErrorFallback({
            errorTitle: "Erro ao carregar membros",
         })}
      >
         <Suspense fallback={<MembersSkeleton />}>
            <MembersContent />
         </Suspense>
      </ErrorBoundary>
   );
}
