import Dagre from "@dagrejs/dagre";
import {
   Background,
   BackgroundVariant,
   type Connection,
   type EdgeTypes,
   type NodeTypes,
   type OnEdgesChange,
   type OnNodesChange,
   Panel,
   ReactFlow,
   useReactFlow,
} from "@xyflow/react";
import {
   ClipboardList,
   Copy,
   FileText,
   FolderTree,
   GitBranch,
   Link2Off,
   Mail,
   Plus,
   Search,
   Settings,
   StopCircle,
   Tag,
   Trash2,
   Zap,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import "@xyflow/react/dist/style.css";
import type { ActionType, TriggerType } from "@packages/database/schema";
import {
   type ActionCategory,
   getUniqueCategories,
} from "@packages/workflows/config/actions";
import { DeletableEdge } from "../edges/deletable-edge";
import type { AutomationEdge, AutomationNode } from "../lib/types";
import { ActionNode } from "../nodes/action-node";
import { ConditionNode } from "../nodes/condition-node";
import { TriggerNode } from "../nodes/trigger-node";
import {
   ActionPickerDialog,
   type PickerMode,
   type PickerSelection,
} from "./action-picker-dialog";
import { CanvasToolbar, type ViewMode } from "./canvas-toolbar";

const nodeTypes: NodeTypes = {
   action: ActionNode,
   condition: ConditionNode,
   trigger: TriggerNode,
};

const edgeTypes: EdgeTypes = {
   deletable: DeletableEdge,
};

const NODE_WIDTH = 280;
const NODE_HEIGHT = 150;

// Menu dimensions for boundary calculations
const MENU_WIDTH = 220;
const MENU_HEIGHT = 400; // approximate max height
const MENU_PADDING = 10;

// Calculate menu position with viewport boundary checking
function calculateMenuPosition(
   x: number,
   y: number,
   menuWidth = MENU_WIDTH,
   menuHeight = MENU_HEIGHT,
): { x: number; y: number } {
   const viewportWidth = window.innerWidth;
   const viewportHeight = window.innerHeight;

   let adjustedX = x;
   let adjustedY = y;

   // If menu overflows right edge, move to left
   if (x + menuWidth > viewportWidth - MENU_PADDING) {
      adjustedX = viewportWidth - menuWidth - MENU_PADDING;
   }

   // If menu overflows bottom edge, move up
   if (y + menuHeight > viewportHeight - MENU_PADDING) {
      adjustedY = viewportHeight - menuHeight - MENU_PADDING;
   }

   // Ensure menu doesn't go off left edge
   if (adjustedX < MENU_PADDING) {
      adjustedX = MENU_PADDING;
   }

   // Ensure menu doesn't go off top edge
   if (adjustedY < MENU_PADDING) {
      adjustedY = MENU_PADDING;
   }

   return { x: adjustedX, y: adjustedY };
}

// Category labels and icons mapping
const CATEGORY_META: Record<
   ActionCategory,
   { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
   categorization: { label: "Categorização", icon: FolderTree },
   tagging: { label: "Tags", icon: Tag },
   modification: { label: "Modificação", icon: FileText },
   creation: { label: "Criação", icon: Plus },
   data: { label: "Dados", icon: ClipboardList },
   transformation: { label: "Transformação", icon: FileText },
   notification: { label: "Notificações", icon: Mail },
   control: { label: "Controle", icon: StopCircle },
};

function getAutoLayoutedNodes(
   nodes: AutomationNode[],
   edges: AutomationEdge[],
): AutomationNode[] {
   const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
   g.setGraph({ rankdir: "TB", nodesep: 80, ranksep: 120 });

   for (const node of nodes) {
      g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
   }

   for (const edge of edges) {
      g.setEdge(edge.source, edge.target);
   }

   Dagre.layout(g);

   return nodes.map((node) => {
      const position = g.node(node.id);
      const x = position.x - NODE_WIDTH / 2;
      const y = position.y - NODE_HEIGHT / 2;

      return { ...node, position: { x, y } };
   });
}

type MenuState = {
   type: "canvas" | "node";
   node?: AutomationNode;
   x: number;
   y: number;
   flowX: number;
   flowY: number;
} | null;

type AutomationCanvasProps = {
   nodes: AutomationNode[];
   edges: AutomationEdge[];
   onNodesChange: OnNodesChange<AutomationNode>;
   onEdgesChange: OnEdgesChange<AutomationEdge>;
   onConnect: (connection: Connection) => void;
   onNodeSelect?: (nodeId: string | null) => void;
   onAddNode?: (
      type: "trigger" | "condition" | "action",
      data: {
         triggerType?: TriggerType;
         actionType?: ActionType;
         operator?: "AND" | "OR";
      },
      position: { x: number; y: number },
   ) => void;
   onDeleteNode?: (nodeId: string) => void;
   onDuplicateNode?: (nodeId: string) => void;
   onAutoLayout?: (nodes: AutomationNode[]) => void;
   onOpenTemplates?: () => void;
   onTestRun?: () => void;
   isTestRunning?: boolean;
   isTestRunDisabled?: boolean;
   readOnly?: boolean;
   hasTrigger?: boolean;
   viewMode?: ViewMode;
   onViewModeChange?: (mode: ViewMode) => void;
};

export function AutomationCanvas({
   nodes,
   edges,
   onNodesChange,
   onEdgesChange,
   onConnect,
   onNodeSelect,
   onAddNode,
   onDeleteNode,
   onDuplicateNode,
   onAutoLayout,
   onOpenTemplates,
   onTestRun,
   isTestRunning = false,
   isTestRunDisabled = false,
   readOnly = false,
   hasTrigger = false,
   viewMode = "editor",
   onViewModeChange,
}: AutomationCanvasProps) {
   const { screenToFlowPosition, fitView } = useReactFlow();
   const ref = useRef<HTMLDivElement>(null);
   const [menu, setMenu] = useState<MenuState>(null);
   const [showConnections, setShowConnections] = useState(true);
   const [pickerOpen, setPickerOpen] = useState(false);
   const [pickerMode, setPickerMode] = useState<PickerMode | null>(null);
   const [nodePosition, setNodePosition] = useState<{
      x: number;
      y: number;
   } | null>(null);

   // Calculate adjusted menu position to prevent overflow
   const adjustedMenuPosition = useMemo(() => {
      if (!menu) return null;
      return calculateMenuPosition(menu.x, menu.y);
   }, [menu]);

   // Get all categories from config
   const allCategories = useMemo(() => getUniqueCategories(), []);

   const handleNodeClick = useCallback(
      (event: React.MouseEvent, node: AutomationNode) => {
         event.stopPropagation();
         onNodeSelect?.(node.id);
      },
      [onNodeSelect],
   );

   const handlePaneClick = useCallback(() => {
      onNodeSelect?.(null);
      setMenu(null);
      setPickerOpen(false);
   }, [onNodeSelect]);

   const handlePaneContextMenu = useCallback(
      (event: React.MouseEvent | MouseEvent) => {
         event.preventDefault();
         const flowPosition = screenToFlowPosition({
            x: event.clientX,
            y: event.clientY,
         });
         setMenu({
            type: "canvas",
            x: event.clientX,
            y: event.clientY,
            flowX: flowPosition.x,
            flowY: flowPosition.y,
         });
      },
      [screenToFlowPosition],
   );

   const handleNodeContextMenu = useCallback(
      (event: React.MouseEvent, node: AutomationNode) => {
         event.preventDefault();
         const flowPosition = screenToFlowPosition({
            x: event.clientX,
            y: event.clientY,
         });
         setMenu({
            type: "node",
            node,
            x: event.clientX,
            y: event.clientY,
            flowX: flowPosition.x,
            flowY: flowPosition.y,
         });
      },
      [screenToFlowPosition],
   );

   const handleConfigureNode = useCallback(() => {
      if (menu?.node) {
         onNodeSelect?.(menu.node.id);
      }
      setMenu(null);
   }, [menu, onNodeSelect]);

   const handleDeleteNode = useCallback(() => {
      if (menu?.node) {
         onDeleteNode?.(menu.node.id);
      }
      setMenu(null);
   }, [menu, onDeleteNode]);

   const handleDuplicateNode = useCallback(() => {
      if (menu?.node) {
         onDuplicateNode?.(menu.node.id);
      }
      setMenu(null);
   }, [menu, onDuplicateNode]);

   const { setEdges } = useReactFlow();

   const handleDisconnectNode = useCallback(() => {
      if (menu?.node) {
         setEdges((eds) =>
            eds.filter(
               (e) => e.source !== menu.node?.id && e.target !== menu.node?.id,
            ),
         );
      }
      setMenu(null);
   }, [menu, setEdges]);

   const nodeConnectionCount = useMemo(() => {
      if (!menu?.node) return 0;
      return edges.filter(
         (e) => e.source === menu.node?.id || e.target === menu.node?.id,
      ).length;
   }, [menu, edges]);

   const handleToggleConnections = useCallback(() => {
      setShowConnections((prev) => !prev);
   }, []);

   const handleAutoLayout = useCallback(() => {
      if (nodes.length === 0) return;
      const layoutedNodes = getAutoLayoutedNodes(nodes, edges);
      onAutoLayout?.(layoutedNodes);
      setTimeout(() => {
         fitView({ duration: 300, padding: 0.2 });
      }, 50);
   }, [nodes, edges, onAutoLayout, fitView]);

   // Open picker dialog for a specific mode
   const openPicker = useCallback(
      (mode: PickerMode) => {
         if (menu) {
            setNodePosition({ x: menu.flowX, y: menu.flowY });
         }
         setPickerMode(mode);
         setPickerOpen(true);
         setMenu(null); // Close context menu
      },
      [menu],
   );

   // Handle picker selection
   const handlePickerSelect = useCallback(
      (selection: PickerSelection) => {
         if (nodePosition) {
            onAddNode?.(selection.nodeType, selection.data, nodePosition);
         }
         setPickerOpen(false);
         setPickerMode(null);
         setNodePosition(null);
      },
      [nodePosition, onAddNode],
   );

   const defaultEdgeOptions = useMemo(
      () => ({
         animated: true,
         style: { strokeWidth: 2 },
         type: "deletable",
      }),
      [],
   );

   const visibleEdges = useMemo(
      () =>
         showConnections ? edges : edges.map((e) => ({ ...e, hidden: true })),
      [edges, showConnections],
   );

   const menuItemClass =
      "flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none hover:bg-accent hover:text-accent-foreground";
   const menuItemDestructiveClass =
      "flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none text-destructive hover:bg-destructive/10 hover:text-destructive";
   const separatorClass = "bg-border -mx-1 my-1 h-px";
   const labelClass = "px-2 py-1.5 text-sm font-medium flex items-center gap-2";

   if (readOnly) {
      return (
         <div className="relative size-full">
            <ReactFlow
               className="bg-muted/30"
               defaultEdgeOptions={defaultEdgeOptions}
               deleteKeyCode={null}
               edges={visibleEdges}
               edgeTypes={edgeTypes}
               elementsSelectable={false}
               fitView
               fitViewOptions={{ padding: 0.2 }}
               nodes={nodes}
               nodesConnectable={false}
               nodesDraggable={false}
               nodeTypes={nodeTypes}
               onConnect={onConnect}
               onEdgesChange={onEdgesChange}
               onNodesChange={onNodesChange}
            >
               <Background gap={16} size={1} variant={BackgroundVariant.Dots} />
               <CanvasToolbar
                  className="hidden md:flex"
                  isTestRunDisabled={isTestRunDisabled}
                  isTestRunning={isTestRunning}
                  onAutoLayout={handleAutoLayout}
                  onOpenTemplates={onOpenTemplates}
                  onTestRun={onTestRun}
                  onToggleConnections={handleToggleConnections}
                  onViewModeChange={onViewModeChange}
                  showConnections={showConnections}
                  viewMode={viewMode}
               />
            </ReactFlow>
         </div>
      );
   }

   return (
      <div className="relative size-full" ref={ref}>
         <ReactFlow
            className="bg-muted/30"
            defaultEdgeOptions={defaultEdgeOptions}
            deleteKeyCode={["Backspace", "Delete"]}
            edges={visibleEdges}
            edgeTypes={edgeTypes}
            elementsSelectable
            fitView
            fitViewOptions={{ padding: 0.2 }}
            nodes={nodes}
            nodesConnectable
            nodesDraggable
            nodeTypes={nodeTypes}
            onConnect={onConnect}
            onEdgesChange={onEdgesChange}
            onNodeClick={handleNodeClick}
            onNodeContextMenu={handleNodeContextMenu}
            onNodesChange={onNodesChange}
            onPaneClick={handlePaneClick}
            onPaneContextMenu={handlePaneContextMenu}
         >
            <Background gap={16} size={1} variant={BackgroundVariant.Dots} />

            <CanvasToolbar
               className="hidden md:flex"
               isTestRunDisabled={isTestRunDisabled}
               isTestRunning={isTestRunning}
               onAutoLayout={handleAutoLayout}
               onOpenTemplates={onOpenTemplates}
               onTestRun={onTestRun}
               onToggleConnections={handleToggleConnections}
               onViewModeChange={onViewModeChange}
               showConnections={showConnections}
               viewMode={viewMode}
            />

            {!nodes.length && (
               <Panel className="mt-20" position="top-center">
                  <div className="rounded-lg border bg-background p-6 text-center shadow-sm">
                     <div className="text-sm text-muted-foreground">
                        Clique com o botao direito para adicionar nos
                     </div>
                  </div>
               </Panel>
            )}
         </ReactFlow>

         {menu && menu.type === "canvas" && adjustedMenuPosition && (
            <div
               className="fixed z-50 min-w-[220px] rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
               style={{
                  top: adjustedMenuPosition.y,
                  left: adjustedMenuPosition.x,
               }}
            >
               <div className={labelClass}>
                  <Plus className="size-4" />
                  Adicionar Nó
               </div>
               <div className={separatorClass} />

               {/* All Actions - search across everything */}
               <div
                  className={menuItemClass}
                  onClick={() => openPicker({ type: "all" })}
               >
                  <Search className="size-4" />
                  Todas as Ações
               </div>

               <div className={separatorClass} />

               {/* Trigger */}
               {!hasTrigger && (
                  <div
                     className={menuItemClass}
                     onClick={() => openPicker({ type: "trigger" })}
                  >
                     <Zap className="size-4 text-yellow-500" />
                     Gatilho
                  </div>
               )}

               {/* Condition */}
               <div
                  className={menuItemClass}
                  onClick={() => openPicker({ type: "condition" })}
               >
                  <GitBranch className="size-4 text-blue-500" />
                  Condição
               </div>

               <div className={separatorClass} />

               {/* Action categories */}
               {allCategories.map((category) => {
                  const meta = CATEGORY_META[category];
                  const Icon = meta.icon;
                  return (
                     <div
                        className={menuItemClass}
                        key={category}
                        onClick={() =>
                           openPicker({ type: "category", category })
                        }
                     >
                        <Icon className="size-4" />
                        {meta.label}
                     </div>
                  );
               })}
            </div>
         )}

         {/* Action Picker Dialog */}
         {pickerMode && (
            <ActionPickerDialog
               hasTrigger={hasTrigger}
               mode={pickerMode}
               onOpenChange={setPickerOpen}
               onSelect={handlePickerSelect}
               open={pickerOpen}
            />
         )}

         {menu && menu.type === "node" && menu.node && adjustedMenuPosition && (
            <div
               className="fixed z-50 min-w-[180px] rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
               style={{
                  top: adjustedMenuPosition.y,
                  left: adjustedMenuPosition.x,
               }}
            >
               <div className={menuItemClass} onClick={handleConfigureNode}>
                  <Settings className="size-4" />
                  Configurar
               </div>
               {menu.node.type !== "trigger" && (
                  <div className={menuItemClass} onClick={handleDuplicateNode}>
                     <Copy className="size-4" />
                     Duplicar
                  </div>
               )}
               {nodeConnectionCount > 0 && (
                  <>
                     <div className={separatorClass} />
                     <div
                        className={menuItemClass}
                        onClick={handleDisconnectNode}
                     >
                        <Link2Off className="size-4" />
                        Remover Conexoes ({nodeConnectionCount})
                     </div>
                  </>
               )}
               <div className={separatorClass} />
               <div
                  className={menuItemDestructiveClass}
                  onClick={handleDeleteNode}
               >
                  <Trash2 className="size-4" />
                  Excluir
               </div>
            </div>
         )}
      </div>
   );
}
