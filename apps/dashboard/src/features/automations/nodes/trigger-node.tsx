import {
   BaseNode,
   BaseNodeContent,
   BaseNodeHeader,
   BaseNodeHeaderTitle,
} from "@packages/ui/components/base-node";
import { getTriggerLabel } from "@packages/workflows/triggers/definitions";
import type { NodeProps } from "@xyflow/react";
import { Position } from "@xyflow/react";
import { Zap } from "lucide-react";
import type { TriggerNode as TriggerNodeType } from "../hooks/use-flow-serialization";
import { AutomationHandle } from "./automation-handle";

export function TriggerNode({ data }: NodeProps<TriggerNodeType>) {
   return (
      <BaseNode className="min-w-[200px] border-emerald-500">
         <BaseNodeHeader className="rounded-t-md bg-emerald-500 text-white">
            <Zap className="size-4" />
            <BaseNodeHeaderTitle className="text-sm">
               {data.label}
            </BaseNodeHeaderTitle>
         </BaseNodeHeader>
         <BaseNodeContent>
            <div className="text-xs text-muted-foreground">
               {getTriggerLabel(data.triggerType)}
            </div>
         </BaseNodeContent>
         <AutomationHandle
            className="!border-emerald-500"
            id="bottom"
            position={Position.Bottom}
            type="source"
         />
         <AutomationHandle
            className="!border-emerald-500"
            id="right"
            position={Position.Right}
            type="source"
         />
      </BaseNode>
   );
}
