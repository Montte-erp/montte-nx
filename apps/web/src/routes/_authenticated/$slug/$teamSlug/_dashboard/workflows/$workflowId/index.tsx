import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import {
   ContextPanel,
   ContextPanelContent,
   ContextPanelHeader,
   ContextPanelTitle,
} from "@packages/ui/components/context-panel";
import { Input } from "@packages/ui/components/input";
import {
   Popover,
   PopoverContent,
   PopoverTrigger,
} from "@packages/ui/components/popover";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
import {
   Tabs,
   TabsContent,
   TabsList,
   TabsTrigger,
} from "@packages/ui/components/tabs";
import { toast } from "@packages/ui/hooks/use-toast";
import { useForm } from "@tanstack/react-form";
import {
   useMutation,
   useQueryClient,
   useSuspenseQueries,
} from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import dayjs from "dayjs";
import {
   ArrowLeft,
   AlertTriangle,
   CalendarClock,
   ChartColumn,
   CircleCheckBig,
   Clock3,
   History,
   Pause,
   Play,
} from "lucide-react";
import { fromPromise } from "neverthrow";
import { useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { z } from "zod";
import { QueryBoundary } from "@/components/query-boundary";
import { useDashboardSlugs } from "@/hooks/use-dashboard-slugs";
import { orpc, type Outputs } from "@/integrations/orpc/client";
import {
   closeContextPanel,
   openContextPanel,
   useContextPanelInfo,
} from "../../../-context-panel/use-context-panel";
import {
   buildWorkflowCron,
   buildWorkflowHumanLabel,
   parseWorkflowScheduleFromCron,
   SchedulePicker,
} from "../../-workflows/schedule-picker";
import {
   WorkflowCanvas,
   type WorkflowFlowNode,
} from "../../-workflows/workflow-canvas";

const REPORT_TYPE_VALUES = [
   "dre",
   "cash-flow",
   "cost-centers",
   "aging",
   "categories",
] as const;
const PERIOD_KIND_VALUES = [
   "previous-month",
   "previous-week",
   "current-month",
   "current-week",
] as const;

const formSchema = z.object({
   schedule: z.object({
      cadence: z.enum(["weekly", "monthly"]),
      hour: z.string().min(1),
      minute: z.string().min(1),
      weekday: z.string().min(1),
      dayOfMonth: z.string().min(1),
   }),
   report: z.object({
      reportType: z.enum(REPORT_TYPE_VALUES),
      periodKind: z.enum(PERIOD_KIND_VALUES),
      nameTemplate: z.string().min(1),
   }),
});

type WorkflowDetail = Outputs["workflows"]["get"];
type WorkflowRun = Outputs["workflows"]["runs"]["list"][number];
type WorkflowRunStatus = WorkflowRun["status"];
type WorkflowGraph = WorkflowDetail["graph"];
type WorkflowGraphNode = WorkflowGraph["nodes"][number];
type WorkflowReportType = (typeof REPORT_TYPE_VALUES)[number];
type WorkflowPeriodKind = (typeof PERIOD_KIND_VALUES)[number];
type FormValues = z.input<typeof formSchema>;

const REPORT_LABELS: Record<WorkflowReportType, string> = {
   dre: "DRE",
   "cash-flow": "Fluxo de caixa",
   "cost-centers": "Centro de Custo",
   aging: "A receber/pagar",
   categories: "Categorias",
};

const PERIOD_LABELS: Record<WorkflowPeriodKind, string> = {
   "previous-month": "Mês anterior",
   "previous-week": "Semana anterior",
   "current-month": "Mês atual",
   "current-week": "Semana atual",
};

function WorkflowRunStatusBadge({ status }: { status: WorkflowRunStatus }) {
   if (status === "failed") {
      return (
         <Badge variant="destructive">
            <AlertTriangle className="size-3" />
            Falhou
         </Badge>
      );
   }
   if (status === "succeeded") {
      return (
         <Badge variant="success">
            <CircleCheckBig className="size-3" />
            Concluída
         </Badge>
      );
   }
   return (
      <Badge variant={status === "running" ? "secondary" : "outline"}>
         <Clock3 className="size-3" />
         {status === "running" ? "Executando" : "Na fila"}
      </Badge>
   );
}

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/workflows/$workflowId/",
)({
   loader: ({ context, params }) => {
      context.queryClient.prefetchQuery(
         orpc.workflows.get.queryOptions({ input: { id: params.workflowId } }),
      );
      context.queryClient.prefetchQuery(
         orpc.workflows.runs.list.queryOptions({
            input: { workflowId: params.workflowId, limit: 5 },
         }),
      );
   },
   pendingMs: 300,
   pendingComponent: WorkflowDetailSkeleton,
   head: () => ({
      meta: [{ title: "Workflow - Montte" }],
   }),
   component: WorkflowDetailPage,
});

