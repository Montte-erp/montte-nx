import type {
   ActionType,
   ConditionEvaluationLogResult,
   ConsequenceExecutionLogResult,
   TriggeredBy,
   TriggerType,
} from "@packages/database/schema";
import type { AutomationTemplate } from "@packages/database/repositories/automation-template-repository";
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import { ScrollArea } from "@packages/ui/components/scroll-area";
import { Skeleton } from "@packages/ui/components/skeleton";
import { cn } from "@packages/ui/lib/utils";
import { getAction, getActionTabs } from "@packages/workflows/config/actions";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
   addEdge,
   type Connection,
   ReactFlowProvider,
   useEdgesState,
   useNodesState,
   useReactFlow,
} from "@xyflow/react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
   Activity,
   AlertTriangle,
   CheckCircle2,
   ChevronDown,
   ChevronUp,
   CircleSlash,
   Filter,
   Pencil,
   Play,
   SkipForward,
   Trash2,
   X,
   XCircle,
   Zap,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/integrations/clients";
import {
   createDefaultActionNode,
   createDefaultConditionNode,
   createDefaultTriggerNode,
} from "../lib/flow-serialization";
import type { ActionNodeData, AutomationEdge, AutomationNode } from "../lib/types";
import { AutomationCanvas } from "./automation-canvas";
import { AutomationVersionHistoryView } from "./automation-version-history-view";
import type { ViewMode } from "./canvas-toolbar";
import { NodeConfigurationPanel } from "./node-configuration-panel";
import { TemplatesPickerDialog } from "./templates-picker-dialog";

type AutomationBuilderProps = {
   automationId?: string;
   initialNodes?: AutomationNode[];
   initialEdges?: AutomationEdge[];
   onChange?: (nodes: AutomationNode[], edges: AutomationEdge[]) => void;
   onViewModeChange?: (mode: ViewMode) => void;
   readOnly?: boolean;
};

