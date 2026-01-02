import { Button } from "@packages/ui/components/button";
import {
   DropdownMenu,
   DropdownMenuCheckboxItem,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuSeparator,
   DropdownMenuTrigger,
} from "@packages/ui/components/dropdown-menu";
import { Separator } from "@packages/ui/components/separator";
import {
   Tooltip,
   TooltipContent,
   TooltipTrigger,
} from "@packages/ui/components/tooltip";
import { cn } from "@packages/ui/lib/utils";
import { Panel, useReactFlow } from "@xyflow/react";
import {
   BookTemplate,
   Cable,
   History,
   LayoutGrid,
   Loader2,
   Maximize,
   Minus,
   Pencil,
   Play,
   Plus,
   RotateCcw,
} from "lucide-react";

export type ViewMode = "editor" | "history";

type CanvasToolbarProps = {
   showConnections: boolean;
   onToggleConnections: () => void;
   onAutoLayout: () => void;
   onOpenTemplates?: () => void;
   onTestRun?: () => void;
   isTestRunning?: boolean;
   isTestRunDisabled?: boolean;
   className?: string;
   viewMode?: ViewMode;
   onViewModeChange?: (mode: ViewMode) => void;
};

export function CanvasToolbar({
   showConnections,
   onToggleConnections,
   onAutoLayout,
   onOpenTemplates,
   onTestRun,
   isTestRunning = false,
   isTestRunDisabled = false,
   className,
   viewMode = "editor",
   onViewModeChange,
}: CanvasToolbarProps) {
   const { zoomIn, zoomOut, fitView } = useReactFlow();

   const handleToggleViewMode = () => {
      const newMode = viewMode === "editor" ? "history" : "editor";
      onViewModeChange?.(newMode);
   };

   const handleResetCanvas = () => {
      fitView({ duration: 300, padding: 0.2 });
   };

   return (
      <Panel
         className={cn(
            "bg-primary-foreground text-foreground flex flex-col gap-1 ",
            className,
         )}
         position="top-left"
      >
         <DropdownMenu>
            <Tooltip>
               <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                     <Button size="icon" variant="outline">
                        <LayoutGrid className="size-4" />
                     </Button>
                  </DropdownMenuTrigger>
               </TooltipTrigger>
               <TooltipContent side="right">Menu</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="start" side="right">
               <DropdownMenuCheckboxItem
                  checked={showConnections}
                  onCheckedChange={onToggleConnections}
               >
                  <Cable className="mr-2 size-4" />
                  {showConnections ? "Esconder Conexoes" : "Mostrar Conexoes"}
               </DropdownMenuCheckboxItem>
               <DropdownMenuSeparator />
               <DropdownMenuItem onClick={onAutoLayout}>
                  <LayoutGrid className="mr-2 size-4" />
                  Auto Layout
               </DropdownMenuItem>
               <DropdownMenuItem onClick={handleResetCanvas}>
                  <RotateCcw className="mr-2 size-4" />
                  Resetar Canvas
               </DropdownMenuItem>
            </DropdownMenuContent>
         </DropdownMenu>

         {onOpenTemplates && (
            <Tooltip>
               <TooltipTrigger asChild>
                  <Button
                     onClick={onOpenTemplates}
                     size="icon"
                     variant="outline"
                  >
                     <BookTemplate className="size-4" />
                  </Button>
               </TooltipTrigger>
               <TooltipContent side="right">Templates</TooltipContent>
            </Tooltip>
         )}

         {onTestRun && (
            <Tooltip>
               <TooltipTrigger asChild>
                  <Button
                     disabled={isTestRunDisabled || isTestRunning}
                     onClick={onTestRun}
                     size="icon"
                     variant="outline"
                  >
                     {isTestRunning ? (
                        <Loader2 className="size-4 animate-spin" />
                     ) : (
                        <Play className="size-4" />
                     )}
                  </Button>
               </TooltipTrigger>
               <TooltipContent side="right">Testar (Dry Run)</TooltipContent>
            </Tooltip>
         )}

         <Separator className="my-0.5" />

         <Tooltip>
            <TooltipTrigger asChild>
               <Button
                  onClick={() => zoomIn({ duration: 300 })}
                  size="icon"
                  variant="outline"
               >
                  <Plus className="size-4" />
               </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Aumentar Zoom</TooltipContent>
         </Tooltip>

         <Tooltip>
            <TooltipTrigger asChild>
               <Button
                  onClick={() => zoomOut({ duration: 300 })}
                  size="icon"
                  variant="outline"
               >
                  <Minus className="size-4" />
               </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Diminuir Zoom</TooltipContent>
         </Tooltip>

         <Tooltip>
            <TooltipTrigger asChild>
               <Button
                  onClick={() => fitView({ duration: 300 })}
                  size="icon"
                  variant="outline"
               >
                  <Maximize className="size-4" />
               </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Ajustar a Tela</TooltipContent>
         </Tooltip>

         {onViewModeChange && (
            <>
               <Separator className="my-0.5" />

               <Tooltip>
                  <TooltipTrigger asChild>
                     <Button
                        onClick={handleToggleViewMode}
                        size="icon"
                        variant={viewMode === "history" ? "default" : "outline"}
                     >
                        {viewMode === "editor" ? (
                           <History className="size-4" />
                        ) : (
                           <Pencil className="size-4" />
                        )}
                     </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                     {viewMode === "editor"
                        ? "Ver Historico"
                        : "Voltar ao Editor"}
                  </TooltipContent>
               </Tooltip>
            </>
         )}
      </Panel>
   );
}
