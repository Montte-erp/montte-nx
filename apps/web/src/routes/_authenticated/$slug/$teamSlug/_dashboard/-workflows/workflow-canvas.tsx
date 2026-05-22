import { Button } from "@packages/ui/components/button";
import { cn } from "@packages/ui/lib/utils";
import "@xyflow/react/dist/style.css";
import {
   Background,
   BackgroundVariant,
   Handle,
   MarkerType,
   Position,
   ReactFlow,
   ReactFlowProvider,
   useEdgesState,
   useNodesState,
   useReactFlow,
   type Edge,
   type Node,
   type NodeMouseHandler,
   type NodeProps,
} from "@xyflow/react";
import {
   BadgeDollarSign,
   CalendarRange,
   ChartColumn,
   CircleDashed,
   LineChart,
   Maximize2,
   Minus,
   Plus,
   Tags,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, type ReactNode } from "react";
import type { Outputs } from "@/integrations/orpc/client";

const REPORT_ICONS: Record<WorkflowReportType, LucideIcon> = {
   dre: ChartColumn,
   "cash-flow": LineChart,
   "cost-centers": BadgeDollarSign,
   aging: CalendarRange,
   categories: Tags,
};

const REPORT_LABELS: Record<WorkflowReportType, string> = {
   dre: "DRE",
   "cash-flow": "Fluxo de caixa",
   "cost-centers": "Centro de Custo",
   aging: "A receber/pagar",
   categories: "Categorias",
};

const PERIOD_LABELS: Record<
   WorkflowGraph["nodes"][1]["data"]["period"]["kind"],
   string
> = {
   "previous-month": "Mês anterior",
   "previous-week": "Semana anterior",
   "current-month": "Mês atual",
   "current-week": "Semana atual",
};

type WorkflowGraph = Outputs["workflows"]["get"]["graph"];
type WorkflowReportType = WorkflowGraph["nodes"][1]["data"]["reportType"];
type WorkflowScheduleTriggerNode = Node<
   WorkflowGraph["nodes"][0]["data"],
   "scheduleTrigger"
>;
type WorkflowCreateReportNode = Node<
   WorkflowGraph["nodes"][1]["data"],
   "createReport"
>;
export type WorkflowFlowNode =
   | WorkflowScheduleTriggerNode
   | WorkflowCreateReportNode;

type WorkflowFlowEdge = Edge;

type WorkflowNodeShellProps = {
   children: ReactNode;
   selected?: boolean;
};

function buildFlowNodes(
   graph: WorkflowGraph,
   selectedNodeId?: string | null,
): WorkflowFlowNode[] {
   return graph.nodes.map((node, index) => {
      const position = node.position ?? { x: index * 340, y: 0 };
      if (node.type === "scheduleTrigger") {
         const scheduleNode: WorkflowScheduleTriggerNode = {
            id: node.id,
            type: "scheduleTrigger",
            data: node.data,
            position,
            selected: node.id === selectedNodeId,
         };
         return scheduleNode;
      }

      const reportNode: WorkflowCreateReportNode = {
         id: node.id,
         type: "createReport",
         data: node.data,
         position,
         selected: node.id === selectedNodeId,
      };
      return reportNode;
   });
}

function buildFlowEdges(graph: WorkflowGraph): WorkflowFlowEdge[] {
   return graph.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: "smoothstep",
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
      className: "stroke-muted-foreground/40",
   }));
}

function WorkflowNodeShell({ children, selected }: WorkflowNodeShellProps) {
   return (
      <div
         className={cn(
            "relative w-[300px] rounded-2xl border bg-popover/95 p-3 text-popover-foreground shadow-sm backdrop-blur transition-all duration-150",
            "hover:border-foreground/20 hover:shadow-md",
            selected && "border-primary ring-2 ring-primary/20",
         )}
      >
         {children}
      </div>
   );
}

function FlowHandle({
   position,
   type,
}: {
   position: Position;
   type: "source" | "target";
}) {
   return (
      <Handle
         className="size-2.5 border border-background bg-muted-foreground"
         position={position}
         type={type}
      />
   );
}

function WorkflowScheduleTriggerNodeView({
   data,
   selected,
}: NodeProps<WorkflowScheduleTriggerNode>) {
   return (
      <WorkflowNodeShell selected={selected}>
         <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
               <CircleDashed className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
               <p className="truncate text-sm font-medium">Quando</p>
               <p className="text-muted-foreground truncate text-xs">
                  {data.humanLabel}
               </p>
            </div>
         </div>
         <div className="mt-3 flex items-center justify-between gap-3 text-xs">
            <span className="text-muted-foreground">Cron</span>
            <code className="truncate font-medium">{data.cron}</code>
         </div>
         <FlowHandle position={Position.Right} type="source" />
      </WorkflowNodeShell>
   );
}