function WorkflowDetailSkeleton() {
   return <main className="flex flex-1 min-h-0 overflow-hidden" />;
}

function WorkflowDetailPage() {
   return (
      <main className="flex flex-1 min-h-0 overflow-hidden">
         <QueryBoundary
            fallback={<WorkflowDetailSkeleton />}
            errorTitle="Erro ao carregar workflow"
         >
            <WorkflowDetailContent />
         </QueryBoundary>
      </main>
   );
}

function WorkflowDetailContent() {
   const { workflowId } = Route.useParams();
   const { slug, teamSlug } = useDashboardSlugs();
   const navigate = useNavigate();
   const queryClient = useQueryClient();
   const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

   const [{ data: workflow }, { data: runs }] = useSuspenseQueries({
      queries: [
         orpc.workflows.get.queryOptions({ input: { id: workflowId } }),
         orpc.workflows.runs.list.queryOptions({
            input: { workflowId, limit: 5 },
         }),
      ],
   });

   const selectedNode = selectedNodeId
      ? (workflow.graph.nodes.find((node) => node.id === selectedNodeId) ??
        null)
      : null;
   const scheduleNode = workflow.graph.nodes[0];
   const reportNode = workflow.graph.nodes[1];

   const invalidateWorkflow = async () => {
      await Promise.all([
         queryClient.invalidateQueries(
            orpc.workflows.get.queryOptions({ input: { id: workflowId } }),
         ),
         queryClient.invalidateQueries(orpc.workflows.list.queryOptions()),
      ]);
   };

   const updateMutation = useMutation(
      orpc.workflows.update.mutationOptions({
         onSuccess: async () => {
            toast.success("Workflow atualizado.");
            await invalidateWorkflow();
         },
         onError: (error) => toast.error(error.message),
      }),
   );
   const pauseMutation = useMutation(
      orpc.workflows.pause.mutationOptions({
         onSuccess: async () => {
            toast.success("Workflow pausado.");
            await invalidateWorkflow();
         },
         onError: (error) => toast.error(error.message),
      }),
   );
   const activateMutation = useMutation(
      orpc.workflows.activate.mutationOptions({
         onSuccess: async () => {
            toast.success("Workflow ativado.");
            await invalidateWorkflow();
         },
         onError: (error) => toast.error(error.message),
      }),
   );

   const form = useForm({
      defaultValues: {
         schedule: parseWorkflowScheduleFromCron(
            scheduleNode?.data.cron ?? "0 9 1 * *",
         ),
         report: {
            reportType: reportNode?.data.reportType ?? "dre",
            periodKind: reportNode?.data.period.kind ?? "previous-month",
            nameTemplate: reportNode?.data.nameTemplate ?? "Relatório",
         },
      } satisfies FormValues,
      validators: { onMount: formSchema, onChange: formSchema },
      onSubmit: async ({ value }) => {
         const result = await fromPromise(
            updateMutation.mutateAsync({
               id: workflow.id,
               graph: {
                  ...workflow.graph,
                  nodes: [
                     {
                        ...scheduleNode,
                        data: {
                           ...scheduleNode.data,
                           cron: buildWorkflowCron(value.schedule),
                           humanLabel: buildWorkflowHumanLabel(value.schedule),
                        },
                     },
                     {
                        ...reportNode,
                        data: {
                           ...reportNode.data,
                           reportType: value.report.reportType,
                           period: {
                              ...reportNode.data.period,
                              kind: value.report.periodKind,
                           },
                           nameTemplate: value.report.nameTemplate,
                        },
                     },
                  ],
               },
            }),
            (error) => error,
         );
         if (result.isErr()) return;
      },
   });

   useContextPanelInfo(() =>
      selectedNode ? (
         <WorkflowNodeContextPanel
            node={selectedNode}
            onSave={() => form.handleSubmit()}
            renderReportFields={
               <WorkflowReportFields
                  nameField={
                     <form.Field name="report.nameTemplate">
                        {(field) => (
                           <Input
                              value={field.state.value}
                              onChange={(event) =>
                                 field.handleChange(event.target.value)
                              }
                           />
                        )}
                     </form.Field>
                  }
                  periodField={
                     <form.Field name="report.periodKind">
                        {(field) => (
                           <Select
                              value={field.state.value}
                              onValueChange={(value) =>
                                 field.handleChange(value as WorkflowPeriodKind)
                              }
                           >
                              <SelectTrigger className="w-full">
                                 <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                 {PERIOD_KIND_VALUES.map((value) => (
                                    <SelectItem key={value} value={value}>
                                       {PERIOD_LABELS[value]}
                                    </SelectItem>
                                 ))}
                              </SelectContent>
                           </Select>
                        )}
                     </form.Field>
                  }
                  typeField={
                     <form.Field name="report.reportType">
                        {(field) => (
                           <Select
                              value={field.state.value}
                              onValueChange={(value) =>
                                 field.handleChange(value as WorkflowReportType)
                              }
                           >
                              <SelectTrigger className="w-full">
                                 <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                 {REPORT_TYPE_VALUES.map((value) => (
                                    <SelectItem key={value} value={value}>
                                       {REPORT_LABELS[value]}
                                    </SelectItem>
                                 ))}
                              </SelectContent>
                           </Select>
                        )}
                     </form.Field>
                  }
               />
            }
            renderSchedulePicker={
               <form.Field name="schedule">
                  {(field) => (
                     <SchedulePicker
                        value={field.state.value}
                        onChange={(value) => field.handleChange(value)}
                     />
                  )}
               </form.Field>
            }
         />
      ) : null,
   );

   return (
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
         <WorkflowCanvas
            graph={workflow.graph}
            selectedNodeId={selectedNodeId}
            onNodeClick={(node: WorkflowFlowNode) => {
               flushSync(() => setSelectedNodeId(node.id));
               openContextPanel();
            }}
            onPaneClick={() => {
               setSelectedNodeId(null);
               closeContextPanel();
            }}
         />

         <Button
            className="absolute top-4 left-4 z-20 size-9 rounded-full border bg-popover/85 shadow-sm backdrop-blur"
            onClick={() =>
               navigate({
                  to: "/$slug/$teamSlug/workflows",
                  params: { slug, teamSlug },
               })
            }
            size="icon"
            tooltip="Voltar"
            variant="ghost"
         >
            <ArrowLeft className="size-4" />
            <span className="sr-only">Voltar</span>
         </Button>

         <div className="absolute top-4 left-1/2 z-20 max-w-[360px] -translate-x-1/2 truncate rounded-full border bg-popover/85 px-3 py-1.5 text-sm font-medium shadow-sm backdrop-blur">
            {workflow.name}
         </div>

         {workflow.status === "active" ? (
            <Button
               className="absolute top-4 right-4 z-20 size-9 rounded-full border bg-popover/85 shadow-sm backdrop-blur"
               onClick={() => pauseMutation.mutate({ id: workflow.id })}
               size="icon"
               tooltip="Pausar workflow"
               variant="ghost"
            >
               <Pause className="size-4" />
               <span className="sr-only">Pausar workflow</span>
            </Button>
         ) : (
            <Button
               className="absolute top-4 right-4 z-20 size-9 rounded-full border bg-popover/85 shadow-sm backdrop-blur"
               onClick={() => activateMutation.mutate({ id: workflow.id })}
               size="icon"
               tooltip="Ativar workflow"
               variant="ghost"
            >
               <Play className="size-4" />
               <span className="sr-only">Ativar workflow</span>
            </Button>
         )}

         <WorkflowRunsFloatingButton runs={runs} />
      </div>
   );
}

