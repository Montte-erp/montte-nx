import { Button } from "@packages/ui/components/button";
import { PanelRight } from "lucide-react";
import { openContextPanel } from "./use-context-panel";

export function ContextPanelHeaderActions() {
   return (
      <Button
         onClick={openContextPanel}
         tooltip="Abrir painel"
         type="button"
         variant="outline"
      >
         <PanelRight className="size-4" />
      </Button>
   );
}
