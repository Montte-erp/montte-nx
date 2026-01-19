import { Button } from "@packages/ui/components/button";
import {
   Tooltip,
   TooltipContent,
   TooltipTrigger,
} from "@packages/ui/components/tooltip";
import { Link, type LinkProps } from "@tanstack/react-router";
import { Edit, Eye, Trash2 } from "lucide-react";

export type EntityActionsProps = {
   detailsLink: LinkProps;
   onEdit?: (e: React.MouseEvent) => void;
   onDelete?: (e: React.MouseEvent) => void;
   labels?: {
      view?: string;
      edit?: string;
      delete?: string;
   };
   /**
    * "compact" renders icon-only buttons
    * "full" renders buttons with text labels
    * "mobile" renders full-width buttons for mobile layouts
    */
   variant?: "compact" | "full" | "mobile";
};

const defaultLabels = {
   delete: "Excluir",
   edit: "Editar",
   view: "Ver detalhes",
};

export function EntityActions({
   detailsLink,
   onEdit,
   onDelete,
   labels = defaultLabels,
   variant = "compact",
}: EntityActionsProps) {
   const mergedLabels = { ...defaultLabels, ...labels };

   if (variant === "mobile") {
      return (
         <div className="space-y-2">
            <Button
               asChild
               className="w-full justify-start"
               size="sm"
               variant="outline"
            >
               <Link {...detailsLink}>
                  <Eye className="size-4" />
                  {mergedLabels.view}
               </Link>
            </Button>
            {onEdit && (
               <Button
                  className="w-full justify-start"
                  onClick={(e) => {
                     e.stopPropagation();
                     onEdit(e);
                  }}
                  size="sm"
                  variant="outline"
               >
                  <Edit className="size-4" />
                  {mergedLabels.edit}
               </Button>
            )}
            {onDelete && (
               <Button
                  className="w-full justify-start text-destructive hover:text-destructive"
                  onClick={(e) => {
                     e.stopPropagation();
                     onDelete(e);
                  }}
                  size="sm"
                  variant="outline"
               >
                  <Trash2 className="size-4" />
                  {mergedLabels.delete}
               </Button>
            )}
         </div>
      );
   }

   if (variant === "full") {
      return (
         <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm" variant="outline">
               <Link {...detailsLink}>
                  <Eye className="size-4" />
                  {mergedLabels.view}
               </Link>
            </Button>
            {onEdit && (
               <Button
                  onClick={(e) => {
                     e.stopPropagation();
                     onEdit(e);
                  }}
                  size="sm"
                  variant="outline"
               >
                  <Edit className="size-4" />
                  {mergedLabels.edit}
               </Button>
            )}
            {onDelete && (
               <Button
                  onClick={(e) => {
                     e.stopPropagation();
                     onDelete(e);
                  }}
                  size="sm"
                  variant="destructive"
               >
                  <Trash2 className="size-4" />
                  {mergedLabels.delete}
               </Button>
            )}
         </div>
      );
   }

   // Compact variant (default) - icon buttons only
   return (
      <div className="flex justify-end gap-1">
         <Tooltip>
            <TooltipTrigger asChild>
               <Button asChild size="icon" variant="outline">
                  <Link {...detailsLink}>
                     <Eye className="size-4" />
                  </Link>
               </Button>
            </TooltipTrigger>
            <TooltipContent>{mergedLabels.view}</TooltipContent>
         </Tooltip>
         {onEdit && (
            <Tooltip>
               <TooltipTrigger asChild>
                  <Button
                     onClick={(e) => {
                        e.stopPropagation();
                        onEdit(e);
                     }}
                     size="icon"
                     variant="outline"
                  >
                     <Edit className="size-4" />
                  </Button>
               </TooltipTrigger>
               <TooltipContent>{mergedLabels.edit}</TooltipContent>
            </Tooltip>
         )}
         {onDelete && (
            <Tooltip>
               <TooltipTrigger asChild>
                  <Button
                     className="text-destructive hover:text-destructive"
                     onClick={(e) => {
                        e.stopPropagation();
                        onDelete(e);
                     }}
                     size="icon"
                     variant="outline"
                  >
                     <Trash2 className="size-4" />
                  </Button>
               </TooltipTrigger>
               <TooltipContent>{mergedLabels.delete}</TooltipContent>
            </Tooltip>
         )}
      </div>
   );
}

/**
 * ViewDetailsButton - Simple action cell button for tables
 * Use this when you only want a "View details" button in the actions column
 */
export type ViewDetailsButtonProps = {
   detailsLink: LinkProps;
   label?: string;
};

export function ViewDetailsButton({
   detailsLink,
   label = "Ver detalhes",
}: ViewDetailsButtonProps) {
   return (
      <div className="flex justify-end">
         <Tooltip>
            <TooltipTrigger asChild>
               <Button asChild size="icon" variant="outline">
                  <Link {...detailsLink}>
                     <Eye className="size-4" />
                  </Link>
               </Button>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
         </Tooltip>
      </div>
   );
}
