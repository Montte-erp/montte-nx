import type { ConditionGroup } from "@f-o-t/rules-engine";
import type { Consequence, TriggerType } from "@packages/database/schema";
import { Button } from "@packages/ui/components/button";
import { Card, CardContent } from "@packages/ui/components/card";
import { Skeleton } from "@packages/ui/components/skeleton";
import {
   useMutation,
   useQueryClient,
   useSuspenseQuery,
} from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { Check, Loader2, Settings, XCircle } from "lucide-react";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { toast } from "sonner";
import { useDetailTabName } from "@/features/custom-dashboard/hooks/use-detail-tab-name";
import type {
   AutomationEdge,
   AutomationNode,
} from "@/features/automations/hooks/use-flow-serialization";
import {
   flowDataToSchema,
   schemaToFlowData,
} from "@/features/automations/hooks/use-flow-serialization";
import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import { useSheet } from "@/hooks/use-sheet";
import { useTRPC } from "@/integrations/clients";
import { AutomationBuilder } from "./automation-builder";
import { AutomationSettingsForm } from "./automation-settings-form";
import type { ViewMode } from "./canvas-toolbar";

type SaveStatus = "idle" | "saving" | "saved" | "error";

function formatTimestamp(date: Date): string {
   return date.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
   });
}

type AutomationSettings = {
   description: string;
   enabled: boolean;
   name: string;
   priority: number;
   stopOnMatch: boolean;
   triggerType: TriggerType;
};

function AutomationDetailsSkeleton() {
   return (
      <div className="flex h-[calc(100vh-3rem)] items-center justify-center">
         <Skeleton className="h-full w-full" />
      </div>
   );
}

function AutomationDetailsErrorFallback({
   error,
   resetErrorBoundary,
}: FallbackProps) {
   return (
      <Card>
         <CardContent className="pt-6 text-center">
            <p className="text-destructive mb-4">
               Erro ao carregar automação: {error.message}
            </p>
            <Button onClick={resetErrorBoundary}>Tentar novamente</Button>
         </CardContent>
      </Card>
   );
}

function SaveStatusIndicator({
   lastSavedAt,
   status,
}: {
   lastSavedAt: Date | null;
   status: SaveStatus;
}) {
   if (status === "saving") {
      return (
         <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
            <Loader2 className="size-3.5 animate-spin" />
            Salvando...
         </span>
      );
   }

   if (status === "error") {
      return (
         <span className="text-destructive flex items-center gap-1.5 text-sm">
            <XCircle className="size-3.5" />
            Erro ao salvar
         </span>
      );
   }

   if (status === "saved" && lastSavedAt) {
      return (
         <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
            <Check className="size-3.5" />
            Salvo às {formatTimestamp(lastSavedAt)}
         </span>
      );
   }

   return null;
}

function AutomationDetailsContent({ automationId }: { automationId: string }) {
   const trpc = useTRPC();
   const queryClient = useQueryClient();
   const { openSheet } = useSheet();

   const { data: automation } = useSuspenseQuery(
      trpc.automations.getById.queryOptions({ id: automationId }),
   );

   useDetailTabName(automation?.name);

   const [settings, setSettings] = useState<AutomationSettings>({
      description: automation.description || "",
      enabled: automation.enabled,
      name: automation.name,
      priority: automation.priority,
      stopOnMatch: automation.stopOnMatch ?? false,
      triggerType: automation.triggerType as TriggerType,
   });

   const initialFlowData = schemaToFlowData(
      automation.triggerType as TriggerType,
      automation.conditions as ConditionGroup,
      automation.consequences as Consequence[],
      automation.flowData as { nodes: unknown[]; edges: unknown[] } | null,
   );

   const [nodes, setNodes] = useState<AutomationNode[]>(initialFlowData.nodes);
   const [edges, setEdges] = useState<AutomationEdge[]>(initialFlowData.edges);

   const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
   const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
   const [viewMode, setViewMode] = useState<ViewMode>("editor");

   const settingsRef = useRef(settings);
   const nodesRef = useRef(nodes);
   const edgesRef = useRef(edges);

   useEffect(() => {
      settingsRef.current = settings;
   }, [settings]);

   useEffect(() => {
      nodesRef.current = nodes;
   }, [nodes]);

   useEffect(() => {
      edgesRef.current = edges;
   }, [edges]);

   const updateMutation = useMutation(
      trpc.automations.update.mutationOptions({
         onError: (error) => {
            setSaveStatus("error");
            toast.error(`Erro ao salvar: ${error.message}`);
         },
         onSuccess: () => {
            queryClient.invalidateQueries({
               queryKey: [["automations"]],
            });
            setSaveStatus("saved");
            setLastSavedAt(new Date());
         },
      }),
   );

   const performSave = useCallback(() => {
      const currentSettings = settingsRef.current;
      const currentNodes = nodesRef.current;
      const currentEdges = edgesRef.current;

      const schemaData = flowDataToSchema(currentNodes, currentEdges);

      setSaveStatus("saving");

      updateMutation.mutate({
         data: {
            consequences: schemaData.consequences as Consequence[],
            conditions: schemaData.conditions as ConditionGroup,
            description: currentSettings.description || null,
            flowData: {
               edges: currentEdges as unknown[],
               nodes: currentNodes as unknown[],
            },
            enabled: currentSettings.enabled,
            name: currentSettings.name || "Automação sem nome",
            priority: currentSettings.priority,
            stopOnMatch: currentSettings.stopOnMatch,
            triggerType: currentSettings.triggerType,
         },
         id: automationId,
      });
   }, [automationId, updateMutation]);

   const debouncedSave = useDebouncedCallback(performSave, 1500);

   const handleFlowChange = useCallback(
      (newNodes: AutomationNode[], newEdges: AutomationEdge[]) => {
         setNodes(newNodes);
         setEdges(newEdges);
         debouncedSave();
      },
      [debouncedSave],
   );

   const handleSettingsChange = useCallback(
      (newSettings: Partial<AutomationSettings>) => {
         setSettings((prev) => ({ ...prev, ...newSettings }));
         debouncedSave();
      },
      [debouncedSave],
   );

   const handleOpenSettings = useCallback(() => {
      openSheet({
         children: (
            <AutomationSettingsForm
               onSettingsChange={handleSettingsChange}
               settings={settings}
            />
         ),
      });
   }, [openSheet, settings, handleSettingsChange]);

   return (
      <div className="relative -m-4 h-[calc(100%+2rem)] overflow-hidden">
         {viewMode === "editor" && (
            <div className="absolute right-4 top-4 z-10 flex items-center gap-3">
               <SaveStatusIndicator
                  lastSavedAt={lastSavedAt}
                  status={saveStatus}
               />

               <Button onClick={handleOpenSettings} size="sm" variant="outline">
                  <Settings className="size-4" />
                  Configurações
               </Button>
            </div>
         )}

         <div className="size-full">
            <AutomationBuilder
               automationId={automationId}
               initialEdges={edges}
               initialNodes={nodes}
               onChange={handleFlowChange}
               onViewModeChange={setViewMode}
            />
         </div>
      </div>
   );
}

export function AutomationDetailsPage() {
   const { automationId } = useParams({
      from: "/$slug/_dashboard/automations/$automationId",
   });

   return (
      <ErrorBoundary FallbackComponent={AutomationDetailsErrorFallback}>
         <Suspense fallback={<AutomationDetailsSkeleton />}>
            <AutomationDetailsContent automationId={automationId} />
         </Suspense>
      </ErrorBoundary>
   );
}
