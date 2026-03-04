import type { ReactNode } from "react";
import type {
   PageViewSwitchConfig,
   PanelAction,
} from "@/features/context-panel/context-panel-store";
import { PageHeader } from "./page-header";

interface DefaultHeaderProps {
   title: string;
   description: ReactNode;
   actions?: ReactNode;
   /** Secondary actions shown below the title (e.g., filter chips) */
   secondaryActions?: ReactNode;
   /** View switch config — shown as compact icon button in header when panel is closed, shown as full labeled action in panel content when open. */
   viewSwitch?: PageViewSwitchConfig;
   /** Structured actions that move into the context panel info tab as full-width items. */
   panelActions?: PanelAction[];
}

export function DefaultHeader({
   title,
   description,
   actions,
   secondaryActions,
   viewSwitch,
   panelActions,
}: DefaultHeaderProps) {
   return (
      <div className="flex flex-col gap-4">
         <PageHeader
            actions={actions}
            description={description}
            panelActions={panelActions}
            panelViewSwitch={viewSwitch}
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
