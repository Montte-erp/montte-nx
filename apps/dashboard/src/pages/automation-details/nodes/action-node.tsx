import {
   BaseNode,
   BaseNodeContent,
   BaseNodeHeader,
   BaseNodeHeaderTitle,
} from "@packages/ui/components/base-node";
import { cn } from "@packages/ui/lib/utils";
import type { NodeProps } from "@xyflow/react";
import { Position } from "@xyflow/react";
import { AlertTriangle, Play } from "lucide-react";
import { validateActionNode } from "../lib/node-validation";
import type { ActionNode as ActionNodeType } from "../lib/types";
import { ACTION_TYPE_LABELS } from "../lib/types";
import { AutomationHandle } from "./automation-handle";

export function ActionNode({ data }: NodeProps<ActionNodeType>) {
   const validation = validateActionNode(data);
   const label = ACTION_TYPE_LABELS[data.actionType] ?? data.label;

   return (
      <BaseNode
         className={cn(
            "min-w-[200px]",
            validation.valid ? "border-blue-500" : "border-red-500",
         )}
      >
         <AutomationHandle
            className={cn(
               validation.valid ? "!border-blue-500" : "!border-red-500",
            )}
            id="top"
            position={Position.Top}
            type="target"
         />
         <AutomationHandle
            className={cn(
               validation.valid ? "!border-blue-500" : "!border-red-500",
            )}
            id="left"
            position={Position.Left}
            type="target"
         />
         <BaseNodeHeader
            className={cn(
               "rounded-t-md text-white",
               validation.valid ? "bg-blue-500" : "bg-red-500",
            )}
         >
            {!validation.valid && <AlertTriangle className="size-4" />}
            {validation.valid && <Play className="size-4" />}
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
            {data.continueOnError && (
               <div className="text-xs text-amber-600">
                  Continua em caso de erro
               </div>
            )}
         </BaseNodeContent>
         <AutomationHandle
            className={cn(
               validation.valid ? "!border-blue-500" : "!border-red-500",
            )}
            id="bottom"
            position={Position.Bottom}
            type="source"
         />
         <AutomationHandle
            className={cn(
               validation.valid ? "!border-blue-500" : "!border-red-500",
            )}
            id="right"
            position={Position.Right}
            type="source"
         />
      </BaseNode>
   );
}
