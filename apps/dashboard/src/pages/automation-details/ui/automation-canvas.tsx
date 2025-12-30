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
   ArrowLeftRight,
   Bell,
   Building,
   ChevronRight,
   ClipboardList,
   Copy,
   FileText,
   FolderTree,
   GitBranch,
   Link2Off,
   Mail,
   Play,
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
import { DeletableEdge } from "../edges/deletable-edge";
import type { AutomationEdge, AutomationNode } from "../lib/types";
import { ActionNode } from "../nodes/action-node";
import { ConditionNode } from "../nodes/condition-node";
import { TriggerNode } from "../nodes/trigger-node";
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
const SUBMENU_WIDTH = 220;
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

// Determine submenu position based on available space
function getSubmenuPosition(menuX: number): "left" | "right" {
   const spaceOnRight = window.innerWidth - menuX - MENU_WIDTH;
   return spaceOnRight > SUBMENU_WIDTH + MENU_PADDING ? "right" : "left";
}

// Action categories for organized menu
type ActionItem = {
   type: ActionType;
   label: string;
   icon: React.ComponentType<{ className?: string }>;
   description: string;
};

type ActionCategory = {
   id: string;
   label: string;
   actions: ActionItem[];
};

const ACTION_CATEGORIES: ActionCategory[] = [
   {
      id: "categorization",
      label: "Categorização",
      actions: [
         { type: "set_category", label: "Definir Categoria", icon: FolderTree, description: "Atribuir categoria à transação" },
         { type: "set_cost_center", label: "Definir Centro de Custo", icon: Building, description: "Atribuir centro de custo" },
      ],
   },
   {
      id: "tagging",
      label: "Tags",
      actions: [
         { type: "add_tag", label: "Adicionar Tag", icon: Tag, description: "Adicionar tags à transação" },
         { type: "remove_tag", label: "Remover Tag", icon: Tag, description: "Remover tags da transação" },
      ],
   },
   {
      id: "modification",
      label: "Modificação",
      actions: [
         { type: "update_description", label: "Atualizar Descrição", icon: FileText, description: "Modificar descrição da transação" },
         { type: "mark_as_transfer", label: "Marcar como Transferência", icon: ArrowLeftRight, description: "Converter para transferência entre contas" },
      ],
   },
   {
      id: "creation",
      label: "Criação",
      actions: [
         { type: "create_transaction", label: "Criar Transação", icon: Plus, description: "Criar nova transação baseada no evento" },
      ],
   },
   {
      id: "data",
      label: "Dados",
      actions: [
         { type: "fetch_bills_report", label: "Buscar Relatório de Contas", icon: ClipboardList, description: "Buscar contas a pagar/receber" },
      ],
   },
   {
      id: "transformation",
      label: "Transformação",
      actions: [
         { type: "format_data", label: "Formatar Dados", icon: FileText, description: "Converter dados para CSV, PDF, HTML ou JSON" },
      ],
   },
   {
      id: "notification",
      label: "Notificações",
      actions: [
         { type: "send_email", label: "Enviar E-mail", icon: Mail, description: "Enviar email com template ou personalizado" },
         { type: "send_push_notification", label: "Enviar Push", icon: Bell, description: "Enviar notificação push" },
         { type: "send_bills_digest", label: "Resumo de Contas", icon: ClipboardList, description: "Enviar resumo de contas por email" },
      ],
   },
   {
      id: "control",
      label: "Controle",
      actions: [
         { type: "stop_execution", label: "Parar Execução", icon: StopCircle, description: "Parar processamento de regras" },
      ],
   },
];

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
   readOnly = false,
   hasTrigger = false,
   viewMode = "editor",
   onViewModeChange,
}: AutomationCanvasProps) {
   const { screenToFlowPosition, fitView } = useReactFlow();
   const ref = useRef<HTMLDivElement>(null);
   const [menu, setMenu] = useState<MenuState>(null);
   const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);
   const [showConnections, setShowConnections] = useState(true);
   const [actionSearch, setActionSearch] = useState("");

   // Calculate adjusted menu position to prevent overflow
   const adjustedMenuPosition = useMemo(() => {
      if (!menu) return null;
      return calculateMenuPosition(menu.x, menu.y);
   }, [menu]);

   // Calculate submenu position (left or right) based on available space
   const submenuSide = useMemo(() => {
      if (!menu) return "right";
      return getSubmenuPosition(menu.x);
   }, [menu]);

   // Filter actions based on search query
   const filteredActionCategories = useMemo(() => {
      if (!actionSearch.trim()) return ACTION_CATEGORIES;

      const searchLower = actionSearch.toLowerCase();
      return ACTION_CATEGORIES.map((category) => ({
         ...category,
         actions: category.actions.filter(
            (action) =>
               action.label.toLowerCase().includes(searchLower) ||
               action.description.toLowerCase().includes(searchLower),
         ),
      })).filter((category) => category.actions.length > 0);
   }, [actionSearch]);

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
      setOpenSubmenu(null);
      setActionSearch("");
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
         setOpenSubmenu(null);
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
         setOpenSubmenu(null);
      },
      [screenToFlowPosition],
   );

   const handleAddNode = useCallback(
      (
         type: "trigger" | "condition" | "action",
         data: {
            triggerType?: TriggerType;
            actionType?: ActionType;
            operator?: "AND" | "OR";
         },
      ) => {
         if (menu) {
            onAddNode?.(type, data, { x: menu.flowX, y: menu.flowY });
         }
         setMenu(null);
         setOpenSubmenu(null);
         setActionSearch("");
      },
      [menu, onAddNode],
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
   const submenuTriggerClass =
      "flex cursor-default items-center justify-between rounded-sm px-2 py-1.5 text-sm outline-none select-none hover:bg-accent hover:text-accent-foreground";
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
                  onAutoLayout={handleAutoLayout}
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
               onAutoLayout={handleAutoLayout}
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
               style={{ top: adjustedMenuPosition.y, left: adjustedMenuPosition.x }}
            >
               <div className={labelClass}>
                  <Plus className="size-4" />
                  Adicionar No
               </div>
               <div className={separatorClass} />

               {!hasTrigger && (
                  <div
                     className="relative"
                     onMouseEnter={() => setOpenSubmenu("trigger")}
                     onMouseLeave={() => setOpenSubmenu(null)}
                  >
                     <div className={submenuTriggerClass}>
                        <span className="flex items-center gap-2">
                           <Zap className="size-4 text-yellow-500" />
                           Gatilho
                        </span>
                        <ChevronRight className="size-4" />
                     </div>
                     {openSubmenu === "trigger" && (
                        <div
                           className={`absolute top-0 z-50 min-w-[180px] rounded-md border bg-popover p-1 text-popover-foreground shadow-md ${submenuSide === "right" ? "left-full ml-1" : "right-full mr-1"}`}
                        >
                           <div
                              className={menuItemClass}
                              onClick={() =>
                                 handleAddNode("trigger", {
                                    triggerType: "transaction.created",
                                 })
                              }
                           >
                              <Play className="size-4" />
                              Transacao Criada
                           </div>
                           <div
                              className={menuItemClass}
                              onClick={() =>
                                 handleAddNode("trigger", {
                                    triggerType: "transaction.updated",
                                 })
                              }
                           >
                              <FileText className="size-4" />
                              Transacao Atualizada
                           </div>
                        </div>
                     )}
                  </div>
               )}

               <div
                  className="relative"
                  onMouseEnter={() => setOpenSubmenu("condition")}
                  onMouseLeave={() => setOpenSubmenu(null)}
               >
                  <div className={submenuTriggerClass}>
                     <span className="flex items-center gap-2">
                        <GitBranch className="size-4 text-blue-500" />
                        Condicao
                     </span>
                     <ChevronRight className="size-4" />
                  </div>
                  {openSubmenu === "condition" && (
                     <div className={`absolute top-0 z-50 min-w-[220px] rounded-md border bg-popover p-1 text-popover-foreground shadow-md ${submenuSide === "right" ? "left-full ml-1" : "right-full mr-1"}`}>
                        <div
                           className={menuItemClass}
                           onClick={() =>
                              handleAddNode("condition", { operator: "AND" })
                           }
                        >
                           <GitBranch className="size-4" />E (todas devem
                           corresponder)
                        </div>
                        <div
                           className={menuItemClass}
                           onClick={() =>
                              handleAddNode("condition", { operator: "OR" })
                           }
                        >
                           <GitBranch className="size-4" />
                           OU (qualquer pode corresponder)
                        </div>
                     </div>
                  )}
               </div>

               <div
                  className="relative"
                  onMouseEnter={() => setOpenSubmenu("action")}
                  onMouseLeave={() => setOpenSubmenu(null)}
               >
                  <div className={submenuTriggerClass}>
                     <span className="flex items-center gap-2">
                        <Play className="size-4 text-green-500" />
                        Acao
                     </span>
                     <ChevronRight className="size-4" />
                  </div>
                  {openSubmenu === "action" && (
                     <div className={`absolute top-0 z-50 min-w-[260px] max-h-[70vh] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md ${submenuSide === "right" ? "left-full ml-1" : "right-full mr-1"}`}>
                        {/* Search input */}
                        <div className="p-2 border-b">
                           <div className="relative">
                              <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                              <input
                                 type="text"
                                 placeholder="Buscar ação..."
                                 value={actionSearch}
                                 onChange={(e) => setActionSearch(e.target.value)}
                                 className="w-full pl-8 pr-2 py-1.5 text-sm bg-transparent border rounded-sm focus:outline-none focus:ring-1 focus:ring-ring"
                                 autoFocus
                              />
                           </div>
                        </div>

                        {/* Categorized actions */}
                        <div className="overflow-y-auto max-h-[calc(70vh-60px)] p-1">
                           {filteredActionCategories.length === 0 ? (
                              <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                                 Nenhuma ação encontrada
                              </div>
                           ) : (
                              filteredActionCategories.map((category, categoryIndex) => (
                                 <div key={category.id}>
                                    {categoryIndex > 0 && <div className={separatorClass} />}
                                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                       {category.label}
                                    </div>
                                    {category.actions.map((action) => {
                                       const ActionIcon = action.icon;
                                       return (
                                          <div
                                             key={action.type}
                                             className={menuItemClass}
                                             onClick={() => handleAddNode("action", { actionType: action.type })}
                                             title={action.description}
                                          >
                                             <ActionIcon className="size-4" />
                                             <span className="flex-1">{action.label}</span>
                                          </div>
                                       );
                                    })}
                                 </div>
                              ))
                           )}
                        </div>
                     </div>
                  )}
               </div>
            </div>
         )}

         {menu && menu.type === "node" && menu.node && adjustedMenuPosition && (
            <div
               className="fixed z-50 min-w-[180px] rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
               style={{ top: adjustedMenuPosition.y, left: adjustedMenuPosition.x }}
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
