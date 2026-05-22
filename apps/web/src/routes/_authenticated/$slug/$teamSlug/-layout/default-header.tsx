import { Button } from "@packages/ui/components/button";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import type { PanelAction } from "../-context-panel/context-panel-store";
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
   editable?: boolean;
   onTitleChange?: (value: string) => void;
   onDescriptionChange?: (value: string) => void;
   titlePlaceholder?: string;
   descriptionPlaceholder?: string;
}

export function DefaultHeader({
   title,
   description,
   actions,
   secondaryActions,
   panelActions,
   onBack,
   editable,
   onTitleChange,
   onDescriptionChange,
   titlePlaceholder,
   descriptionPlaceholder,
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
                  editable={editable}
                  onDescriptionChange={onDescriptionChange}
                  onTitleChange={onTitleChange}
                  descriptionPlaceholder={descriptionPlaceholder}
                  panelActions={panelActions}
                  title={title}
                  titlePlaceholder={titlePlaceholder}
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
