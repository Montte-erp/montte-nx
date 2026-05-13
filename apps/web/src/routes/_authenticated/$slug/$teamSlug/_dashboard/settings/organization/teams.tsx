import { ScrollArea } from "@packages/ui/components/scroll-area";
import { Table } from "@packages/ui/components/table";
import {
   Avatar,
   AvatarFallback,
   AvatarImage,
} from "@packages/ui/components/avatar";
import { Button } from "@packages/ui/components/button";
import {
   Empty,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import {
   SheetDescription,
   SheetFooter,
   SheetHeader,
   SheetTitle,
} from "@packages/ui/components/sheet";
import { Separator } from "@packages/ui/components/separator";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
import { Skeleton } from "@packages/ui/components/skeleton";
import { getInitials } from "@core/utils/text";
import { useQueryClient, useSuspenseQueries } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
   getCoreRowModel,
   getSortedRowModel,
   useReactTable,
   type ColumnDef,
} from "@tanstack/react-table";
import dayjs from "dayjs";
import { Box, UserMinus, UserPlus } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { QueryBoundary } from "@/components/query-boundary";
import { useSheet } from "@/hooks/use-sheet";
import { authClient } from "@/integrations/better-auth/auth-client";
import { orpc } from "@/integrations/orpc/client";
import type { Outputs } from "@/integrations/orpc/client";
import { DataTableBody } from "@/blocks/data-table/data-table-body";
import { DataTableHeader } from "@/blocks/data-table/data-table-header";
import { DefaultHeader } from "../../../-layout/default-header";

type Team = Outputs["organization"]["getOrganizationTeams"][number];

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/settings/organization/teams",
)({
   head: () => ({ meta: [{ title: "Espaços — Montte" }] }),
   component: TeamsPage,
});

function TeamsContent() {
   const { openSheet } = useSheet();
   const [{ data: teams }] = useSuspenseQueries({
      queries: [orpc.organization.getOrganizationTeams.queryOptions({})],
   });

   const handleOpen = useCallback(
      (team: Team) => {
         openSheet({
            className: "w-full sm:max-w-md",
            renderChildren: () => (
               <QueryBoundary
                  errorTitle="Erro ao carregar membros do espaço"
                  fallback={<TeamMembersSheetSkeleton />}
               >
                  <TeamMembersSheet team={team} />
               </QueryBoundary>
            ),
         });
      },
      [openSheet],
   );

   const columns = useMemo<ColumnDef<Team>[]>(
      () => [
         {
            accessorKey: "name",
            header: "Nome",
            meta: { label: "Nome" },
            cell: ({ row }) => (
               <span className="font-medium">{row.original.name}</span>
            ),
         },
         {
            accessorKey: "slug",
            header: "Slug",
            meta: { label: "Slug" },
            cell: ({ row }) => (
               <span className="text-muted-foreground text-sm">
                  {row.original.slug}
               </span>
            ),
         },
         {
            accessorKey: "createdAt",
            header: "Criado em",
            meta: { label: "Criado em" },
            cell: ({ row }) => (
               <span className="text-muted-foreground text-sm">
                  {dayjs(row.original.createdAt).format("DD/MM/YYYY")}
               </span>
            ),
         },
         {
            id: "__actions",
            size: 100,
            enableSorting: false,
            meta: { align: "right" },
            cell: ({ row }) => (
               <div className="flex justify-end gap-2">
                  <Button
                     onClick={() => handleOpen(row.original)}
                     size="sm"
                     variant="outline"
                  >
                     Gerenciar membros
                  </Button>
               </div>
            ),
         },
      ],
      [handleOpen],
   );

   const table = useReactTable({
      data: teams,
      columns,
      getRowId: (row) => row.id,
      columnResizeMode: "onChange",
      defaultColumn: { minSize: 80, size: 200, maxSize: 600 },
      getCoreRowModel: getCoreRowModel(),
      getSortedRowModel: getSortedRowModel(),
   });

   return (
      <div className="flex flex-col gap-4">
         <DefaultHeader
            description="Gerencie quem pertence a cada espaço da organização."
            title="Espaços"
         />

         <ScrollArea className="rounded-md border bg-card">
            <Table>
               <DataTableHeader table={table} />
               <DataTableBody<Team> table={table} />
            </Table>
         </ScrollArea>
         {teams.length === 0 && (
            <Empty>
               <EmptyHeader>
                  <EmptyMedia variant="icon">
                     <Box className="size-6" />
                  </EmptyMedia>
                  <EmptyTitle>Nenhum espaço encontrado</EmptyTitle>
                  <EmptyDescription>
                     Crie um espaço pelo seletor da barra lateral.
                  </EmptyDescription>
               </EmptyHeader>
            </Empty>
         )}
      </div>
   );
}

