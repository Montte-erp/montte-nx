import {
   Avatar,
   AvatarFallback,
   AvatarImage,
} from "@packages/ui/components/avatar";
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import {
   Empty,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import { getInitials } from "@core/utils/text";
import { useSuspenseQueries, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
   getCoreRowModel,
   getFilteredRowModel,
   getSortedRowModel,
   useReactTable,
   type ColumnDef,
   type ColumnFiltersState,
   type SortingState,
} from "@tanstack/react-table";
import dayjs from "dayjs";
import { Mail, Plus, RotateCw, ShieldCheck, Users, X } from "lucide-react";
import { startTransition, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { authClient } from "@/integrations/better-auth/auth-client";
import { orpc } from "@/integrations/orpc/client";
import type { Outputs } from "@/integrations/orpc/client";
import { QueryBoundary } from "@/components/query-boundary";
import { DefaultHeader } from "../../../-layout/default-header";
import { DataTableBody } from "@/components/data-table-v2/data-table-body";
import { DataTableContainer } from "@/components/data-table-v2/data-table-container";
import { DataTableEmptyState } from "@/components/data-table-v2/data-table-empty-state";
import { DataTableHeader } from "@/components/data-table-v2/data-table-header";
import { DataTableRoot } from "@/components/data-table-v2/data-table-root";
import { DataTableSearch } from "@/components/data-table-v2/data-table-search";
import {
   DataTableToolbar,
   DataTableToolbarGroup,
} from "@/components/data-table-v2/data-table-toolbar";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useCredenza } from "@/hooks/use-credenza";
import { InviteMembersForm } from "./-members/invite-members-form";
import { MembersSkeleton } from "./-members/members-skeleton";

const ROLE_LABELS: Record<string, string> = {
   owner: "Proprietário",
   admin: "Administrador",
   member: "Membro",
};

const searchSchema = z.object({
   sorting: z
      .array(z.object({ id: z.string(), desc: z.boolean() }))
      .catch([])
      .default([]),
   columnFilters: z
      .array(z.object({ id: z.string(), value: z.unknown() }))
      .catch([])
      .default([]),
});

type Member = Outputs["organization"]["getMembers"][number];
type Invite = Outputs["organization"]["getPendingInvitations"][number];
type OrganizationRole = "owner" | "admin" | "member";

type MemberRow = {
   kind: "member";
   id: string;
   userId: string;
   name: string;
   email: string;
   role: string;
   image: string | null;
   createdAt: Date;
};

type InviteRow = {
   kind: "invite";
   id: string;
   userId: null;
   name: string;
   email: string;
   role: OrganizationRole;
   teamId: string | null;
   image: null;
   createdAt: Date;
};

type Row = MemberRow | InviteRow;

function getRoleBadgeVariant(
   role: string,
): "default" | "secondary" | "outline" {
   if (role === "owner") return "default";
   if (role === "admin") return "secondary";
   return "outline";
}

function toMemberRow(m: Member): MemberRow {
   return {
      kind: "member",
      id: m.id,
      userId: m.userId,
      name: m.name,
      email: m.email,
      role: m.role,
      image: m.image,
      createdAt: m.createdAt,
   };
}

function toOrganizationRole(role: string) {
   if (role === "owner") return "owner";
   if (role === "admin") return "admin";
   return "member";
}

function toInviteRow(i: Invite): InviteRow {
   return {
      kind: "invite",
      id: i.id,
      userId: null,
      name: i.email,
      email: i.email,
      role: toOrganizationRole(i.role),
      teamId: i.teamId,
      image: null,
      createdAt: i.createdAt,
   };
}

function buildColumns(currentUserId: string | undefined): ColumnDef<Row>[] {
   return [
      {
         accessorKey: "name",
         header: "Nome",
         meta: { label: "Nome" },
         filterFn: (row, _id, value) => {
            const query = String(value ?? "").toLowerCase();
            if (!query) return true;
            return (
               row.original.name.toLowerCase().includes(query) ||
               row.original.email.toLowerCase().includes(query)
            );
         },
         cell: ({ row }) => {
            if (row.original.kind === "invite") {
               return (
                  <div className="flex items-center gap-2">
                     <Mail className="size-4 text-muted-foreground shrink-0" />
                     <span className="truncate text-sm text-muted-foreground italic">
                        Convite enviado
                     </span>
                  </div>
               );
            }
            return (
               <div className="flex items-center gap-2">
                  <Avatar className="size-7">
                     <AvatarImage
                        alt={row.original.name}
                        src={row.original.image || undefined}
                     />
                     <AvatarFallback className="text-xs">
                        {getInitials(row.original.name)}
                     </AvatarFallback>
                  </Avatar>
                  <span className="truncate font-medium">
                     {row.original.name}
                  </span>
                  {row.original.userId === currentUserId && (
                     <Badge variant="outline">você</Badge>
                  )}
               </div>
            );
         },
      },
      {
         accessorKey: "email",
         header: "E-mail",
         meta: { label: "E-mail" },
         cell: ({ row }) => (
            <span className="text-muted-foreground">{row.original.email}</span>
         ),
      },
      {
         accessorKey: "role",
         header: "Função",
         meta: { label: "Função" },
         cell: ({ row }) => (
            <Badge variant={getRoleBadgeVariant(row.original.role)}>
               {ROLE_LABELS[row.original.role] ?? row.original.role}
            </Badge>
         ),
      },
      {
         accessorKey: "createdAt",
         header: "Desde",
         meta: { label: "Desde" },
         cell: ({ row }) => (
            <span className="text-muted-foreground text-sm">
               {dayjs(row.original.createdAt).format("DD/MM/YYYY")}
            </span>
         ),
      },
   ];
}

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/settings/organization/members",
)({
   validateSearch: searchSchema,
   head: () => ({
      meta: [{ title: "Membros — Montte" }],
   }),
   component: MembersPage,
});