function WorkflowNodeContextPanel({
   node,
   onSave,
   renderReportFields,
   renderSchedulePicker,
}: {
   node: WorkflowGraphNode;
   onSave: () => void;
   renderReportFields: ReactNode;
   renderSchedulePicker: ReactNode;
}) {
   const isSchedule = node.type === "scheduleTrigger";
   const title = isSchedule ? "Quando executar" : "O que gerar";
   const Icon = isSchedule ? CalendarClock : ChartColumn;

   return (
      <ContextPanel>
         <ContextPanelHeader>
            <ContextPanelTitle className="flex items-center gap-2">
               <Icon className="size-4" />
               {title}
            </ContextPanelTitle>
         </ContextPanelHeader>
         <ContextPanelContent className="gap-4">
            <Tabs className="min-h-0" defaultValue="config">
               <TabsList className="w-full" variant="connected">
                  <TabsTrigger value="config">Configuração</TabsTrigger>
                  <TabsTrigger value="details">Detalhes</TabsTrigger>
               </TabsList>
               <TabsContent className="mt-3" value="config">
                  <form
                     className="flex flex-col gap-4"
                     onSubmit={(event) => {
                        event.preventDefault();
                        onSave();
                     }}
                  >
                     {isSchedule ? renderSchedulePicker : renderReportFields}
                     <Button type="submit">
                        {isSchedule ? "Salvar agenda" : "Salvar relatório"}
                     </Button>
                  </form>
               </TabsContent>
               <TabsContent className="mt-3" value="details">
                  {isSchedule ? (
                     <div className="grid gap-3 text-sm">
                        <PanelRow label="Resumo" value={node.data.humanLabel} />
                        <PanelRow label="Cron" value={node.data.cron} />
                        <PanelRow label="Fuso" value={node.data.timezone} />
                     </div>
                  ) : (
                     <div className="grid gap-3 text-sm">
                        <PanelRow
                           label="Tipo"
                           value={REPORT_LABELS[node.data.reportType]}
                        />
                        <PanelRow
                           label="Período"
                           value={PERIOD_LABELS[node.data.period.kind]}
                        />
                        <PanelRow
                           label="Nome gerado"
                           value={node.data.nameTemplate}
                        />
                     </div>
                  )}
               </TabsContent>
            </Tabs>
         </ContextPanelContent>
      </ContextPanel>
   );
}