function AutomationBuilderContent({
   automationId,
   initialNodes = [],
   initialEdges = [],
   onChange,
   onViewModeChange,
   readOnly = false,
}: AutomationBuilderProps) {
   const [nodes, setNodes, onNodesChange] =
      useNodesState<AutomationNode>(initialNodes);
   const [edges, setEdges, onEdgesChange] =
      useEdgesState<AutomationEdge>(initialEdges);
   const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
   const [viewMode, setViewMode] = useState<ViewMode>("editor");
   const [templatesDialogOpen, setTemplatesDialogOpen] = useState(false);
   const { fitView } = useReactFlow();
   const trpc = useTRPC();

   // Test run mutation
   const testRunMutation = useMutation(
      trpc.automations.triggerManually.mutationOptions({
         onError: (error) => {
            toast.error(`Erro ao testar automação: ${error.message}`);
         },
         onSuccess: (data) => {
            toast.success(
               `Automação executada! Job ID: ${data.jobId}`,
            );
         },
      }),
   );

   const handleTestRun = useCallback(() => {
      if (!automationId) return;
      testRunMutation.mutate({
         dryRun: false,
         ruleId: automationId,
      });
   }, [automationId, testRunMutation]);

   useEffect(() => {
      onViewModeChange?.(viewMode);
   }, [viewMode, onViewModeChange]);

   const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;
   const hasTrigger = nodes.some((n) => n.type === "trigger");

   // Handle opening templates dialog
   const handleOpenTemplates = useCallback(() => {
      setTemplatesDialogOpen(true);
   }, []);

   // Handle applying a template
   const handleApplyTemplate = useCallback(
      (template: AutomationTemplate) => {
         // Extract nodes and edges from template flowData
         const flowData = template.flowData as {
            nodes?: AutomationNode[];
            edges?: AutomationEdge[];
         };

         const templateNodes = flowData?.nodes ?? [];
         const templateEdges = flowData?.edges ?? [];

         // Update canvas with template data
         setNodes(templateNodes);
         setEdges(templateEdges);
         onChange?.(templateNodes, templateEdges);

         // Close dialog and fit view
         setTemplatesDialogOpen(false);
         setTimeout(() => fitView({ duration: 300, padding: 0.2 }), 50);
      },
      [setNodes, setEdges, onChange, fitView],
   );

   const onConnect = useCallback(
      (connection: Connection) => {
         if (readOnly) return;
         setEdges((eds) => {
            const newEdges = addEdge(connection, eds);
            onChange?.(nodes, newEdges);
            return newEdges;
         });
      },
      [setEdges, readOnly, nodes, onChange],
   );

   const handleNodeSelect = useCallback((nodeId: string | null) => {
      setSelectedNodeId(nodeId);
   }, []);

   const handleNodeUpdate = useCallback(
      (nodeId: string, data: Partial<AutomationNode["data"]>) => {
         setNodes((nds) => {
            const newNodes = nds.map((n) =>
               n.id === nodeId
                  ? ({ ...n, data: { ...n.data, ...data } } as AutomationNode)
                  : n,
            );
            onChange?.(newNodes, edges);
            return newNodes;
         });
      },
      [setNodes, edges, onChange],
   );

   const handleAddNode = useCallback(
      (
         type: "trigger" | "condition" | "action",
         data: {
            triggerType?: TriggerType;
            actionType?: ActionType;
            operator?: "AND" | "OR";
         },
         position: { x: number; y: number },
      ) => {
         let newNode: AutomationNode | null = null;

         if (type === "trigger" && data.triggerType) {
            newNode = createDefaultTriggerNode(data.triggerType);
            newNode.position = position;
         } else if (type === "condition" && data.operator) {
            newNode = createDefaultConditionNode(data.operator, position);
         } else if (type === "action" && data.actionType) {
            newNode = createDefaultActionNode(data.actionType, {}, position);
         }

         if (newNode) {
            const newNodes = [...nodes, newNode];
            setNodes(newNodes);
            onChange?.(newNodes, edges);
            setTimeout(() => fitView({ duration: 300 }), 50);
         }
      },
      [nodes, edges, setNodes, onChange, fitView],
   );

   const handleDeleteNode = useCallback(
      (nodeId: string) => {
         const newNodes = nodes.filter((n) => n.id !== nodeId);
         const newEdges = edges.filter(
            (e) => e.source !== nodeId && e.target !== nodeId,
         );
         setNodes(newNodes);
         setEdges(newEdges);
         onChange?.(newNodes, newEdges);
         if (selectedNodeId === nodeId) {
            setSelectedNodeId(null);
         }
      },
      [nodes, edges, setNodes, setEdges, onChange, selectedNodeId],
   );

   const handleDuplicateNode = useCallback(
      (nodeId: string) => {
         const nodeToDuplicate = nodes.find((n) => n.id === nodeId);
         if (!nodeToDuplicate || nodeToDuplicate.type === "trigger") return;

         const newPosition = {
            x: nodeToDuplicate.position.x + 50,
            y: nodeToDuplicate.position.y + 50,
         };

         let duplicatedNode: AutomationNode | null = null;

         if (nodeToDuplicate.type === "condition") {
            duplicatedNode = createDefaultConditionNode(
               nodeToDuplicate.data.operator,
               newPosition,
            );
            duplicatedNode.data = { ...nodeToDuplicate.data };
         } else if (nodeToDuplicate.type === "action") {
            duplicatedNode = createDefaultActionNode(
               nodeToDuplicate.data.actionType,
               nodeToDuplicate.data.config ?? {},
               newPosition,
            );
            duplicatedNode.data = { ...nodeToDuplicate.data };
         }

         if (duplicatedNode) {
            const newNodes = [...nodes, duplicatedNode];
            setNodes(newNodes);
            onChange?.(newNodes, edges);
         }
      },
      [nodes, edges, setNodes, onChange],
   );

   const handleAutoLayout = useCallback(
      (layoutedNodes: AutomationNode[]) => {
         setNodes(layoutedNodes);
         onChange?.(layoutedNodes, edges);
      },
      [setNodes, edges, onChange],
   );

   const handleClosePanel = useCallback(() => {
      setSelectedNodeId(null);
   }, []);

   return (
      <div className="relative h-full w-full">
         <div className="size-full">
            {viewMode === "history" && automationId ? (
               <AutomationVersionHistoryView
                  automationId={automationId}
                  onBackToEditor={() => setViewMode("editor")}
               />
            ) : (
               <AutomationCanvas
                  edges={edges}
                  hasTrigger={hasTrigger}
                  isTestRunDisabled={!automationId || readOnly}
                  isTestRunning={testRunMutation.isPending}
                  nodes={nodes}
                  onAddNode={handleAddNode}
                  onAutoLayout={handleAutoLayout}
                  onConnect={onConnect}
                  onDeleteNode={handleDeleteNode}
                  onDuplicateNode={handleDuplicateNode}
                  onEdgesChange={onEdgesChange}
                  onNodeSelect={handleNodeSelect}
                  onNodesChange={onNodesChange}
                  onOpenTemplates={handleOpenTemplates}
                  onTestRun={automationId ? handleTestRun : undefined}
                  onViewModeChange={automationId ? setViewMode : undefined}
                  readOnly={readOnly}
                  viewMode={viewMode}
               />
            )}

            {automationId && viewMode === "editor" && (
               <ActivityPanel automationId={automationId} />
            )}
         </div>

         {selectedNode && !readOnly && viewMode === "editor" && (
            <NodeDetailsPanel
               node={selectedNode}
               onClose={handleClosePanel}
               onDelete={handleDeleteNode}
               onUpdate={handleNodeUpdate}
            />
         )}

         <TemplatesPickerDialog
            open={templatesDialogOpen}
            onOpenChange={setTemplatesDialogOpen}
            onSelect={handleApplyTemplate}
         />
      </div>
   );
}

