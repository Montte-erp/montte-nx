import { Button } from "@packages/ui/components/button";
import { PanelRight, Sparkles } from "lucide-react";
import { openContextPanel, setActiveTab } from "./use-context-panel";

export function ContextPanelHeaderActions() {
   const handleOpenAI = () => {
      setActiveTab("chat");
      openContextPanel();
   };

   const handleOpenPanel = () => {
      setActiveTab("info");
      openContextPanel();
   };

   return (
      <div className="flex items-center gap-1">
         <Button
            className="size-8 rounded"
            onClick={handleOpenAI}
            size="icon"
            tooltip="Abrir Chat IA"
            type="button"
            variant="icon-outline"
         >
            <Sparkles className="size-4" />
         </Button>

         <Button
            className="size-8 rounded"
            onClick={handleOpenPanel}
            size="icon"
            tooltip="Abrir painel"
            type="button"
            variant="icon-outline"
         >
            <PanelRight className="size-4" />
         </Button>
      </div>
   );
}
