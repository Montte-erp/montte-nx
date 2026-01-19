import { Badge } from "@packages/ui/components/badge";
import {
   BaseNode,
   BaseNodeContent,
   BaseNodeHeader,
   BaseNodeHeaderTitle,
} from "@packages/ui/components/base-node";
import { cn } from "@packages/ui/lib/utils";
import type { NodeProps } from "@xyflow/react";
import { Position } from "@xyflow/react";
import { AlertTriangle, Filter } from "lucide-react";
import type { ConditionNode as ConditionNodeType } from "../hooks/use-flow-serialization";
import { CONDITION_OPERATOR_LABELS } from "../hooks/use-flow-serialization";
import { validateConditionNode } from "../hooks/use-node-validation";
import { AutomationHandle } from "./automation-handle";

export function ConditionNode({ data }: NodeProps<ConditionNodeType>) {
   const validation = validateConditionNode(data);

   return (
      <BaseNode
         className={cn(
            "min-w-[200px]",
            validation.valid ? "border-amber-500" : "border-red-500",
         )}
      >
         <AutomationHandle
            className={cn(
               validation.valid ? "!border-amber-500" : "!border-red-500",
            )}
            id="top"
            position={Position.Top}
            type="target"
         />
         <AutomationHandle
            className={cn(
               validation.valid ? "!border-amber-500" : "!border-red-500",
            )}
            id="left"
            position={Position.Left}
            type="target"
         />
         <BaseNodeHeader
            className={cn(
               "rounded-t-md text-white",
               validation.valid ? "bg-amber-500" : "bg-red-500",
            )}
         >
            {!validation.valid && <AlertTriangle className="size-4" />}
            {validation.valid && <Filter className="size-4" />}
            <BaseNodeHeaderTitle className="text-sm">
               {data.label}
            </BaseNodeHeaderTitle>
            <Badge
               className={cn(
                  "text-white",
                  validation.valid ? "bg-amber-600" : "bg-red-600",
               )}
               variant="secondary"
            >
               {data.operator}
            </Badge>
         </BaseNodeHeader>
         <BaseNodeContent>
            {!validation.valid && (
               <div className="flex items-center gap-1 text-xs text-red-600">
                  <AlertTriangle className="size-3" />
                  {validation.errors[0]}
               </div>
            )}
            {validation.valid && data.conditions.length > 0 && (
               <div className="space-y-1">
                  {data.conditions.slice(0, 3).map((condition) => (
                     <div
                        className="text-xs text-muted-foreground"
                        key={condition.id}
                     >
                        {condition.field}{" "}
                        {CONDITION_OPERATOR_LABELS[condition.operator]}{" "}
                        {String(condition.value)}
                     </div>
                  ))}
                  {data.conditions.length > 3 && (
                     <div className="text-xs text-muted-foreground">
                        +{data.conditions.length - 3} mais
                     </div>
                  )}
               </div>
            )}
         </BaseNodeContent>
         <AutomationHandle
            className={cn(
               validation.valid ? "!border-amber-500" : "!border-red-500",
            )}
            id="bottom"
            position={Position.Bottom}
            type="source"
         />
         <AutomationHandle
            className={cn(
               validation.valid ? "!border-amber-500" : "!border-red-500",
            )}
            id="right"
            position={Position.Right}
            type="source"
         />
      </BaseNode>
   );
}
