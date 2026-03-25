import {
   Avatar,
   AvatarFallback,
   AvatarImage,
} from "@packages/ui/components/avatar";
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import { Card, CardContent } from "@packages/ui/components/card";
import {
   DialogStackContent,
   DialogStackDescription,
   DialogStackHeader,
   DialogStackTitle,
} from "@packages/ui/components/dialog-stack";
import { DataTable } from "@packages/ui/components/data-table";
import {
   Empty,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import { Input } from "@packages/ui/components/input";
import { Label } from "@packages/ui/components/label";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
import { Skeleton } from "@packages/ui/components/skeleton";
import { Spinner } from "@packages/ui/components/spinner";
import { getInitials } from "@core/utils/text";
import {
   useMutation,
   useQuery,
   useQueryClient,
   useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import dayjs from "dayjs";
import type { ColumnDef } from "@tanstack/react-table";
import { Mail, Search, ShieldCheck, UserPlus } from "lucide-react";
import { Suspense, useMemo, useState } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { toast } from "sonner";
import { useCredenza } from "@/hooks/use-credenza";
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

type PendingInvite = {
   id: string;
   email: string;
   role: string;
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
               <Skeleton className="h-4 w-64 mt-1" />
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
            <p className="text-sm text-muted-foreground mt-1">
               Gerencie os membros da sua organização.
            </p>
         </div>
         <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm text-muted-foreground mb-4">
               Não foi possível carregar os membros da organização
            </p>
            <Button onClick={resetErrorBoundary} variant="outline">
               Tentar novamente
            </Button>
         </div>
      </div>
   );
}

function InviteMemberCredenzaContent({
   organizationId,
   onSuccess,
}: {
   organizationId: string;
   onSuccess: () => void;
}) {
   const [email, setEmail] = useState("");
   const [role, setRole] = useState<"member" | "admin">("member");
   const queryClient = useQueryClient();

   const inviteMutation = useMutation({
      mutationFn: async () => {
         const result = await authClient.organization.inviteMember({
            email,
            role,
            organizationId,
         });
         if (result.error) {
            throw new Error(result.error.message ?? "Erro ao enviar convite");
         }
         return result.data;
      },
      onSuccess: () => {
         queryClient.invalidateQueries({
            queryKey: ["pending-invites"],
         });
         toast.success("Convite enviado com sucesso");
         onSuccess();
      },
      onError: (error) => {
         toast.error(error.message);
      },
   });

   const isValid = email.trim().length > 0 && email.includes("@");

   return (
      <DialogStackContent index={0}>
         <DialogStackHeader>
            <DialogStackTitle>Convidar novo membro</DialogStackTitle>
            <DialogStackDescription>
               Adicione um novo membro à organização enviando um convite por
               e-mail.
            </DialogStackDescription>
         </DialogStackHeader>

         <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="flex flex-col gap-4">
               <div className="flex gap-2 items-end">
                  <div className="flex-1 flex flex-col gap-2">
                     <Label htmlFor="invite-email">E-mail</Label>
                     <Input
                        autoComplete="email"
                        id="invite-email"
                        onChange={(e) => setEmail(e.target.value)}
                        onKeyDown={(e) => {
                           if (
                              e.key === "Enter" &&
                              isValid &&
                              !inviteMutation.isPending
                           ) {
                              inviteMutation.mutate();
                           }
                        }}
                        placeholder="usuario@empresa.com"
                        type="email"
                        value={email}
                     />
                  </div>
                  <div className="w-36 flex flex-col gap-2 shrink-0">
                     <Label htmlFor="invite-role">Função</Label>
                     <Select
                        onValueChange={(v) => setRole(v as "member" | "admin")}
                        value={role}
                     >
                        <SelectTrigger className="w-full" id="invite-role">
                           <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                           <SelectItem value="member">Membro</SelectItem>
                           <SelectItem value="admin">Administrador</SelectItem>
                        </SelectContent>
                     </Select>
                  </div>
               </div>

               <Card className="bg-muted border-0">
                  <CardContent className="pt-4 pb-4">
                     <div className="flex gap-3">
                        <div className="mt-0.5">
                           <Mail className="size-4 text-muted-foreground" />
                        </div>
                        <div className="flex flex-col gap-2">
                           <p className="text-sm font-medium">
                              Como funciona o convite
                           </p>
                           <p className="text-xs text-muted-foreground">
                              Um e-mail será enviado com um link de convite. O
                              destinatário poderá criar uma conta ou fazer login
                              para aceitar o convite.
                           </p>
                        </div>
                     </div>
                  </CardContent>
               </Card>
            </div>
         </div>

         <div className="border-t px-4 py-4">
            <Button
               className="w-full"
               disabled={!isValid || inviteMutation.isPending}
               onClick={() => inviteMutation.mutate()}
            >
               {inviteMutation.isPending ? (
                  <Spinner className="size-4 mr-2" />
               ) : (
                  <Mail className="size-4 mr-2" />
               )}
               Enviar convite
            </Button>
         </div>
      </DialogStackContent>
   );
}

function PendingInvitesSection({ organizationId }: { organizationId: string }) {
   const queryClient = useQueryClient();

   const { data: invitesData, isLoading } = useQuery({
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
         return result.data as PendingInvite[] | null;
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

   if (isLoading) {
      return (
         <section className="flex flex-col gap-4">
            <div>
               <h2 className="text-lg font-medium">Convites pendentes</h2>
               <p className="text-sm text-muted-foreground mt-1">
                  Convites enviados que ainda não foram aceitos.
               </p>
            </div>
            <Skeleton className="h-20 w-full rounded-lg" />
         </section>
      );
   }

   return (
      <section className="flex flex-col gap-4">
         <div>
            <h2 className="text-lg font-medium">Convites pendentes</h2>
            <p className="text-sm text-muted-foreground mt-1">
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
   const { openCredenza, closeCredenza } = useCredenza();
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
      openCredenza({
         children: (
            <InviteMemberCredenzaContent
               onSuccess={closeCredenza}
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
