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
import type {
   ColumnDef,
   OnChangeFn,
   SortingState,
   ColumnFiltersState,
} from "@tanstack/react-table";
import dayjs from "dayjs";
import { Mail, Plus, ShieldCheck, Users, X } from "lucide-react";
import { useCallback, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { authClient } from "@/integrations/better-auth/auth-client";
import { orpc } from "@/integrations/orpc/client";
import type { Outputs } from "@/integrations/orpc/client";
import { QueryBoundary } from "@/components/query-boundary";
import { DefaultHeader } from "@/components/default-header";
import { DataTableContent } from "@/components/data-table/data-table-content";
import { DataTableEmptyState } from "@/components/data-table/data-table-empty-state";
import { DataTableRoot } from "@/components/data-table/data-table-root";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { MembersSkeleton } from "./-members/members-skeleton";

const ROLE_LABELS: Record<string, string> = {
   owner: "Proprietário",
   admin: "Administrador",
   member: "Membro",
};

const ROLE_OPTIONS = [
   { label: "Membro", value: "member" },
   { label: "Administrador", value: "admin" },
];

const emailSchema = z.email("E-mail inválido");

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
   role: string;
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

function toInviteRow(i: Invite): InviteRow {
   return {
      kind: "invite",
      id: i.id,
      userId: null,
      name: i.email,
      email: i.email,
      role: i.role,
      image: null,
      createdAt: i.createdAt,
   };
}

function buildColumns(currentUserId: string | undefined): ColumnDef<Row>[] {
   return [
      {
         accessorKey: "name",
         header: "Nome",
         meta: {
            label: "Nome",
            isEditable: false,
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
         meta: {
            label: "E-mail",
            isEditable: true,
            cellComponent: "text",
            editSchema: emailSchema,
            isEditableForRow: () => false,
         },
         cell: ({ row }) => (
            <span className="text-muted-foreground">{row.original.email}</span>
         ),
      },
      {
         accessorKey: "role",
         header: "Função",
         meta: {
            label: "Função",
            isEditable: true,
            cellComponent: "select",
            editOptions: ROLE_OPTIONS,
            isEditableForRow: () => false,
         },
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
   const [isDraftActive, setIsDraftActive] = useState(false);
   const [isPending, startTransition] = useTransition();

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

   const data = useMemo<Row[]>(
      () => [...members.map(toMemberRow), ...invites.map(toInviteRow)],
      [members, invites],
   );

   const filteredData = useMemo(() => {
      const searchValue = columnFilters.find((f) => f.id === "name")?.value;
      const query =
         typeof searchValue === "string" ? searchValue.toLowerCase() : "";
      if (!query) return data;
      return data.filter(
         (r) =>
            r.name.toLowerCase().includes(query) ||
            r.email.toLowerCase().includes(query),
      );
   }, [data, columnFilters]);

   const columns = useMemo(() => buildColumns(currentUserId), [currentUserId]);

   const handleSortingChange: OnChangeFn<SortingState> = (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      navigate({
         search: (prev: z.infer<typeof searchSchema>) => ({
            ...prev,
            sorting: next,
         }),
         replace: true,
      });
   };

   const handleColumnFiltersChange: OnChangeFn<ColumnFiltersState> = (
      updater,
   ) => {
      const next =
         typeof updater === "function" ? updater(columnFilters) : updater;
      navigate({
         search: (prev: z.infer<typeof searchSchema>) => ({
            ...prev,
            columnFilters: next,
         }),
         replace: true,
      });
   };

   const handleSearch = (value: string) => {
      const next = value
         ? [
              ...columnFilters.filter((f) => f.id !== "name"),
              { id: "name", value },
           ]
         : columnFilters.filter((f) => f.id !== "name");
      navigate({
         search: (prev: z.infer<typeof searchSchema>) => ({
            ...prev,
            columnFilters: next,
         }),
         replace: true,
      });
   };

   const invalidateInvites = useCallback(() => {
      queryClient.invalidateQueries({
         queryKey: orpc.organization.getPendingInvitations.queryOptions({})
            .queryKey,
      });
   }, [queryClient]);

   function handleUpdateRole(member: MemberRow, newRole: string) {
      startTransition(async () => {
         const result = await authClient.organization.updateMemberRole({
            memberId: member.id,
            role: newRole,
            organizationId,
         });
         if (result.error) {
            toast.error(result.error.message ?? "Erro ao alterar função");
            return;
         }
         queryClient.invalidateQueries({
            queryKey: orpc.organization.getMembers.queryOptions({}).queryKey,
         });
         toast.success("Função atualizada com sucesso");
      });
   }

   const handleCancelInvite = useCallback(
      (invite: InviteRow) => {
         openAlertDialog({
            title: "Cancelar convite",
            description: `Cancelar o convite enviado para "${invite.email}"?`,
            actionLabel: "Cancelar convite",
            cancelLabel: "Voltar",
            variant: "destructive",
            onAction: async () => {
               const { error } = await authClient.organization.cancelInvitation(
                  { invitationId: invite.id },
               );
               if (error) {
                  toast.error(error.message);
                  return;
               }
               invalidateInvites();
               toast.success("Convite cancelado");
            },
         });
      },
      [openAlertDialog, invalidateInvites],
   );

   const handleAddInvite = useCallback(
      async (formData: Record<string, string | string[]>) => {
         const email = String(formData.email ?? "").trim();
         const roleValue = String(formData.role ?? "member");
         const role: "member" | "admin" =
            roleValue === "admin" ? "admin" : "member";

         openAlertDialog({
            title: "Enviar convite",
            description: `Um e-mail será enviado para ${email} com um link para entrar na organização como ${ROLE_LABELS[role]}.`,
            actionLabel: "Enviar",
            cancelLabel: "Voltar",
            onAction: async () => {
               const { error } = await authClient.organization.inviteMember({
                  email,
                  role,
                  organizationId,
               });
               if (error) {
                  toast.error(error.message);
                  return;
               }
               setIsDraftActive(false);
               invalidateInvites();
               toast.success("Convite enviado com sucesso!");
            },
         });
      },
      [openAlertDialog, organizationId, invalidateInvites],
   );

   const searchValue = columnFilters.find((f) => f.id === "name")?.value;
   const searchDefaultValue =
      typeof searchValue === "string" ? searchValue : "";

   return (
      <div className="flex flex-col gap-4">
         <DefaultHeader
            description="Gerencie os membros da sua organização."
            title="Membros"
         />

         <DataTableRoot
            columnFilters={columnFilters}
            columns={columns}
            data={filteredData}
            draftRowDefaults={{ role: "member" }}
            getRowId={(row) => `${row.kind}:${row.id}`}
            groupBy={(row) =>
               row.kind === "member" ? "Membros" : "Convites pendentes"
            }
            isDraftRowActive={isDraftActive}
            onColumnFiltersChange={handleColumnFiltersChange}
            onSortingChange={handleSortingChange}
            sorting={sorting}
            onAddRow={handleAddInvite}
            onDiscardAddRow={() => setIsDraftActive(false)}
            renderGroupHeader={(key, rows) => (
               <span className="flex items-center gap-2">
                  {key}
                  <Badge variant="outline">{rows.length}</Badge>
               </span>
            )}
            renderActions={({ row }) => {
               const original = row.original;
               if (original.kind === "invite") {
                  return (
                     <Button
                        onClick={() => handleCancelInvite(original)}
                        tooltip="Cancelar convite"
                        variant="outline"
                     >
                        <X className="size-4" />
                     </Button>
                  );
               }
               const member = original;
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
            storageKey="montte:datatable:members"
         >
            <DataTableToolbar
               onSearch={handleSearch}
               searchDefaultValue={searchDefaultValue}
               searchPlaceholder="Pesquisar por nome ou e-mail..."
            >
               <Button
                  disabled={isDraftActive}
                  onClick={() => setIsDraftActive(true)}
                  size="icon-sm"
                  tooltip="Convidar membro"
                  variant="outline"
               >
                  <Plus />
                  <span className="sr-only">Convidar membro</span>
               </Button>
            </DataTableToolbar>
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
            <DataTableContent />
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
