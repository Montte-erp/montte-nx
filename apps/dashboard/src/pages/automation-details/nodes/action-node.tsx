import {
   BaseNode,
   BaseNodeContent,
   BaseNodeHeader,
   BaseNodeHeaderTitle,
} from "@packages/ui/components/base-node";
import { Tooltip, TooltipContent, TooltipTrigger } from "@packages/ui/components/tooltip";
import { cn } from "@packages/ui/lib/utils";
import { getAction } from "@packages/workflows/config/actions";
import type { NodeProps } from "@xyflow/react";
import { Position, useReactFlow } from "@xyflow/react";
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Info, Play } from "lucide-react";
import { useMemo } from "react";
import {
   validateActionNode,
   validateDataDependencies,
   validateEmailAttachmentDependency,
} from "../lib/node-validation";
import type { ActionNode as ActionNodeType, AutomationEdge, AutomationNode } from "../lib/types";
import { ACTION_TYPE_LABELS } from "../lib/types";
import { AutomationHandle } from "./automation-handle";

export function ActionNode({ id, data }: NodeProps<ActionNodeType>) {
   const { getNodes, getEdges } = useReactFlow();
   const validation = validateActionNode(data);
   const label = ACTION_TYPE_LABELS[data.actionType] ?? data.label;
   const actionDef = getAction(data.actionType);
   const dataFlow = actionDef.dataFlow;

   // Check for data flow warnings
   const warnings = useMemo(() => {
      const nodes = getNodes() as AutomationNode[];
      const edges = getEdges() as AutomationEdge[];
      const allWarnings: string[] = [];

      const depValidation = validateDataDependencies(id, data, nodes, edges);
      allWarnings.push(...depValidation.warnings);

      const attachmentValidation = validateEmailAttachmentDependency(id, data, nodes, edges);
      allWarnings.push(...attachmentValidation.warnings);

      return allWarnings;
   }, [id, data, getNodes, getEdges]);

   const hasWarnings = warnings.length > 0;
   const hasInput = !!dataFlow?.requires || (dataFlow?.optionalInputs && dataFlow.optionalInputs.length > 0);
   const hasOutput = !!dataFlow?.produces;

   return (
      <BaseNode
         className={cn(
            "min-w-[200px] relative",
            !validation.valid ? "border-red-500" : hasWarnings ? "border-amber-500" : "border-blue-500",
         )}
      >
         {/* Input data flow indicator - left side */}
         {hasInput && (
            <Tooltip>
               <TooltipTrigger asChild>
                  <div className="absolute -left-3 top-1/2 -translate-y-1/2 flex size-6 items-center justify-center rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 shadow-sm cursor-help z-10">
                     <ArrowDownToLine className="size-3.5" />
                  </div>
               </TooltipTrigger>
               <TooltipContent side="left" className="text-xs">
                  {dataFlow?.requires ? (
                     <span>Requer: {dataFlow.requiresLabel ?? dataFlow.requires}</span>
                  ) : (
                     <span>Entrada opcional: {dataFlow?.optionalInputsLabel}</span>
                  )}
               </TooltipContent>
            </Tooltip>
         )}

         {/* Output data flow indicator - right side */}
         {hasOutput && (
            <Tooltip>
               <TooltipTrigger asChild>
                  <div className="absolute -right-3 top-1/2 -translate-y-1/2 flex size-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 shadow-sm cursor-help z-10">
                     <ArrowUpFromLine className="size-3.5" />
                  </div>
               </TooltipTrigger>
               <TooltipContent side="right" className="text-xs">
                  Produz: {dataFlow?.producesLabel ?? dataFlow?.produces}
               </TooltipContent>
            </Tooltip>
         )}

         <AutomationHandle
            className={cn(
               !validation.valid ? "!border-red-500" : hasWarnings ? "!border-amber-500" : "!border-blue-500",
            )}
            id="top"
            position={Position.Top}
            type="target"
         />
         <AutomationHandle
            className={cn(
               !validation.valid ? "!border-red-500" : hasWarnings ? "!border-amber-500" : "!border-blue-500",
            )}
            id="left"
            position={Position.Left}
            type="target"
         />
         <BaseNodeHeader
            className={cn(
               "rounded-t-md text-white",
               !validation.valid ? "bg-red-500" : hasWarnings ? "bg-amber-500" : "bg-blue-500",
            )}
         >
            {!validation.valid && <AlertTriangle className="size-4" />}
            {validation.valid && hasWarnings && <Info className="size-4" />}
            {validation.valid && !hasWarnings && <Play className="size-4" />}
            <BaseNodeHeaderTitle className="text-sm">
               {label}
            </BaseNodeHeaderTitle>
         </BaseNodeHeader>
         <BaseNodeContent>
            <div className="text-xs text-muted-foreground">
               {data.actionType}
            </div>
            {!validation.valid && (
               <div className="flex items-center gap-1 text-xs text-red-600">
                  <AlertTriangle className="size-3" />
                  Configuração incompleta
               </div>
            )}
            {validation.valid && hasWarnings && (
               <Tooltip>
                  <TooltipTrigger asChild>
                     <div className="flex items-center gap-1 text-xs text-amber-600 cursor-help">
                        <Info className="size-3" />
                        Dependência ausente
                     </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[250px] text-xs">
                     {warnings.map((w, i) => (
                        <p key={`warning-${i + 1}`} className="mb-1 last:mb-0">{w}</p>
                     ))}
                  </TooltipContent>
               </Tooltip>
            )}
            {data.continueOnError && (
               <div className="text-xs text-amber-600">
                  Continua em caso de erro
               </div>
            )}
         </BaseNodeContent>
         <AutomationHandle
            className={cn(
               !validation.valid ? "!border-red-500" : hasWarnings ? "!border-amber-500" : "!border-blue-500",
            )}
            id="bottom"
            position={Position.Bottom}
            type="source"
         />
         <AutomationHandle
            className={cn(
               !validation.valid ? "!border-red-500" : hasWarnings ? "!border-amber-500" : "!border-blue-500",
            )}
            id="right"
            position={Position.Right}
            type="source"
         />
      </BaseNode>
   );
}