function TeamMembersSheet({ team }: { team: Team }) {
   const queryClient = useQueryClient();
   const [{ data: teamMembers }, { data: orgMembers }] = useSuspenseQueries({
      queries: [
         orpc.organization.getTeamMembers.queryOptions({
            input: { teamId: team.id },
         }),
         orpc.organization.getMembers.queryOptions({}),
      ],
   });

   const invalidate = useCallback(() => {
      queryClient.invalidateQueries({
         queryKey: orpc.organization.getTeamMembers.queryKey({
            input: { teamId: team.id },
         }),
      });
   }, [queryClient, team.id]);

   const inTeam = useMemo(
      () => new Set(teamMembers.map((m) => m.userId)),
      [teamMembers],
   );
   const available = useMemo(
      () => orgMembers.filter((m) => !inTeam.has(m.userId)),
      [orgMembers, inTeam],
   );

   const [pendingAddUserId, setPendingAddUserId] = useState<string>("");

   const handleAdd = useCallback(
      (userId: string) => {
         if (!userId) return;
         authClient.organization.addTeamMember({
            teamId: team.id,
            userId,
            fetchOptions: {
               onSuccess: () => {
                  invalidate();
                  setPendingAddUserId("");
                  toast.success("Membro adicionado ao espaço");
               },
               onError: ({ error }) => {
                  toast.error(error.message ?? "Falha ao adicionar membro");
               },
            },
         });
      },
      [team.id, invalidate],
   );

   const handleRemove = useCallback(
      (userId: string) => {
         authClient.organization.removeTeamMember({
            teamId: team.id,
            userId,
            fetchOptions: {
               onSuccess: () => {
                  invalidate();
                  toast.success("Membro removido do espaço");
               },
               onError: ({ error }) => {
                  toast.error(error.message ?? "Falha ao remover membro");
               },
            },
         });
      },
      [team.id, invalidate],
   );

   const noneAvailable = available.length === 0;

   return (
      <>
         <SheetHeader>
            <SheetTitle>{team.name}</SheetTitle>
            <SheetDescription>
               Apenas membros adicionados acessam os dados deste espaço.
            </SheetDescription>
         </SheetHeader>

         <Separator />

         <ScrollArea className="flex-1 px-4">
            <div className="flex flex-col gap-2">
               <span className="text-sm font-medium text-muted-foreground">
                  Membros do espaço ({teamMembers.length})
               </span>
               {teamMembers.length === 0 && (
                  <Empty className="border rounded-md py-6">
                     <EmptyHeader>
                        <EmptyMedia variant="icon">
                           <UserMinus className="size-5" />
                        </EmptyMedia>
                        <EmptyTitle className="text-sm">
                           Nenhum membro no espaço
                        </EmptyTitle>
                        <EmptyDescription className="text-xs">
                           Adicione abaixo para liberar acesso.
                        </EmptyDescription>
                     </EmptyHeader>
                  </Empty>
               )}
               {teamMembers.map((m) => (
                  <div
                     className="flex items-center gap-2 rounded-md border bg-card p-2"
                     key={m.id}
                  >
                     <Avatar className="size-8 shrink-0">
                        <AvatarImage alt={m.name} src={m.image || undefined} />
                        <AvatarFallback className="text-xs">
                           {getInitials(m.name || m.email)}
                        </AvatarFallback>
                     </Avatar>
                     <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-medium">
                           {m.name || m.email}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                           {m.email}
                        </span>
                     </div>
                     <Button
                        onClick={() => handleRemove(m.userId)}
                        size="icon-sm"
                        tooltip="Remover do espaço"
                        variant="outline"
                     >
                        <UserMinus />
                     </Button>
                  </div>
               ))}
            </div>
         </ScrollArea>

         <SheetFooter className="border-t">
            <span className="text-sm font-medium text-muted-foreground">
               Adicionar membro
            </span>
            <div className="flex items-center gap-2">
               <Select
                  disabled={noneAvailable}
                  onValueChange={setPendingAddUserId}
                  value={pendingAddUserId}
               >
                  <SelectTrigger className="min-w-0 flex-1">
                     <SelectValue
                        placeholder={
                           noneAvailable
                              ? "Todos já estão no espaço"
                              : "Selecionar membro"
                        }
                     />
                  </SelectTrigger>
                  <SelectContent>
                     {available.map((m) => (
                        <SelectItem key={m.userId} value={m.userId}>
                           {m.name || m.email}
                        </SelectItem>
                     ))}
                  </SelectContent>
               </Select>
               <Button
                  className="shrink-0"
                  disabled={!pendingAddUserId}
                  onClick={() => handleAdd(pendingAddUserId)}
               >
                  <UserPlus />
                  Adicionar
               </Button>
            </div>
         </SheetFooter>
      </>
   );
}

function TeamsPage() {
   return (
      <QueryBoundary
         errorTitle="Erro ao carregar espaços"
         fallback={<TeamsSkeleton />}
      >
         <TeamsContent />
      </QueryBoundary>
   );
}

function TeamsSkeleton() {
   return (
      <div className="flex flex-col gap-4">
         <Skeleton className="h-8 w-48" />
         <Skeleton className="h-64 w-full" />
      </div>
   );
}

function TeamMembersSheetSkeleton() {
   return (
      <div className="flex flex-col gap-4 p-4">
         <Skeleton className="h-6 w-40" />
         <Skeleton className="h-4 w-64" />
         <Skeleton className="h-32 w-full" />
      </div>
   );
}
