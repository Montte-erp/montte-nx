import type { ReactNode } from "react";
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuSub,
   DropdownMenuSubContent,
   DropdownMenuSubTrigger,
   DropdownMenuTrigger,
} from "@packages/ui/components/dropdown-menu";
import { Button } from "@packages/ui/components/button";
import { Download, MoreHorizontal, Upload } from "lucide-react";
import type { PanelAction } from "@/features/context-panel/context-panel-store";
import { PageHeader } from "./page-header";

interface DefaultHeaderProps {
   title: string;
   description: ReactNode;
   actions?: ReactNode;
   /** Secondary actions shown below the title (e.g., filter chips) */
   secondaryActions?: ReactNode;
   /** Structured actions that move into the context panel info tab as full-width items. */
   panelActions?: PanelAction[];
   onImport?: () => void;
   onExportCsv?: () => void;
   onExportXlsx?: () => void;
}

export function DefaultHeader({
   title,
   description,
   actions,
   secondaryActions,
   panelActions,
   onImport,
   onExportCsv,
   onExportXlsx,
}: DefaultHeaderProps) {
   const hasImportExport = onImport ?? onExportCsv ?? onExportXlsx;

   const importExportDropdown = hasImportExport ? (
      <DropdownMenu>
         <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon">
               <MoreHorizontal className="size-4" />
               <span className="sr-only">Mais ações</span>
            </Button>
         </DropdownMenuTrigger>
         <DropdownMenuContent align="end">
            {onImport && (
               <DropdownMenuItem onClick={onImport}>
                  <Upload className="size-4" />
                  Importar
               </DropdownMenuItem>
            )}
            {(onExportCsv ?? onExportXlsx) && (
               <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                     <Download className="size-4" />
                     Exportar
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                     {onExportCsv && (
                        <DropdownMenuItem onClick={onExportCsv}>
                           CSV
                        </DropdownMenuItem>
                     )}
                     {onExportXlsx && (
                        <DropdownMenuItem onClick={onExportXlsx}>
                           XLSX
                        </DropdownMenuItem>
                     )}
                  </DropdownMenuSubContent>
               </DropdownMenuSub>
            )}
         </DropdownMenuContent>
      </DropdownMenu>
   ) : null;

   const composedActions = importExportDropdown ? (
      <div className="flex gap-2">
         {importExportDropdown}
         {actions}
      </div>
   ) : (
      actions
   );

   return (
      <div className="flex flex-col gap-4">
         <PageHeader
            actions={composedActions}
            description={description}
            panelActions={panelActions}
            title={title}
         />
         {secondaryActions != null && (
            <div className="flex flex-wrap items-center gap-4">
               {secondaryActions}
            </div>
         )}
      </div>
   );
}
