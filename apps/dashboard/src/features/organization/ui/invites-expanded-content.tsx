import { Button } from "@packages/ui/components/button";
import { Separator } from "@packages/ui/components/separator";
import { useIsMobile } from "@packages/ui/hooks/use-mobile";
import { formatDate } from "@packages/utils/date";
import type { Row } from "@tanstack/react-table";
import { Calendar, Clock, RefreshCw, Shield, Trash2 } from "lucide-react";
import { RoleBadge } from "@/features/organization/ui/shared/role-badge";
import { StatusBadge } from "@/features/organization/ui/shared/status-badge";
import type { Invite } from "./invites-table-columns";

interface InvitesExpandedContentProps {
   row: Row<Invite>;
   onResend?: (invite: Invite) => void;
   onRevoke?: (invite: Invite) => void;
}

export function InvitesExpandedContent({
   row,
   onResend,
   onRevoke,
}: InvitesExpandedContentProps) {
   const invite = row.original;
   const isMobile = useIsMobile();
   const isPending = invite.status === "pending";
   const isExpired = new Date(invite.expiresAt) < new Date();

   const getExpiryInfo = () => {
      const expiryDate = new Date(invite.expiresAt);
      const now = new Date();
      const diffTime = expiryDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (isExpired) {
         return { text: "Expirado", className: "text-destructive" };
      }
      if (diffDays <= 1) {
         return { text: "Expira hoje", className: "text-warning" };
      }
      if (diffDays <= 3) {
         return { text: `Expira em ${diffDays} dias`, className: "text-warning" };
      }
      return { text: `Expira em ${diffDays} dias`, className: "text-muted-foreground" };
   };

   const expiryInfo = getExpiryInfo();

   if (isMobile) {
      return (
         <div className="p-4 space-y-4">
            <div className="space-y-3">
               <div className="flex items-center gap-2">
                  <Shield className="size-4 text-muted-foreground" />
                  <div>
                     <p className="text-xs text-muted-foreground">Cargo</p>
                     <RoleBadge role={invite.role} />
                  </div>
               </div>
               <Separator />
               <div className="flex items-center gap-2">
                  <Clock className="size-4 text-muted-foreground" />
                  <div>
                     <p className="text-xs text-muted-foreground">Status</p>
                     <StatusBadge status={invite.status} />
                  </div>
               </div>
               <Separator />
               <div className="flex items-center gap-2">
                  <Calendar className="size-4 text-muted-foreground" />
                  <div>
                     <p className="text-xs text-muted-foreground">
                        Data de expiração
                     </p>
                     <div className="flex items-center gap-2">
                        <p className={`text-sm font-medium ${isExpired ? "text-destructive" : ""}`}>
                           {formatDate(new Date(invite.expiresAt), "DD MMM YYYY")}
                        </p>
                        <span className={`text-xs ${expiryInfo.className}`}>
                           ({expiryInfo.text})
                        </span>
                     </div>
                  </div>
               </div>
            </div>

            {isPending && (onResend || onRevoke) && (
               <>
                  <Separator />
                  <div className="space-y-2">
                     {onResend && (
                        <Button
                           className="w-full justify-start"
                           onClick={(e) => {
                              e.stopPropagation();
                              onResend(invite);
                           }}
                           size="sm"
                           variant="outline"
                        >
                           <RefreshCw className="size-4" />
                           Reenviar convite
                        </Button>
                     )}
                     {onRevoke && (
                        <Button
                           className="w-full justify-start text-destructive hover:text-destructive"
                           onClick={(e) => {
                              e.stopPropagation();
                              onRevoke(invite);
                           }}
                           size="sm"
                           variant="outline"
                        >
                           <Trash2 className="size-4" />
                           Revogar convite
                        </Button>
                     )}
                  </div>
               </>
            )}
         </div>
      );
   }

   return (
      <div className="p-4 flex items-center justify-between gap-6">
         <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
               <Shield className="size-4 text-muted-foreground" />
               <div>
                  <p className="text-xs text-muted-foreground">Cargo</p>
                  <RoleBadge role={invite.role} />
               </div>
            </div>
            <Separator className="h-8" orientation="vertical" />
            <div className="flex items-center gap-2">
               <Clock className="size-4 text-muted-foreground" />
               <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <StatusBadge status={invite.status} />
               </div>
            </div>
            <Separator className="h-8" orientation="vertical" />
            <div className="flex items-center gap-2">
               <Calendar className="size-4 text-muted-foreground" />
               <div>
                  <p className="text-xs text-muted-foreground">Expiração</p>
                  <div className="flex items-center gap-2">
                     <p className={`text-sm font-medium ${isExpired ? "text-destructive" : ""}`}>
                        {formatDate(new Date(invite.expiresAt), "DD MMM YYYY")}
                     </p>
                     <span className={`text-xs ${expiryInfo.className}`}>
                        ({expiryInfo.text})
                     </span>
                  </div>
               </div>
            </div>
         </div>

         {isPending && (onResend || onRevoke) && (
            <div className="flex items-center gap-2">
               {onResend && (
                  <Button
                     onClick={(e) => {
                        e.stopPropagation();
                        onResend(invite);
                     }}
                     size="sm"
                     variant="outline"
                  >
                     <RefreshCw className="size-4" />
                     Reenviar
                  </Button>
               )}
               {onRevoke && (
                  <Button
                     onClick={(e) => {
                        e.stopPropagation();
                        onRevoke(invite);
                     }}
                     size="sm"
                     variant="destructive"
                  >
                     <Trash2 className="size-4" />
                     Revogar
                  </Button>
               )}
            </div>
         )}
      </div>
   );
}
