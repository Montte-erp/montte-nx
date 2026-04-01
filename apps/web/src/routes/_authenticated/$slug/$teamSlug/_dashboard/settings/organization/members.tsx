import {
   Avatar,
   AvatarFallback,
   AvatarImage,
} from "@packages/ui/components/avatar";
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import { DataTable } from "@packages/ui/components/data-table";
import {
   Empty,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import { Input } from "@packages/ui/components/input";
import { Skeleton } from "@packages/ui/components/skeleton";
import { getInitials } from "@core/utils/text";
import {
   useMutation,
   useQueryClient,
   useSuspenseQuery,
} from "@tanstack/react-query";
import { InviteMemberForm } from "./-members/invite-member-form";
import { createFileRoute } from "@tanstack/react-router";
import dayjs from "dayjs";
import type { ColumnDef } from "@tanstack/react-table";
import { Mail, Search, ShieldCheck, UserPlus } from "lucide-react";
import { Suspense, useMemo, useState } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { toast } from "sonner";
import { useDialogStack } from "@/hooks/use-dialog-stack";
import { authClient } from "@/integrations/better-auth/auth-client";
import { orpc } from "@/integrations/orpc/client";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/settings/organization/members",
)({
   component: MembersPage,
});

type MemberRow = {
   id: string;
   userId: string;
   name: string;
   email: string;
   role: string;
   image: string | null;
   createdAt: Date;
};

const ROLE_LABELS: Record<string, string> = {
   owner: "Proprietário",
   admin: "Administrador",
   member: "Membro",
};

function formatDate(date: Date | string): string {
   return dayjs(date).format("DD MMM YYYY");
}

function getRoleBadgeVariant(
   role: string,
): "default" | "secondary" | "outline" {
   if (role === "owner") return "default";
   if (role === "admin") return "secondary";
   return "outline";
}

function MembersSkeleton() {
   return (
      <div className="flex flex-col gap-4">
         <div className="flex items-center justify-between">
            <div>
               <Skeleton className="h-8 w-32" />
               <Skeleton className="h-4 w-64" />
            </div>
            <Skeleton className="h-8 w-24" />
         </div>

         <Skeleton className="h-9 w-full" />

         <div className="flex flex-col gap-2">
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
         </div>
      </div>
   );
}

function MembersErrorFallback({ resetErrorBoundary }: FallbackProps) {
   return (
      <div className="flex flex-col gap-4">
         <div>
            <h1 className="text-2xl font-semibold font-serif">Membros</h1>
            <p className="text-sm text-muted-foreground">
               Gerencie os membros da sua organização.
            </p>
         </div>
         <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm text-muted-foreground">
               Não foi possível carregar os membros da organização
            </p>
            <Button onClick={resetErrorBoundary} variant="outline">
               Tentar novamente
            </Button>
         </div>
      </div>
   );
}

function PendingInvitesSection({ organizationId }: { organizationId: string }) {
   const queryClient = useQueryClient();

   const { data: invitesData } = useSuspenseQuery({
      queryKey: ["pending-invites", organizationId],
      queryFn: async () => {
         const result = await authClient.organization.listInvitations({
            query: { organizationId },
         });
         if (result.error) {
            throw new Error(
               result.error.message ?? "Erro ao carregar convites",
            );
         }
         return result.data;
      },
   });

   const cancelMutation = useMutation({
      mutationFn: async (invitationId: string) => {
         const result = await authClient.organization.cancelInvitation({
            invitationId,
         });
         if (result.error) {
            throw new Error(result.error.message ?? "Erro ao cancelar convite");
         }
         return result.data;
      },
      onSuccess: () => {
         queryClient.invalidateQueries({
            queryKey: ["pending-invites"],
         });
         toast.success("Convite cancelado");
      },
      onError: (error) => {
         toast.error(error.message);
      },
   });

   const invites = invitesData ?? [];

   return (
      <section className="flex flex-col gap-4">
         <div>
            <h2 className="text-lg font-medium">Convites pendentes</h2>
            <p className="text-sm text-muted-foreground">
               Convites enviados que ainda não foram aceitos.
            </p>
         </div>

         {invites.length === 0 ? (
            <Empty>
               <EmptyMedia>
                  <Mail className="size-8 text-muted-foreground" />
               </EmptyMedia>
               <EmptyHeader>
                  <EmptyTitle>Nenhum convite pendente</EmptyTitle>
                  <EmptyDescription>
                     Quando você convidar novos membros, os convites pendentes
                     aparecerão aqui.
                  </EmptyDescription>
               </EmptyHeader>
            </Empty>
         ) : (
            <div className="rounded-md border">
               <div className="divide-y">
                  {invites.map((invite) => (
                     <div
                        className="flex items-center justify-between px-4 py-3"
                        key={invite.id}
                     >
                        <div className="flex items-center gap-3 min-w-0">
                           <Mail className="size-4 text-muted-foreground shrink-0" />
                           <div className="min-w-0">
                              <p className="text-sm font-medium truncate">
                                 {invite.email}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                 {ROLE_LABELS[invite.role] ?? invite.role}{" "}
                                 &middot; Enviado em{" "}
                                 {formatDate(invite.createdAt)}
                              </p>
                           </div>
                        </div>
                        <Button
                           disabled={cancelMutation.isPending}
                           onClick={() => cancelMutation.mutate(invite.id)}
                           variant="ghost"
                        >
                           Cancelar
                        </Button>
                     </div>
                  ))}
               </div>
            </div>
         )}
      </section>
   );
}

