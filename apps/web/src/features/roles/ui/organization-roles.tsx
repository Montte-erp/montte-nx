import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import { DataTable } from "@packages/ui/components/data-table";
import { Skeleton } from "@packages/ui/components/skeleton";
import { useSuspenseQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, Plus } from "lucide-react";
import { Suspense, useMemo, useState } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { orpc } from "@/integrations/orpc/client";
import { RoleFormDialog } from "./role-form-dialog";

type Role = {
   id: string;
   name: string;
   description: string | null;
   permissions: string[];
   isDefault: boolean;
   memberCount: number;
   createdAt: Date;
   updatedAt: Date;
};

function OrganizationRolesSkeleton() {
   return (
      <div className="space-y-6">
         <div className="flex items-center justify-between">
            <div>
               <Skeleton className="h-8 w-48" />
               <Skeleton className="h-4 w-96 mt-1" />
            </div>
            <Skeleton className="h-9 w-32" />
         </div>
         <Skeleton className="h-[400px] w-full" />
      </div>
   );
}

function OrganizationRolesErrorFallback({ resetErrorBoundary }: FallbackProps) {
   return (
      <div className="space-y-6">
         <div>
            <h1 className="text-2xl font-semibold font-serif">Funções</h1>
            <p className="text-sm text-muted-foreground mt-1">
               Gerencie as funções e permissões da organização.
            </p>
         </div>
         <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm text-muted-foreground mb-4">
               Não foi possível carregar as funções
            </p>
            <Button onClick={resetErrorBoundary} variant="outline">
               Tentar novamente
            </Button>
         </div>
      </div>
   );
}

function OrganizationRolesContent() {
   const [dialogOpen, setDialogOpen] = useState(false);
   const [editingRole, setEditingRole] = useState<Role | undefined>();

   const { data: roles } = useSuspenseQuery(orpc.roles.getAll.queryOptions({}));

   function handleCreateRole() {
      setEditingRole(undefined);
      setDialogOpen(true);
   }

   function handleEditRole(role: Role) {
      setEditingRole(role);
      setDialogOpen(true);
   }

   const columns: ColumnDef<Role>[] = useMemo(
      () => [
         {
            accessorKey: "name",
            header: "Função",
            cell: ({ row }) => (
               <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                     <span className="font-medium">{row.original.name}</span>
                     {row.original.isDefault && (
                        <Badge variant="secondary">Padrão</Badge>
                     )}
                  </div>
                  {row.original.description && (
                     <span className="text-xs text-muted-foreground mt-0.5">
                        {row.original.description}
                     </span>
                  )}
               </div>
            ),
         },
         {
            accessorKey: "memberCount",
            header: "Membros",
            cell: ({ row }) => (
               <Badge variant="outline">
                  {row.original.memberCount}{" "}
                  {row.original.memberCount === 1 ? "membro" : "membros"}
               </Badge>
            ),
         },
         {
            accessorKey: "permissions",
            header: "Permissões",
            cell: ({ row }) => (
               <span className="text-sm text-muted-foreground">
                  {row.original.permissions.length}{" "}
                  {row.original.permissions.length === 1
                     ? "permissão"
                     : "permissões"}
               </span>
            ),
         },
         {
            id: "actions",
            header: "",
            cell: ({ row }) => {
               const role = row.original;
               if (role.isDefault) return null;

               return (
                  // biome-ignore lint/a11y/noStaticElementInteractions: stopPropagation wrapper for table row click
                  <div
                     className="flex items-center justify-end gap-1"
                     onClick={(e) => e.stopPropagation()}
                     onKeyDown={(e) => e.stopPropagation()}
                  >
                     <Button
                        onClick={() => handleEditRole(role)}
                        tooltip="Editar função"
                        variant="outline"
                     >
                        <Pencil className="size-4" />
                     </Button>
                  </div>
               );
            },
         },
      ],
      [],
   );

   return (
      <div className="space-y-6">
         <div className="flex items-center justify-between">
            <div>
               <h1 className="text-2xl font-semibold font-serif">Funções</h1>
               <p className="text-sm text-muted-foreground mt-1">
                  Gerencie as funções e permissões da organização.
               </p>
            </div>
            <Button onClick={handleCreateRole}>
               <Plus className="size-4 mr-2" />
               Criar função
            </Button>
         </div>

         <DataTable columns={columns} data={roles} getRowId={(row) => row.id} />

         <RoleFormDialog
            onOpenChange={setDialogOpen}
            open={dialogOpen}
            role={editingRole}
         />
      </div>
   );
}

export function OrganizationRoles() {
   return (
      <ErrorBoundary FallbackComponent={OrganizationRolesErrorFallback}>
         <Suspense fallback={<OrganizationRolesSkeleton />}>
            <OrganizationRolesContent />
         </Suspense>
      </ErrorBoundary>
   );
}