function WorkflowReportFields({
   nameField,
   periodField,
   typeField,
}: {
   nameField: ReactNode;
   periodField: ReactNode;
   typeField: ReactNode;
}) {
   return (
      <div className="grid gap-4">
         <FieldBlock
            description="Escolha qual relatório esta automação vai criar."
            label="Tipo de relatório"
         >
            {typeField}
         </FieldBlock>
         <FieldBlock
            description="Define o intervalo usado na geração automática."
            label="Período"
         >
            {periodField}
         </FieldBlock>
         <FieldBlock
            description="Texto usado para nomear o relatório criado."
            label="Nome gerado"
         >
            {nameField}
         </FieldBlock>
      </div>
   );
}

function FieldBlock({
   children,
   description,
   label,
}: {
   children: ReactNode;
   description: string;
   label: string;
}) {
   return (
      <label className="grid gap-2">
         <span className="text-sm font-medium">{label}</span>
         <span className="text-muted-foreground text-xs">{description}</span>
         {children}
      </label>
   );
}

function WorkflowRunsFloatingButton({ runs }: { runs: WorkflowRun[] }) {
   return (
      <Popover>
         <PopoverTrigger asChild>
            <Button
               className="absolute right-6 bottom-6 z-20 size-10 rounded-full border bg-popover/85 shadow-lg backdrop-blur"
               size="icon"
               tooltip="Execuções"
               variant="ghost"
            >
               <History className="size-4" />
               <span className="sr-only">Execuções</span>
            </Button>
         </PopoverTrigger>
         <PopoverContent
            align="end"
            className="flex w-80 flex-col gap-3 p-3"
            side="top"
            sideOffset={8}
         >
            <div>
               <p className="text-sm font-semibold">Execuções</p>
               <p className="text-muted-foreground text-xs">
                  Histórico recente desta automação
               </p>
            </div>

            <div className="flex max-h-72 flex-col gap-2 overflow-auto pr-1">
               {runs.length === 0 ? (
                  <p className="text-muted-foreground py-6 text-center text-sm">
                     Nenhuma execução registrada.
                  </p>
               ) : (
                  runs.map((run) => (
                     <div
                        className="flex flex-col gap-2 rounded-lg border bg-card p-3"
                        key={run.id}
                     >
                        <div className="flex items-center justify-between gap-2">
                           <WorkflowRunStatusBadge status={run.status} />
                           <span className="text-muted-foreground text-xs">
                              {dayjs(run.scheduledFor).format(
                                 "DD/MM/YYYY HH:mm",
                              )}
                           </span>
                        </div>
                        {run.error ? (
                           <p className="text-destructive text-sm">
                              {run.error}
                           </p>
                        ) : null}
                     </div>
                  ))
               )}
            </div>
         </PopoverContent>
      </Popover>
   );
}

function PanelRow({ label, value }: { label: string; value: string }) {
   return (
      <div className="flex items-start justify-between gap-3 rounded-lg border bg-card p-3">
         <span className="text-muted-foreground">{label}</span>
         <span className="text-right font-medium">{value}</span>
      </div>
   );
}
