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
import { ChevronDown, Edit, MoreVertical, Trash2, Users } from "lucide-react";
import type { Team } from "./teams-table-columns";

type TeamsMobileCardProps = {
   row: Row<Team>;
   isExpanded: boolean;
   toggleExpanded: () => void;
   canExpand?: boolean;
   slug: string;
   onEdit?: (team: Team) => void;
   onDelete?: (team: Team) => void;
};

export function TeamsMobileCard({
   row,
   isExpanded,
   toggleExpanded,
   canExpand = true,
   onEdit,
   onDelete,
}: TeamsMobileCardProps) {
   const team = row.original;

   return (
      <Card className={isExpanded ? "rounded-b-none py-4" : "py-4"}>
         <CardHeader className="flex items-center gap-2">
            <div className="flex size-10 items-center justify-center rounded-md border bg-muted shrink-0">
               <Users className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
               <CardTitle className="text-sm truncate">{team.name}</CardTitle>
               <CardDescription className="truncate">
                  {team.description || "-"}
               </CardDescription>
            </div>
            <CardAction>
               <Checkbox
                  checked={row.getIsSelected()}
                  onCheckedChange={(value) => row.toggleSelected(!!value)}
               />
            </CardAction>
         </CardHeader>
         <CardContent>
            <p className="text-xs text-muted-foreground">
               Criado em: {formatDate(new Date(team.createdAt), "DD MMM YYYY")}
            </p>
         </CardContent>
         {canExpand && (
            <CardFooter className="flex gap-2">
               {(onEdit || onDelete) && (
                  <DropdownMenu>
                     <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="outline">
                           <MoreVertical className="size-4" />
                        </Button>
                     </DropdownMenuTrigger>
                     <DropdownMenuContent align="start">
                        {onEdit && (
                           <DropdownMenuItem onClick={() => onEdit(team)}>
                              <Edit className="size-4 mr-2" />
                              Editar
                           </DropdownMenuItem>
                        )}
                        {onDelete && (
                           <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                 className="text-destructive"
                                 onClick={() => onDelete(team)}
                              >
                                 <Trash2 className="size-4 mr-2" />
                                 Excluir
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
