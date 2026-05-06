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
            onClick={handleOpenAI}
            tooltip="Abrir Chat IA"
            type="button"
            variant="outline"
         >
            <Sparkles className="size-4" />
         </Button>

         <Button
            onClick={handleOpenPanel}
            tooltip="Abrir painel"
            type="button"
            variant="outline"
         >
            <PanelRight className="size-4" />
         </Button>
      </div>
   );
}
