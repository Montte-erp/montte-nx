import { Button } from "@packages/ui/components/button";
import { Separator } from "@packages/ui/components/separator";
import { useIsMobile } from "@packages/ui/hooks/use-mobile";
import { formatDate } from "@packages/utils/date";
import { Link } from "@tanstack/react-router";
import type { Row } from "@tanstack/react-table";
import { Calendar, Edit, Eye, FileText, Trash2 } from "lucide-react";
import type { Team } from "./teams-table-columns";

interface TeamsExpandedContentProps {
   row: Row<Team>;
   slug: string;
   onEdit?: (team: Team) => void;
   onDelete?: (team: Team) => void;
}

export function TeamsExpandedContent({
   row,
   slug,
   onEdit,
   onDelete,
}: TeamsExpandedContentProps) {
   const team = row.original;
   const isMobile = useIsMobile();

   if (isMobile) {
      return (
         <div className="p-4 space-y-4">
            <div className="space-y-3">
               <div className="flex items-center gap-2">
                  <FileText className="size-4 text-muted-foreground" />
                  <div>
                     <p className="text-xs text-muted-foreground">Descrição</p>
                     <p className="text-sm font-medium">
                        {team.description || "Sem descrição"}
                     </p>
                  </div>
               </div>
               <Separator />
               <div className="flex items-center gap-2">
                  <Calendar className="size-4 text-muted-foreground" />
                  <div>
                     <p className="text-xs text-muted-foreground">Criado em</p>
                     <p className="text-sm font-medium">
                        {formatDate(new Date(team.createdAt), "DD MMM YYYY")}
                     </p>
                  </div>
               </div>
            </div>

            <Separator />

            <div className="space-y-2">
               <Button
                  asChild
                  className="w-full justify-start"
                  size="sm"
                  variant="outline"
               >
                  <Link
                     params={{ slug, teamId: team.id }}
                     to="/$slug/organization/teams/$teamId"
                  >
                     <Eye className="size-4" />
                     Ver detalhes
                  </Link>
               </Button>
               {onEdit && (
                  <Button
                     className="w-full justify-start"
                     onClick={(e) => {
                        e.stopPropagation();
                        onEdit(team);
                     }}
                     size="sm"
                     variant="outline"
                  >
                     <Edit className="size-4" />
                     Editar equipe
                  </Button>
               )}
               {onDelete && (
                  <Button
                     className="w-full justify-start text-destructive hover:text-destructive"
                     onClick={(e) => {
                        e.stopPropagation();
                        onDelete(team);
                     }}
                     size="sm"
                     variant="outline"
                  >
                     <Trash2 className="size-4" />
                     Excluir equipe
                  </Button>
               )}
            </div>
         </div>
      );
   }

   return (
      <div className="p-4 flex items-center justify-between gap-6">
         <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
               <FileText className="size-4 text-muted-foreground" />
               <div>
                  <p className="text-xs text-muted-foreground">Descrição</p>
                  <p className="text-sm font-medium max-w-xs truncate">
                     {team.description || "Sem descrição"}
                  </p>
               </div>
            </div>
            <Separator className="h-8" orientation="vertical" />
            <div className="flex items-center gap-2">
               <Calendar className="size-4 text-muted-foreground" />
               <div>
                  <p className="text-xs text-muted-foreground">Criado em</p>
                  <p className="text-sm font-medium">
                     {formatDate(new Date(team.createdAt), "DD MMM YYYY")}
                  </p>
               </div>
            </div>
         </div>

         <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline">
               <Link
                  params={{ slug, teamId: team.id }}
                  to="/$slug/organization/teams/$teamId"
               >
                  <Eye className="size-4" />
                  Ver detalhes
               </Link>
            </Button>
            {onEdit && (
               <Button
                  onClick={(e) => {
                     e.stopPropagation();
                     onEdit(team);
                  }}
                  size="sm"
                  variant="outline"
               >
                  <Edit className="size-4" />
                  Editar
               </Button>
            )}
            {onDelete && (
               <Button
                  onClick={(e) => {
                     e.stopPropagation();
                     onDelete(team);
                  }}
                  size="sm"
                  variant="destructive"
               >
                  <Trash2 className="size-4" />
                  Excluir
               </Button>
            )}
         </div>
      </div>
   );
}
