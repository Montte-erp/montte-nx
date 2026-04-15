import {
   Avatar,
   AvatarFallback,
   AvatarImage,
} from "@packages/ui/components/avatar";
import { Badge } from "@packages/ui/components/badge";
import { getInitials } from "@core/utils/text";
import type { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";

export type MemberRow = {
   id: string;
   userId: string;
   name: string;
   email: string;
   role: string;
   image: string | null;
   createdAt: Date;
};

export const ROLE_LABELS: Record<string, string> = {
   owner: "Proprietário",
   admin: "Administrador",
   member: "Membro",
};

export function formatDate(date: Date | string): string {
   return dayjs(date).format("DD/MM/YYYY");
}

export function getRoleBadgeVariant(
   role: string,
): "default" | "secondary" | "outline" {
   if (role === "owner") return "default";
   if (role === "admin") return "secondary";
   return "outline";
}

export function buildMembersColumns(
   currentUserId: string | undefined,
): ColumnDef<MemberRow>[] {
   return [
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
               <span className="truncate font-medium">{row.original.name}</span>
               {row.original.userId === currentUserId && (
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
            <span className="text-muted-foreground">{row.original.email}</span>
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
   ];
}