function WorkflowCreateReportNodeView({
   data,
   selected,
}: NodeProps<WorkflowCreateReportNode>) {
   const ReportIcon = REPORT_ICONS[data.reportType];
   return (
      <WorkflowNodeShell selected={selected}>
         <FlowHandle position={Position.Left} type="target" />
         <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
               <ReportIcon className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
               <p className="truncate text-sm font-medium">Então</p>
               <p className="text-muted-foreground truncate text-xs">
                  Criar relatório {REPORT_LABELS[data.reportType]}
               </p>
            </div>
         </div>
         <div className="mt-3 flex items-center justify-between gap-3 text-xs">
            <span className="text-muted-foreground">
               {PERIOD_LABELS[data.period.kind]}
            </span>
            <span className="truncate font-medium">{data.nameTemplate}</span>
         </div>
      </WorkflowNodeShell>
   );
}

const nodeTypes = {
   scheduleTrigger: WorkflowScheduleTriggerNodeView,
   createReport: WorkflowCreateReportNodeView,
};

export type WorkflowNodePosition = { id: string; x: number; y: number };

export function WorkflowCanvas({
   graph,
   selectedNodeId,
   onNodeClick,
   onPaneClick,
   onNodePositionsChange,
}: {
   graph: WorkflowGraph;
   selectedNodeId?: string | null;
   onNodeClick?: (node: WorkflowFlowNode) => void;
   onPaneClick?: () => void;
   onNodePositionsChange?: (positions: WorkflowNodePosition[]) => void;
}) {
   const initialNodes = useMemo(
      () => buildFlowNodes(graph, selectedNodeId),
      [graph, selectedNodeId],
   );
   const initialEdges = useMemo(() => buildFlowEdges(graph), [graph]);

   const [nodes, setNodes, onNodesChange] =
      useNodesState<WorkflowFlowNode>(initialNodes);
   const [edges, , onEdgesChange] = useEdgesState(initialEdges);

   useEffect(() => {
      setNodes(buildFlowNodes(graph, selectedNodeId));
   }, [graph, selectedNodeId, setNodes]);

   const handleNodeClick: NodeMouseHandler<WorkflowFlowNode> = (_, node) => {
      onNodeClick?.(node);
   };

   const handleNodeDragStop: NodeMouseHandler<WorkflowFlowNode> = () => {
      if (!onNodePositionsChange) return;
      onNodePositionsChange(
         nodes.map((node) => ({
            id: node.id,
            x: node.position.x,
            y: node.position.y,
         })),
      );
   };

   return (
      <div className="relative h-full min-h-0 w-full flex-1 overflow-hidden">
         <ReactFlowProvider>
            <ReactFlow
               className="workflow-react-flow h-full w-full"
               edges={edges}
               fitView
               fitViewOptions={{ padding: 0.35 }}
               maxZoom={1.4}
               minZoom={0.35}
               nodes={nodes}
               nodesConnectable={false}
               nodesDraggable
               nodeTypes={nodeTypes}
               onEdgesChange={onEdgesChange}
               onNodeClick={handleNodeClick}
               onNodeDragStop={handleNodeDragStop}
               onNodesChange={onNodesChange}
               onPaneClick={onPaneClick}
               panOnDrag
               proOptions={{ hideAttribution: true }}
               zoomOnDoubleClick={false}
            >
               <Background
                  color="var(--primary)"
                  gap={28}
                  size={1.6}
                  variant={BackgroundVariant.Dots}
               />
               <RailwayControls />
            </ReactFlow>
         </ReactFlowProvider>
      </div>
   );
}

function RailwayControls() {
   const { zoomIn, zoomOut, fitView } = useReactFlow();
   const buttonClass =
      "rounded-none border-border border-b last:border-b-0 text-muted-foreground hover:text-foreground";
   return (
      <div className="bg-popover/85 absolute bottom-4 left-4 z-10 flex flex-col overflow-hidden rounded-xl border shadow-sm backdrop-blur">
         <Button
            className={buttonClass}
            onClick={() => zoomIn({ duration: 160 })}
            size="icon"
            tooltip="Aproximar"
            tooltipSide="right"
            variant="ghost"
         >
            <Plus />
         </Button>
         <Button
            className={buttonClass}
            onClick={() => zoomOut({ duration: 160 })}
            size="icon"
            tooltip="Afastar"
            tooltipSide="right"
            variant="ghost"
         >
            <Minus />
         </Button>
         <Button
            className={buttonClass}
            onClick={() => fitView({ duration: 240, padding: 0.35 })}
            size="icon"
            tooltip="Ajustar à tela"
            tooltipSide="right"
            variant="ghost"
         >
            <Maximize2 />
         </Button>
      </div>
   );
}
