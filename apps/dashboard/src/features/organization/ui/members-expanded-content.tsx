import { Button } from "@packages/ui/components/button";
import { Separator } from "@packages/ui/components/separator";
import { useIsMobile } from "@packages/ui/hooks/use-mobile";
import { formatDate } from "@packages/utils/date";
import type { Row } from "@tanstack/react-table";
import { Calendar, Shield, Trash2, Users } from "lucide-react";
import { RoleBadge } from "@/features/organization/ui/shared/role-badge";
import type { Member } from "./members-table-columns";

interface MembersExpandedContentProps {
   row: Row<Member>;
   onChangeRole?: (member: Member) => void;
   onRemove?: (member: Member) => void;
}

export function MembersExpandedContent({
   row,
   onChangeRole,
   onRemove,
}: MembersExpandedContentProps) {
   const member = row.original;
   const isMobile = useIsMobile();
   const isOwner = member.role.toLowerCase() === "owner";

   if (isMobile) {
      return (
         <div className="p-4 space-y-4">
            <div className="space-y-3">
               <div className="flex items-center gap-2">
                  <Shield className="size-4 text-muted-foreground" />
                  <div>
                     <p className="text-xs text-muted-foreground">Cargo</p>
                     <RoleBadge role={member.role} />
                  </div>
               </div>
               <Separator />
               <div className="flex items-center gap-2">
                  <Calendar className="size-4 text-muted-foreground" />
                  <div>
                     <p className="text-xs text-muted-foreground">
                        Membro desde
                     </p>
                     <p className="text-sm font-medium">
                        {formatDate(new Date(member.createdAt), "DD MMM YYYY")}
                     </p>
                  </div>
               </div>
               <Separator />
               <div className="flex items-center gap-2">
                  <Users className="size-4 text-muted-foreground" />
                  <div>
                     <p className="text-xs text-muted-foreground">Equipes</p>
                     <p className="text-sm font-medium">-</p>
                  </div>
               </div>
            </div>

            {!isOwner && (onChangeRole || onRemove) && (
               <>
                  <Separator />
                  <div className="space-y-2">
                     {onChangeRole && (
                        <Button
                           className="w-full justify-start"
                           onClick={(e) => {
                              e.stopPropagation();
                              onChangeRole(member);
                           }}
                           size="sm"
                           variant="outline"
                        >
                           <Shield className="size-4" />
                           Alterar cargo
                        </Button>
                     )}
                     {onRemove && (
                        <Button
                           className="w-full justify-start text-destructive hover:text-destructive"
                           onClick={(e) => {
                              e.stopPropagation();
                              onRemove(member);
                           }}
                           size="sm"
                           variant="outline"
                        >
                           <Trash2 className="size-4" />
                           Remover membro
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
                  <RoleBadge role={member.role} />
               </div>
            </div>
            <Separator className="h-8" orientation="vertical" />
            <div className="flex items-center gap-2">
               <Calendar className="size-4 text-muted-foreground" />
               <div>
                  <p className="text-xs text-muted-foreground">Membro desde</p>
                  <p className="text-sm font-medium">
                     {formatDate(new Date(member.createdAt), "DD MMM YYYY")}
                  </p>
               </div>
            </div>
            <Separator className="h-8" orientation="vertical" />
            <div className="flex items-center gap-2">
               <Users className="size-4 text-muted-foreground" />
               <div>
                  <p className="text-xs text-muted-foreground">Equipes</p>
                  <p className="text-sm font-medium">-</p>
               </div>
            </div>
         </div>

         {!isOwner && (onChangeRole || onRemove) && (
            <div className="flex items-center gap-2">
               {onChangeRole && (
                  <Button
                     onClick={(e) => {
                        e.stopPropagation();
                        onChangeRole(member);
                     }}
                     size="sm"
                     variant="outline"
                  >
                     <Shield className="size-4" />
                     Alterar cargo
                  </Button>
               )}
               {onRemove && (
                  <Button
                     onClick={(e) => {
                        e.stopPropagation();
                        onRemove(member);
                     }}
                     size="sm"
                     variant="destructive"
                  >
                     <Trash2 className="size-4" />
                     Remover
                  </Button>
               )}
            </div>
         )}
      </div>
   );
}