const NODE_TYPE_CONFIG = {
   action: {
      color: "text-emerald-500",
      icon: Play,
      label: "Ação",
   },
   condition: {
      color: "text-amber-500",
      icon: Filter,
      label: "Condição",
   },
   trigger: {
      color: "text-blue-500",
      icon: Zap,
      label: "Gatilho",
   },
};

type NodeDetailsPanelProps = {
   node: AutomationNode;
   onClose: () => void;
   onDelete: (nodeId: string) => void;
   onUpdate: (nodeId: string, data: Partial<AutomationNode["data"]>) => void;
};

function EditableTitle({
   value,
   onChange,
   placeholder,
}: {
   value: string;
   onChange: (value: string) => void;
   placeholder?: string;
}) {
   const [isEditing, setIsEditing] = useState(false);
   const [localValue, setLocalValue] = useState(value);
   const inputRef = useRef<HTMLInputElement>(null);

   useEffect(() => {
      setLocalValue(value);
   }, [value]);

   useEffect(() => {
      if (isEditing && inputRef.current) {
         inputRef.current.focus();
         inputRef.current.select();
      }
   }, [isEditing]);

   const handleSave = () => {
      setIsEditing(false);
      const trimmed = localValue.trim();
      if (trimmed && trimmed !== value) {
         onChange(trimmed);
      } else {
         setLocalValue(value || placeholder || "");
      }
   };

   const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
         handleSave();
      } else if (e.key === "Escape") {
         setLocalValue(value || placeholder || "");
         setIsEditing(false);
      }
   };

   if (isEditing) {
      return (
         <input
            className="flex-1 bg-transparent text-lg font-semibold outline-none border-b border-primary"
            onBlur={handleSave}
            onChange={(e) => setLocalValue(e.target.value)}
            onKeyDown={handleKeyDown}
            ref={inputRef}
            value={localValue}
         />
      );
   }

   return (
      <button
         className="group flex flex-1 items-center gap-2 text-left"
         onClick={() => setIsEditing(true)}
         type="button"
      >
         <span className="text-lg font-semibold border-b border-transparent group-hover:border-muted-foreground/50 transition-colors">
            {value || placeholder}
         </span>
         <Pencil className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
   );
}