function MembersContent() {
   const navigate = Route.useNavigate();
   const { sorting, columnFilters } = Route.useSearch();

   const queryClient = useQueryClient();
   const { openAlertDialog } = useAlertDialog();
   const { openCredenza, closeCredenza } = useCredenza();

   const [
      { data: members },
      { data: invites },
      { data: activeOrg },
      { data: sessionData },
   ] = useSuspenseQueries({
      queries: [
         orpc.organization.getMembers.queryOptions({}),
         orpc.organization.getPendingInvitations.queryOptions({}),
         orpc.organization.getActiveOrganization.queryOptions({}),
         orpc.session.getSession.queryOptions({}),
      ],
   });

   const currentUserId = sessionData?.user?.id;
   const organizationId = activeOrg?.id ?? "";
   const teamId = sessionData?.session.activeTeamId ?? null;

   const data = useMemo<Row[]>(
      () => [...members.map(toMemberRow), ...invites.map(toInviteRow)],
      [members, invites],
   );

   const invalidateInvites = useCallback(() => {
      queryClient.invalidateQueries({
         queryKey: orpc.organization.getPendingInvitations.queryOptions({})
            .queryKey,
      });
   }, [queryClient]);

   const handleUpdateRole = useCallback(
      (member: MemberRow, newRole: string) => {
         authClient.organization.updateMemberRole({
            memberId: member.id,
            role: newRole,
            organizationId,
            fetchOptions: {
               onSuccess: () => {
                  queryClient.invalidateQueries({
                     queryKey: orpc.organization.getMembers.queryOptions({})
                        .queryKey,
                  });
                  toast.success("Função atualizada com sucesso");
               },
               onError: ({ error }) => {
                  toast.error(error.message ?? "Erro ao alterar função");
               },
            },
         });
      },
      [organizationId, queryClient],
   );

   const handleCancelInvite = useCallback(
      (invite: InviteRow) => {
         openAlertDialog({
            title: "Cancelar convite",
            description: `Cancelar o convite enviado para "${invite.email}"?`,
            actionLabel: "Cancelar convite",
            cancelLabel: "Voltar",
            variant: "destructive",
            onAction: () => {
               authClient.organization.cancelInvitation({
                  invitationId: invite.id,
                  fetchOptions: {
                     onSuccess: () => {
                        invalidateInvites();
                        toast.success("Convite cancelado");
                     },
                     onError: ({ error }) => {
                        toast.error(error.message);
                     },
                  },
               });
            },
         });
      },
      [openAlertDialog, invalidateInvites],
   );

   const handleResendInvite = useCallback(
      (invite: InviteRow) => {
         authClient.organization.inviteMember({
            email: invite.email,
            role: invite.role,
            organizationId,
            resend: true,
            ...(invite.teamId ? { teamId: invite.teamId } : {}),
            fetchOptions: {
               onSuccess: () => {
                  invalidateInvites();
                  toast.success("Convite reenviado");
               },
               onError: ({ error }) => {
                  toast.error(error.message);
               },
            },
         });
      },
      [organizationId, invalidateInvites],
   );

   const handleOpenInvite = useCallback(() => {
      if (!organizationId) return;
      openCredenza({
         className: "sm:max-w-lg w-full gap-2",
         renderChildren: () => (
            <InviteMembersForm
               organizationId={organizationId}
               teamId={teamId}
               onSuccess={() => {
                  invalidateInvites();
                  closeCredenza();
               }}
            />
         ),
      });
   }, [openCredenza, closeCredenza, organizationId, teamId, invalidateInvites]);

   const columns = useMemo<ColumnDef<Row>[]>(() => {
      const base = buildColumns(currentUserId);
      const actionsColumn: ColumnDef<Row> = {
         id: "__actions",
         size: 100,
         enableSorting: false,
         enableHiding: false,
         meta: { align: "right" },
         cell: ({ row }) => {
            const original = row.original;
            if (original.kind === "invite") {
               return (
                  <div className="flex justify-end gap-2">
                     <Button
                        disabled={!organizationId}
                        onClick={() => handleResendInvite(original)}
                        size="icon-sm"
                        tooltip="Reenviar convite"
                        variant="outline"
                     >
                        <RotateCw />
                     </Button>
                     <Button
                        onClick={() => handleCancelInvite(original)}
                        size="icon-sm"
                        tooltip="Cancelar convite"
                        variant="outline"
                     >
                        <X />
                     </Button>
                  </div>
               );
            }
            const member = original;
            const isSelf = member.userId === currentUserId;
            const isOwner = member.role === "owner";
            const isDisabled = isSelf || isOwner;
            const roleLabel =
               member.role === "admin"
                  ? "Alterar para membro"
                  : "Alterar para administrador";
            return (
               <div className="flex justify-end gap-2">
                  <Button
                     disabled={isDisabled}
                     onClick={() =>
                        handleUpdateRole(
                           member,
                           member.role === "admin" ? "member" : "admin",
                        )
                     }
                     size="icon-sm"
                     tooltip={roleLabel}
                     variant="outline"
                  >
                     <ShieldCheck />
                  </Button>
               </div>
            );
         },
      };
      return [...base, actionsColumn];
   }, [
      currentUserId,
      organizationId,
      handleResendInvite,
      handleCancelInvite,
      handleUpdateRole,
   ]);

   const handleSortingChange = useCallback(
      (updater: SortingState | ((prev: SortingState) => SortingState)) => {
         const next =
            typeof updater === "function" ? updater(sorting) : updater;
         startTransition(() => {
            navigate({
               search: (prev) => ({ ...prev, sorting: next }),
               replace: true,
            });
         });
      },
      [navigate, sorting],
   );

   const handleColumnFiltersChange = useCallback(
      (
         updater:
            | ColumnFiltersState
            | ((prev: ColumnFiltersState) => ColumnFiltersState),
      ) => {
         const next =
            typeof updater === "function" ? updater(columnFilters) : updater;
         startTransition(() => {
            navigate({
               search: (prev) => ({ ...prev, columnFilters: next }),
               replace: true,
            });
         });
      },
      [navigate, columnFilters],
   );

   const searchValue = columnFilters.find((f) => f.id === "name")?.value;
   const searchString = typeof searchValue === "string" ? searchValue : "";

   const handleSearch = useCallback(
      (value: string) => {
         const next = value
            ? [
                 ...columnFilters.filter((f) => f.id !== "name"),
                 { id: "name", value },
              ]
            : columnFilters.filter((f) => f.id !== "name");
         startTransition(() => {
            navigate({
               search: (prev) => ({ ...prev, columnFilters: next }),
               replace: true,
            });
         });
      },
      [navigate, columnFilters],
   );

   const table = useReactTable({
      data,
      columns,
      getRowId: (row) => `${row.kind}:${row.id}`,
      state: { sorting, columnFilters },
      onSortingChange: handleSortingChange,
      onColumnFiltersChange: handleColumnFiltersChange,
      getCoreRowModel: getCoreRowModel(),
      getSortedRowModel: getSortedRowModel(),
      getFilteredRowModel: getFilteredRowModel(),
   });

   return (
      <div className="flex flex-col gap-4">
         <DefaultHeader
            description="Gerencie os membros da sua organização."
            title="Membros"
         />

         <DataTableRoot table={table}>
            <DataTableToolbar>
               <DataTableSearch
                  onChange={handleSearch}
                  placeholder="Pesquisar por nome ou e-mail..."
                  value={searchString}
               />
               <DataTableToolbarGroup>
                  <Button
                     disabled={!organizationId}
                     onClick={handleOpenInvite}
                     size="icon-sm"
                     tooltip="Convidar membro"
                     variant="outline"
                  >
                     <Plus />
                     <span className="sr-only">Convidar membro</span>
                  </Button>
               </DataTableToolbarGroup>
            </DataTableToolbar>
            <DataTableContainer>
               <DataTableHeader />
               <DataTableBody<Row> />
            </DataTableContainer>
            <DataTableEmptyState>
               <Empty>
                  <EmptyHeader>
                     <EmptyMedia variant="icon">
                        <Users className="size-6" />
                     </EmptyMedia>
                     <EmptyTitle>Nenhum membro encontrado</EmptyTitle>
                     <EmptyDescription>
                        Convide membros para começar a colaborar.
                     </EmptyDescription>
                  </EmptyHeader>
               </Empty>
            </DataTableEmptyState>
         </DataTableRoot>
      </div>
   );
}

function MembersPage() {
   return (
      <QueryBoundary
         fallback={<MembersSkeleton />}
         errorTitle="Erro ao carregar membros"
      >
         <MembersContent />
      </QueryBoundary>
   );
}
