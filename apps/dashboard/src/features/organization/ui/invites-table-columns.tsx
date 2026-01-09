import type { RouterOutput } from "@packages/api/client";
import { Button } from "@packages/ui/components/button";
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuSeparator,
   DropdownMenuTrigger,
} from "@packages/ui/components/dropdown-menu";
import {
   Tooltip,
   TooltipContent,
   TooltipTrigger,
} from "@packages/ui/components/tooltip";
import { formatDate } from "@packages/utils/date";
import type { ColumnDef } from "@tanstack/react-table";
import { MoreVertical, RefreshCw, Trash2 } from "lucide-react";
import { RoleBadge } from "@/features/organization/ui/shared/role-badge";
import { StatusBadge } from "@/features/organization/ui/shared/status-badge";

export type Invite =
   RouterOutput["organizationInvites"]["listInvitations"]["invitations"][number];

interface InviteActionsProps {
   invite: Invite;
   onResend?: (invite: Invite) => void;
   onRevoke?: (invite: Invite) => void;
}

function InviteActionsCell({ invite, onResend, onRevoke }: InviteActionsProps) {
   const isPending = invite.status === "pending";

   return (
      <div className="flex justify-end">
         <DropdownMenu>
            <Tooltip>
               <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                     <Button disabled={!isPending} size="icon" variant="ghost">
                        <MoreVertical className="size-4" />
                     </Button>
                  </DropdownMenuTrigger>
               </TooltipTrigger>
               <TooltipContent>
                  Ações
               </TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end">
               {isPending && onResend && (
                  <DropdownMenuItem onClick={() => onResend(invite)}>
                     <RefreshCw className="size-4 mr-2" />
                     Reenviar
                  </DropdownMenuItem>
               )}
               {isPending && onRevoke && (
                  <>
                     <DropdownMenuSeparator />
                     <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => onRevoke(invite)}
                     >
                        <Trash2 className="size-4 mr-2" />
                        Revogar
                     </DropdownMenuItem>
                  </>
               )}
            </DropdownMenuContent>
         </DropdownMenu>
      </div>
   );
}

export function createInviteColumns(
   onResend?: (invite: Invite) => void,
   onRevoke?: (invite: Invite) => void,
): ColumnDef<Invite>[] {
   return [
      {
         accessorKey: "email",
         cell: ({ row }) => (
            <span className="font-medium truncate max-w-[200px] block">
               {row.original.email}
            </span>
         ),
         enableSorting: false,
         header: "Email",
      },
      {
         accessorKey: "role",
         cell: ({ row }) => <RoleBadge role={row.original.role} />,
         enableSorting: false,
         header: "Cargo",
      },
      {
         accessorKey: "status",
         cell: ({ row }) => <StatusBadge status={row.original.status} />,
         enableSorting: false,
         header: "Status",
      },
      {
         accessorKey: "expiresAt",
         cell: ({ row }) => {
            const date = row.original.expiresAt;
            const isExpired = new Date(date) < new Date();
            return (
               <span
                  className={`text-sm ${isExpired ? "text-destructive" : "text-muted-foreground"}`}
               >
                  {formatDate(new Date(date), "DD MMM YYYY")}
               </span>
            );
         },
         enableSorting: false,
         header: "Expira em",
      },
      {
         cell: ({ row }) => (
            <InviteActionsCell
               invite={row.original}
               onResend={onResend}
               onRevoke={onRevoke}
            />
         ),
         enableSorting: false,
         header: "",
         id: "actions",
      },
   ];
}