function MembersContent() {
   const queryClient = useQueryClient();
   const { openDialogStack, closeDialogStack } = useDialogStack();
   const [searchFilter, setSearchFilter] = useState("");

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

   const updateRoleMutation = useMutation({
      mutationFn: async ({
         memberId,
         role,
      }: {
         memberId: string;
         role: string;
      }) => {
         const result = await authClient.organization.updateMemberRole({
            memberId,
            role,
            organizationId,
         });
         if (result.error) {
            throw new Error(result.error.message ?? "Erro ao alterar função");
         }
         return result.data;
      },
      onSuccess: () => {
         queryClient.invalidateQueries({
            queryKey: orpc.organization.getMembers.queryOptions({}).queryKey,
         });
         toast.success("Função atualizada com sucesso");
      },
      onError: (error) => {
         toast.error(error.message);
      },
   });

   function handleUpdateRole(member: MemberRow, newRole: string) {
      updateRoleMutation.mutate({
         memberId: member.id,
         role: newRole,
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

   const columns: ColumnDef<MemberRow>[] = useMemo(
      () => [
         {
            accessorKey: "name",
            header: "Nome",
            cell: ({ row }) => (
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
                  {row.original.id === currentUserId && (
                     <Badge className="text-[10px] px-1.5" variant="outline">
                        você
                     </Badge>
                  )}
               </div>
            ),
         },
         {
            accessorKey: "email",
            header: "E-mail",
            cell: ({ row }) => (
               <span className="text-muted-foreground">
                  {row.original.email}
               </span>
            ),
         },
         {
            accessorKey: "role",
            header: "Função",
            cell: ({ row }) => (
               <Badge variant={getRoleBadgeVariant(row.original.role)}>
                  {ROLE_LABELS[row.original.role] ?? row.original.role}
               </Badge>
            ),
         },
         {
            accessorKey: "createdAt",
            header: "Desde",
            cell: ({ row }) => (
               <span className="text-muted-foreground text-sm">
                  {formatDate(row.original.createdAt)}
               </span>
            ),
         },
      ],
      [currentUserId],
   );

   return (
      <div className="flex flex-col gap-4">
         <div className="flex items-center justify-between">
            <div>
               <h1 className="text-2xl font-semibold font-serif">Membros</h1>
               <p className="text-sm text-muted-foreground">
                  Gerencie os membros da sua organização.
               </p>
            </div>
            <Button onClick={handleOpenInviteCredenza}>
               <UserPlus className="size-4" />
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
                  <p className="text-sm text-muted-foreground">
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
               renderActions={({ row }) => {
                  const member = row.original;
                  const isSelf = member.userId === currentUserId;
                  const isOwner = member.role === "owner";
                  const isDisabled = isSelf || isOwner;
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
      <ErrorBoundary FallbackComponent={MembersErrorFallback}>
         <Suspense fallback={<MembersSkeleton />}>
            <MembersContent />
         </Suspense>
      </ErrorBoundary>
   );
}
