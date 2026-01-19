import { Button } from "@packages/ui/components/button";
import {
   Card,
   CardAction,
   CardContent,
   CardDescription,
   CardFooter,
   CardHeader,
   CardTitle,
} from "@packages/ui/components/card";
import { Checkbox } from "@packages/ui/components/checkbox";
import { CollapsibleTrigger } from "@packages/ui/components/collapsible";
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuSeparator,
   DropdownMenuTrigger,
} from "@packages/ui/components/dropdown-menu";
import { formatDate } from "@packages/utils/date";
import type { Row } from "@tanstack/react-table";
import { ChevronDown, MoreVertical, RefreshCw, Trash2 } from "lucide-react";
import { RoleBadge } from "@/features/organization/ui/shared/role-badge";
import { StatusBadge } from "@/features/organization/ui/shared/status-badge";
import type { Invite } from "./invites-table-columns";

type InvitesMobileCardProps = {
   row: Row<Invite>;
   isExpanded: boolean;
   toggleExpanded: () => void;
   canExpand?: boolean;
   onResend?: (invite: Invite) => void;
   onRevoke?: (invite: Invite) => void;
};

export function InvitesMobileCard({
   row,
   isExpanded,
   toggleExpanded,
   canExpand = true,
   onResend,
   onRevoke,
}: InvitesMobileCardProps) {
   const invite = row.original;
   const isPending = invite.status === "pending";
   const isExpired = new Date(invite.expiresAt) < new Date();

   return (
      <Card className={isExpanded ? "rounded-b-none py-4" : "py-4"}>
         <CardHeader className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
               <CardTitle className="text-sm truncate">
                  {invite.email}
               </CardTitle>
               <CardDescription
                  className={isExpired ? "text-destructive" : undefined}
               >
                  Expira em:{" "}
                  {formatDate(new Date(invite.expiresAt), "DD MMM YYYY")}
               </CardDescription>
            </div>
            <CardAction>
               <Checkbox
                  checked={row.getIsSelected()}
                  onCheckedChange={(value) => row.toggleSelected(!!value)}
               />
            </CardAction>
         </CardHeader>
         <CardContent className="flex flex-wrap items-center gap-2">
            <RoleBadge role={invite.role} />
            <StatusBadge status={invite.status} />
         </CardContent>
         {canExpand && (
            <CardFooter className="flex gap-2">
               {isPending && (onResend || onRevoke) && (
                  <DropdownMenu>
                     <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="outline">
                           <MoreVertical className="size-4" />
                        </Button>
                     </DropdownMenuTrigger>
                     <DropdownMenuContent align="start">
                        {onResend && (
                           <DropdownMenuItem onClick={() => onResend(invite)}>
                              <RefreshCw className="size-4 mr-2" />
                              Reenviar
                           </DropdownMenuItem>
                        )}
                        {onRevoke && (
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
               )}
               <CollapsibleTrigger asChild onClick={toggleExpanded}>
                  <Button className="flex-1" variant="outline">
                     <ChevronDown
                        className={`size-4 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                     />
                     Mais
                  </Button>
               </CollapsibleTrigger>
            </CardFooter>
         )}
      </Card>
   );
}