function NodeDetailsPanel({
   node,
   onClose,
   onDelete,
   onUpdate,
}: NodeDetailsPanelProps) {
   const nodeType = node.type as keyof typeof NODE_TYPE_CONFIG;
   const config = NODE_TYPE_CONFIG[nodeType];
   const NodeIcon = config.icon;

   // Get action definition from config for dynamic tabs
   const actionType = node.type === "action" ? (node.data as ActionNodeData).actionType : null;
   const actionDefinition = actionType ? getAction(actionType) : null;
   const actionTabs = actionType ? getActionTabs(actionType) : [];

   // Determine if action has special documentation (for "about" tab)
   const hasAboutTab =
      actionDefinition?.documentation !== undefined ||
      actionType === "fetch_bills_report" ||
      actionType === "format_data" ||
      actionType === "send_email";

   // Build tabs array from config
   type TabType = "config" | "about" | "filters" | "settings" | string;
   
   // Determine initial tab based on action config
   const initialTab = actionTabs.length > 0 
      ? (actionDefinition?.defaultTab ?? actionTabs[0]?.id ?? "config")
      : "config";
   const [activeTab, setActiveTab] = useState<TabType>(initialTab);

   // Reset to appropriate tab when node changes
   useEffect(() => {
      const newInitialTab = actionTabs.length > 0 
         ? (actionDefinition?.defaultTab ?? actionTabs[0]?.id ?? "config")
         : "config";
      setActiveTab(newInitialTab);
   }, [node.id, actionTabs.length, actionDefinition?.defaultTab]);

   // Build tabs dynamically from action config
   const tabs: { id: TabType; label: string }[] = [];
   
   // Only add "Geral" if action has NO custom tabs defined
   if (actionTabs.length === 0) {
      tabs.push({ id: "config", label: "Geral" });
   }
   
   // Add custom tabs from action config (sorted by order)
   tabs.push(
      ...actionTabs
         .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
         .map((tab) => ({ id: tab.id, label: tab.label }))
   );
   
   // Add "about" tab for actions with documentation
   if (hasAboutTab) {
      tabs.push({ id: "about", label: "Sobre" });
   }
   
   // Always add settings tab
   tabs.push({ id: "settings", label: "Avançado" });

   // Determine which tabs go to NodeConfigurationPanel
   const configPanelTabs = ["config", "about", ...actionTabs.map((t) => t.id)];
   const isConfigPanelTab = configPanelTabs.includes(activeTab);

   return (
      <div className="absolute right-0 top-14 bottom-0 z-20 flex w-[400px] flex-col rounded-tl-xl border-l border-t bg-background shadow-xl">
         <div className="flex items-center gap-3 border-b px-4 py-3">
            <NodeIcon className={cn("size-5 shrink-0", config.color)} />
            <EditableTitle
               onChange={(newLabel) => onUpdate(node.id, { label: newLabel })}
               placeholder={config.label}
               value={node.data.label}
            />
            <Button
               className="ml-auto size-8 shrink-0"
               onClick={onClose}
               size="icon"
               variant="ghost"
            >
               <X className="size-4" />
            </Button>
         </div>

         <div className="flex gap-4 border-b px-4 overflow-x-auto">
            {tabs.map((tab) => (
               <button
                  key={tab.id}
                  className={cn(
                     "relative shrink-0 py-2.5 text-sm font-medium transition-colors",
                     activeTab === tab.id
                        ? "text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => setActiveTab(tab.id)}
                  type="button"
               >
                  {tab.label}
                  {activeTab === tab.id && (
                     <span className="absolute inset-x-0 -bottom-px h-0.5 bg-primary" />
                  )}
               </button>
            ))}
         </div>

         <ScrollArea className="flex-1">
            <div className="p-4">
               {isConfigPanelTab && (
                  <NodeConfigurationPanel
                     node={node}
                     onClose={onClose}
                     onUpdate={onUpdate}
                     activeTab={activeTab as "config" | "about" | "filters"}
                  />
               )}
               {activeTab === "settings" && (
                  <div className="space-y-4">
                     <div className="rounded-md border p-3">
                        <p className="text-xs text-muted-foreground">
                           ID do Node
                        </p>
                        <p className="font-mono text-sm">{node.id}</p>
                     </div>
                     <div className="rounded-md border p-3">
                        <p className="text-xs text-muted-foreground">Tipo</p>
                        <p className="text-sm">{config.label}</p>
                     </div>
                     <Button
                        className="w-full"
                        onClick={() => {
                           onDelete(node.id);
                           onClose();
                        }}
                        variant="destructive"
                     >
                        <Trash2 className="mr-2 size-4" />
                        Deletar Node
                     </Button>
                  </div>
               )}
            </div>
         </ScrollArea>
      </div>
   );
}

type ExecutionStatus = "success" | "partial" | "failed" | "skipped";

const STATUS_CONFIG: Record<
   ExecutionStatus,
   { color: string; bgColor: string; icon: typeof CheckCircle2; label: string }
> = {
   failed: {
      bgColor: "bg-red-500/10",
      color: "text-red-500",
      icon: XCircle,
      label: "Falhou",
   },
   partial: {
      bgColor: "bg-amber-500/10",
      color: "text-amber-500",
      icon: AlertTriangle,
      label: "Parcial",
   },
   skipped: {
      bgColor: "bg-muted",
      color: "text-muted-foreground",
      icon: SkipForward,
      label: "Ignorado",
   },
   success: {
      bgColor: "bg-green-500/10",
      color: "text-green-500",
      icon: CheckCircle2,
      label: "Sucesso",
   },
};

const TRIGGER_TYPE_LABELS: Record<string, string> = {
   "transaction.created": "Transação criada",
   "transaction.updated": "Transação atualizada",
   "schedule.daily": "Agendamento diário",
   "schedule.weekly": "Agendamento semanal",
   "schedule.biweekly": "Agendamento quinzenal",
   "schedule.custom": "Agendamento personalizado",
};

const TRIGGERED_BY_LABELS: Record<TriggeredBy, string> = {
   event: "Evento",
   manual: "Manual",
};

const ACTION_TYPE_LABELS: Record<ActionType, string> = {
   add_tag: "Adicionar tag",
   create_transaction: "Criar transação",
   fetch_bills_report: "Buscar relatório de contas",
   format_data: "Formatar dados",
   mark_as_transfer: "Marcar como transferência",
   remove_tag: "Remover tag",
   send_email: "Enviar e-mail",
   send_push_notification: "Enviar notificação",
   set_category: "Definir categoria",
   set_cost_center: "Definir centro de custo",
   stop_execution: "Parar execução",
   update_description: "Atualizar descrição",
};

type ExecutionLog = {
   id: string;
   status: string;
   triggerType: string;
   triggeredBy: string | null;
   triggerEvent: unknown;
   conditionsEvaluated: ConditionEvaluationLogResult[] | null;
   consequencesExecuted: ConsequenceExecutionLogResult[] | null;
   errorMessage: string | null;
   durationMs: number | null;
   createdAt: Date | string;
   relatedEntityType: string | null;
};

function ActivityPanel({ automationId }: { automationId: string }) {
   const [isExpanded, setIsExpanded] = useState(false);
   const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
   const trpc = useTRPC();

   const { data: executionsData, isLoading } = useQuery({
      ...trpc.automations.logs.getByRuleId.queryOptions({
         limit: 20,
         page: 1,
         ruleId: automationId,
      }),
      enabled: isExpanded,
   });

   const executions = (executionsData?.logs ?? []) as ExecutionLog[];

   return (
      <div
         className={cn(
            "absolute bottom-4 left-1/2 z-20 -translate-x-1/2 overflow-hidden rounded-xl border bg-background/95 shadow-xl backdrop-blur-sm transition-all duration-300",
            isExpanded ? "h-[450px] w-[420px]" : "h-auto w-auto",
         )}
      >
         <button
            className="flex w-full items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-accent/50"
            onClick={() => setIsExpanded(!isExpanded)}
            type="button"
         >
            <div className="flex items-center gap-2">
               <Activity className="size-4 text-primary" />
               <span className="text-sm font-medium">Atividade</span>
            </div>
            <ChevronUp
               className={cn(
                  "size-4 text-muted-foreground transition-transform duration-200",
                  !isExpanded && "rotate-180",
               )}
            />
         </button>

         {isExpanded && (
            <div className="border-t">
               <ScrollArea className="h-[calc(450px-52px)]">
                  <div className="p-2">
                     {isLoading ? (
                        <div className="space-y-2 p-2">
                           {Array.from({ length: 4 }).map((_, i) => (
                              <Skeleton
                                 className="h-20 w-full rounded-lg"
                                 // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton loaders don't reorder
                                 key={`skeleton-${i}`}
                              />
                           ))}
                        </div>
                     ) : !executions || executions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                           <Activity className="size-8 text-muted-foreground/40" />
                           <p className="mt-3 text-sm font-medium text-muted-foreground">
                              Nenhuma execução ainda
                           </p>
                           <p className="mt-1 text-xs text-muted-foreground/70">
                              As execuções aparecerão aqui
                           </p>
                        </div>
                     ) : (
                        <div className="space-y-1">
                           {executions.map((execution) => (
                              <ExecutionLogItem
                                 execution={execution}
                                 expanded={expandedLogId === execution.id}
                                 key={execution.id}
                                 onToggle={() =>
                                    setExpandedLogId(
                                       expandedLogId === execution.id
                                          ? null
                                          : execution.id,
                                    )
                                 }
                              />
                           ))}
                        </div>
                     )}
                  </div>
               </ScrollArea>
            </div>
         )}
      </div>
   );
}

function ExecutionLogItem({
   execution,
   expanded,
   onToggle,
}: {
   execution: ExecutionLog;
   expanded: boolean;
   onToggle: () => void;
}) {
   const status = execution.status as ExecutionStatus;
   const statusConfig = STATUS_CONFIG[status] ?? STATUS_CONFIG.skipped;
   const Icon = statusConfig.icon;

   const triggerEvent = execution.triggerEvent as {
      description?: string;
      amount?: number;
      type?: string;
   } | null;

   const transactionDescription = triggerEvent?.description;
   const transactionAmount = triggerEvent?.amount;
   const transactionType = triggerEvent?.type;

   const consequencesExecuted = execution.consequencesExecuted ?? [];
   const conditionsEvaluated = execution.conditionsEvaluated ?? [];

   const successConsequences = consequencesExecuted.filter(
      (a) => a.success,
   ).length;
   const passedConditions = conditionsEvaluated.filter((c) => c.passed).length;
   const totalConditions = conditionsEvaluated.length;

   return (
      <div className="rounded-lg border bg-card overflow-hidden">
         <button
            className="flex w-full items-start gap-3 p-3 text-left transition-colors hover:bg-accent/30"
            onClick={onToggle}
            type="button"
         >
            <div
               className={cn(
                  "mt-0.5 flex size-6 items-center justify-center rounded-full",
                  statusConfig.bgColor,
               )}
            >
               <Icon className={cn("size-3.5", statusConfig.color)} />
            </div>

            <div className="flex-1 min-w-0">
               <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                     {statusConfig.label}
                  </span>
                  <Badge className="text-[10px] px-1.5 py-0" variant="outline">
                     {TRIGGER_TYPE_LABELS[execution.triggerType] ??
                        execution.triggerType}
                  </Badge>
                  {execution.durationMs && (
                     <span className="text-[10px] text-muted-foreground">
                        {execution.durationMs}ms
                     </span>
                  )}
               </div>

               {transactionDescription && (
                  <p className="mt-1 text-xs text-muted-foreground truncate">
                     {transactionDescription}
                     {transactionAmount !== undefined && (
                        <span
                           className={cn(
                              "ml-2 font-medium",
                              transactionType === "income"
                                 ? "text-green-600"
                                 : "text-red-600",
                           )}
                        >
                           {transactionType === "income" ? "+" : "-"}
                           {new Intl.NumberFormat("pt-BR", {
                              currency: "BRL",
                              style: "currency",
                           }).format(Math.abs(transactionAmount))}
                        </span>
                     )}
                  </p>
               )}

               <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span>
                     {formatDistanceToNow(new Date(execution.createdAt), {
                        addSuffix: true,
                        locale: ptBR,
                     })}
                  </span>
                  {consequencesExecuted.length > 0 && (
                     <span className="flex items-center gap-1">
                        <Play className="size-3" />
                        {successConsequences}/{consequencesExecuted.length}{" "}
                        ações
                     </span>
                  )}
                  {totalConditions > 0 && (
                     <span className="flex items-center gap-1">
                        <Filter className="size-3" />
                        {passedConditions}/{totalConditions} condições
                     </span>
                  )}
               </div>
            </div>

            <ChevronDown
               className={cn(
                  "size-4 text-muted-foreground transition-transform",
                  expanded && "rotate-180",
               )}
            />
         </button>

         {expanded && (
            <div className="border-t bg-muted/30 px-3 py-2 space-y-3">
               {execution.errorMessage && (
                  <div className="rounded-md bg-red-500/10 p-2">
                     <p className="text-xs font-medium text-red-600">Erro</p>
                     <p className="mt-0.5 text-xs text-red-500">
                        {execution.errorMessage}
                     </p>
                  </div>
               )}

               {conditionsEvaluated.length > 0 && (
                  <div>
                     <p className="text-xs font-medium text-muted-foreground mb-1.5">
                        Condições avaliadas
                     </p>
                     <div className="space-y-1">
                        {conditionsEvaluated.map((condition, idx) => (
                           <div
                              className="flex items-center gap-2 text-xs"
                              key={condition.conditionId || idx}
                           >
                              {condition.passed ? (
                                 <CheckCircle2 className="size-3 text-green-500" />
                              ) : (
                                 <CircleSlash className="size-3 text-red-500" />
                              )}
                              <span className="text-muted-foreground">
                                 Valor:{" "}
                                 <code className="rounded bg-muted px-1 py-0.5">
                                    {String(condition.actualValue ?? "null")}
                                 </code>
                              </span>
                              {condition.expectedValue !== undefined && (
                                 <span className="text-muted-foreground">
                                    Esperado:{" "}
                                    <code className="rounded bg-muted px-1 py-0.5">
                                       {String(condition.expectedValue)}
                                    </code>
                                 </span>
                              )}
                           </div>
                        ))}
                     </div>
                  </div>
               )}

               {consequencesExecuted.length > 0 && (
                  <div>
                     <p className="text-xs font-medium text-muted-foreground mb-1.5">
                        Ações executadas
                     </p>
                     <div className="space-y-1">
                        {consequencesExecuted.map((consequence, idx) => (
                           <div
                              className="flex items-center gap-2 text-xs"
                              key={consequence.consequenceIndex ?? idx}
                           >
                              {consequence.success ? (
                                 <CheckCircle2 className="size-3 text-green-500" />
                              ) : (
                                 <XCircle className="size-3 text-red-500" />
                              )}
                              <span>
                                 {ACTION_TYPE_LABELS[consequence.type] ??
                                    consequence.type}
                              </span>
                              {consequence.error && (
                                 <span className="text-red-500 truncate">
                                    - {consequence.error}
                                 </span>
                              )}
                           </div>
                        ))}
                     </div>
                  </div>
               )}

               {execution.triggeredBy && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                     <Zap className="size-3" />
                     <span>
                        Disparado por:{" "}
                        {TRIGGERED_BY_LABELS[
                           execution.triggeredBy as TriggeredBy
                        ] ?? execution.triggeredBy}
                     </span>
                  </div>
               )}
            </div>
         )}
      </div>
   );
}

export function AutomationBuilder(props: AutomationBuilderProps) {
   return (
      <ReactFlowProvider>
         <AutomationBuilderContent {...props} />
      </ReactFlowProvider>
   );
}
