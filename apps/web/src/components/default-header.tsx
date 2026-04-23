import { Button } from "@packages/ui/components/button";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
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
   /** When provided, renders an ArrowLeft back button before the title. */
   onBack?: () => void;
}

export function DefaultHeader({
   title,
   description,
   actions,
   secondaryActions,
   panelActions,
   onBack,
}: DefaultHeaderProps) {
   return (
      <div className="flex flex-col gap-4">
         <div className="flex items-start gap-2">
            {onBack && (
               <Button
                  className="mt-1 shrink-0"
                  onClick={onBack}
                  size="icon"
                  tooltip="Voltar"
                  variant="ghost"
               >
                  <ArrowLeft className="size-4" />
                  <span className="sr-only">Voltar</span>
               </Button>
            )}
            <div className="flex-1 min-w-0">
               <PageHeader
                  actions={actions}
                  description={description}
                  panelActions={panelActions}
                  title={title}
               />
            </div>
         </div>
         {secondaryActions != null && (
            <div className="flex flex-wrap items-center gap-4">
               {secondaryActions}
            </div>
         )}
      </div>
   );
}
