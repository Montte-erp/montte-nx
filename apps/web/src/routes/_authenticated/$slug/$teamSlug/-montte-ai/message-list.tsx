import {
   ActionBarPrimitive,
   AuiIf,
   getMcpAppFromToolPart,
   MessagePartPrimitive,
   MessagePrimitive,
   ThreadPrimitive,
   useAuiState,
   type ToolCallMessagePart,
} from "@assistant-ui/react";
import { StreamdownTextPrimitive } from "@assistant-ui/react-streamdown";
import { Button } from "@packages/ui/components/button";
import { cn } from "@packages/ui/lib/utils";
import { format, of } from "@f-o-t/money";
import {
   ArrowDown,
   Banknote,
   BookOpenCheck,
   BrainCircuit,
   Check,
   Copy,
   CreditCard,
   FileChartColumn,
   FolderTree,
   Landmark,
   Loader2,
   PackageSearch,
   Pencil,
   RefreshCw,
   ReceiptText,
   Search,
   Sparkles,
   Tags,
   ThumbsDown,
   ThumbsUp,
   Trash2,
   Wrench,
   type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { z } from "zod";
import { EditComposer } from "./composer";
import { useMontteActions, useMontteIsRunning } from "./chat-runtime";
import {
   ReasoningContent,
   ReasoningRoot,
   ReasoningText,
   ReasoningTrigger,
} from "./reasoning";
import {
   ToolGroupContent,
   ToolGroupRoot,
   ToolGroupTrigger,
} from "./tool-group";

const toolArtifactSchema = z.object({
   state: z.string().optional(),
   approvalId: z.string().optional(),
   approvalApproved: z.boolean().optional(),
});

const toolArgsSchema = z.object({
   startDate: z.string().optional(),
   endDate: z.string().optional(),
   query: z.string().optional(),
   reportType: z.string().optional(),
});

const toolCollectionResultSchema = z.object({
   data: z.array(z.unknown()).optional(),
   total: z.number().optional(),
   totalCount: z.number().optional(),
   limit: z.number().optional(),
});

const financialSummaryResultSchema = z.object({
   incomeTotal: z.string(),
   expenseTotal: z.string(),
   balance: z.string(),
   totalCount: z.number(),
});

const financialReportResultSchema = z.object({
   reportType: z.string(),
});

const advisorResultSchema = z.object({
   guidance: z.string().optional(),
   fallback: z.boolean().optional(),
});

type ToolTone = "blue" | "emerald" | "amber" | "violet" | "cyan" | "rose";

interface ToolVisualConfig {
   title: string;
   activeTitle?: string;
   description: string;
   icon: LucideIcon;
   tone: ToolTone;
}

const TOOL_VISUALS: Record<string, ToolVisualConfig> = {
   __lazy__tool__discovery__: {
      title: "Ferramentas carregadas",
      activeTitle: "Carregando ferramentas",
      description: "Preparando as ações disponíveis para esta conversa.",
      icon: PackageSearch,
      tone: "violet",
   },
   advisor_consult: {
      title: "Advisor consultado",
      activeTitle: "Consultando advisor sênior",
      description: "Validando uma decisão ambígua antes de continuar.",
      icon: BrainCircuit,
      tone: "violet",
   },
   generate_financial_report: {
      title: "Relatório financeiro gerado",
      activeTitle: "Gerando relatório financeiro",
      description: "Consolidando dados financeiros em uma visão analítica.",
      icon: FileChartColumn,
      tone: "emerald",
   },
   get_financial_summary: {
      title: "Resumo financeiro consultado",
      activeTitle: "Consultando resumo financeiro",
      description: "Calculando entradas, saídas e saldo do período.",
      icon: Banknote,
      tone: "emerald",
   },
   list_bank_accounts: {
      title: "Contas bancárias listadas",
      activeTitle: "Listando contas bancárias",
      description: "Lendo saldos, bancos e contas disponíveis.",
      icon: Landmark,
      tone: "blue",
   },
   list_card_statements: {
      title: "Faturas listadas",
      activeTitle: "Listando faturas",
      description: "Consultando competências, vencimentos e totais.",
      icon: ReceiptText,
      tone: "amber",
   },
   list_categories: {
      title: "Categorias listadas",
      activeTitle: "Listando categorias",
      description: "Carregando a árvore de categorias financeiras.",
      icon: FolderTree,
      tone: "cyan",
   },
   list_cost_centers: {
      title: "Centros de Custo listados",
      activeTitle: "Listando Centros de Custo",
      description: "Buscando Centros de Custo do time.",
      icon: Tags,
      tone: "cyan",
   },
   list_credit_cards: {
      title: "Cartões listados",
      activeTitle: "Listando cartões",
      description: "Consultando cartões, limites e status.",
      icon: CreditCard,
      tone: "amber",
   },
   search_transactions: {
      title: "Lançamentos encontrados",
      activeTitle: "Buscando lançamentos",
      description: "Filtrando lançamentos por período, status e contexto.",
      icon: Search,
      tone: "blue",
   },
   catalog_search: {
      title: "Catálogo consultado",
      activeTitle: "Consultando catálogo",
      description: "Buscando opções no catálogo operacional.",
      icon: BookOpenCheck,
      tone: "violet",
   },
   meter_create: {
      title: "Medidor criado",
      activeTitle: "Criando medidor",
      description: "Configurando um novo medidor de uso.",
      icon: Sparkles,
      tone: "emerald",
   },
   meter_details: {
      title: "Medidor detalhado",
      activeTitle: "Detalhando medidor",
      description: "Lendo configuração e estado do medidor.",
      icon: Wrench,
      tone: "blue",
   },
   meter_remove: {
      title: "Medidor removido",
      activeTitle: "Removendo medidor",
      description: "Aplicando remoção do medidor selecionado.",
      icon: Wrench,
      tone: "rose",
   },
   meter_update: {
      title: "Medidor atualizado",
      activeTitle: "Atualizando medidor",
      description: "Salvando alterações no medidor.",
      icon: Wrench,
      tone: "blue",
   },
   meters_set_active: {
      title: "Status dos medidores atualizado",
      activeTitle: "Atualizando status dos medidores",
      description: "Ativando ou arquivando medidores.",
      icon: Wrench,
      tone: "blue",
   },
};

type AssistantPartGroup = "group-reasoning" | "group-tool";

type AssistantPartForGrouping = {
   type: string;
};

type MessageActionRole = "assistant" | "user" | "system";

const groupAssistantParts = (
   part: AssistantPartForGrouping,
): readonly AssistantPartGroup[] | null => {
   if (part.type === "reasoning") return ["group-reasoning"];
   if (part.type === "tool-call") return ["group-tool"];
   return null;
};

interface ThreadFrameProps {
   children: ReactNode;
}

export function ThreadFrame({ children }: ThreadFrameProps) {
   return (
      <ThreadPrimitive.Root className="aui-root aui-thread-root relative flex h-full min-h-0 flex-1 flex-col overflow-hidden">
         {children}
      </ThreadPrimitive.Root>
   );
}

export function Thread({
   children,
   compact = false,
   empty,
}: {
   children?: ReactNode;
   compact?: boolean;
   empty: ReactNode;
}) {
   return (
      <ThreadFrame>
         <ThreadPrimitive.Viewport
            autoScroll
            className="relative flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-scroll scroll-smooth"
            scrollToBottomOnRunStart
            turnAnchor="top"
         >
            <div className="flex min-h-full w-full max-w-5xl flex-1 flex-col p-4">
               <AuiIf condition={(s) => s.thread.isEmpty}>
                  <div className="flex grow flex-col items-center justify-center gap-4 p-4">
                     {empty}
                  </div>
               </AuiIf>
               <AuiIf condition={(s) => !s.thread.isEmpty}>
                  <div className="flex flex-col gap-4 empty:hidden">
                     <ThreadPrimitive.Messages>
                        {() => <ThreadMessage compact={compact} />}
                     </ThreadPrimitive.Messages>
                     <ThinkingIndicator />
                  </div>
               </AuiIf>
               <div className="flex-1" />
               <ThreadPrimitive.ViewportFooter className="sticky bottom-0 z-10 flex flex-col gap-2 bg-transparent pb-4">
                  <AuiIf condition={(s) => !s.thread.isEmpty}>
                     <ThreadPrimitive.ScrollToBottom asChild>
                        <Button
                           aria-label="Ir para o final"
                           className="self-center rounded-full"
                           size="icon"
                           type="button"
                           variant="outline"
                        >
                           <ArrowDownIcon />
                        </Button>
                     </ThreadPrimitive.ScrollToBottom>
                  </AuiIf>
                  {children}
               </ThreadPrimitive.ViewportFooter>
            </div>
         </ThreadPrimitive.Viewport>
      </ThreadFrame>
   );
}

function ThreadMessage({ compact }: { compact: boolean }) {
   const role = useAuiState((s) => s.message.role);
   const isEditing = useAuiState((s) => s.message.composer.isEditing);

   if (isEditing) return <EditComposer />;
   if (role === "user") return <UserMessage compact={compact} />;
   return <AssistantMessage compact={compact} />;
}

function ArrowDownIcon() {
   return <ArrowDown className="size-4" />;
}

function ThinkingIndicator() {
   const show = useAuiState((s) => {
      if (!s.thread.isRunning) return false;
      const last = s.thread.messages.at(-1);
      return last?.role !== "assistant";
   });

   if (!show) return null;

   return (
      <div className="flex items-center gap-2 rounded-lg bg-muted/30 p-2 text-sm text-muted-foreground shimmer">
         <Loader2 className="size-4 animate-spin" />
         <span className="flex-1">Montte AI está pensando</span>
      </div>
   );
}

function UserMessage({ compact }: { compact: boolean }) {
   const messageId = useAuiState((s) => s.message.id);

   return (
      <MessagePrimitive.Root className="group/user flex flex-col items-end gap-2">
         <div
            className={cn(
               "w-full rounded-lg bg-accent p-2 text-foreground",
               compact ? "text-sm" : "text-base",
            )}
         >
            <MessagePrimitive.Parts>
               {({ part }) => {
                  if (part.type === "text") return <UserText />;
                  return null;
               }}
            </MessagePrimitive.Parts>
         </div>
         <MessageActions align="end" messageId={messageId} role="user" />
      </MessagePrimitive.Root>
   );
}

function AssistantMessage({ compact }: { compact: boolean }) {
   const messageId = useAuiState((s) => s.message.id);
   const isLastAssistantMessage = useAuiState((s) => {
      const lastAssistantMessage = s.thread.messages.findLast(
         (message) => message.role === "assistant",
      );
      return lastAssistantMessage?.id === messageId;
   });

   return (
      <MessagePrimitive.Root
         className={cn(
            "group/msg flex flex-col gap-2 leading-relaxed",
            compact ? "text-sm" : "text-base",
         )}
      >
         <MessagePrimitive.GroupedParts groupBy={groupAssistantParts}>
            {({ part, children }) => {
               if (part.type === "group-reasoning") {
                  const running = part.status.type === "running";
                  return (
                     <ReasoningRoot defaultOpen={running}>
                        <ReasoningTrigger active={running} />
                        <ReasoningContent active={running}>
                           <ReasoningText>{children}</ReasoningText>
                        </ReasoningContent>
                     </ReasoningRoot>
                  );
               }
               if (part.type === "group-tool") {
                  return (
                     <ToolGroupRoot
                        defaultOpen={part.status.type === "running"}
                     >
                        <ToolGroupTrigger
                           active={part.status.type === "running"}
                           count={part.indices.length}
                        />
                        <ToolGroupContent>{children}</ToolGroupContent>
                     </ToolGroupRoot>
                  );
               }
               if (part.type === "text") {
                  if (part.text.trim().length === 0) return null;
                  return <AssistantText />;
               }
               if (part.type === "reasoning") return <ReasoningPart />;
               if (part.type === "tool-call") {
                  if (getMcpAppFromToolPart(part)) return part.toolUI;
                  return <ToolPart part={part} />;
               }
               if (part.type === "data") return part.dataRendererUI;
               return null;
            }}
         </MessagePrimitive.GroupedParts>
         {isLastAssistantMessage ? (
            <MessageActions
               align="start"
               messageId={messageId}
               role="assistant"
            />
         ) : null}
      </MessagePrimitive.Root>
   );
}

function UserText() {
   return <MessagePartPrimitive.Text className="whitespace-pre-wrap" />;
}

function AssistantText() {
   return <StreamdownTextPrimitive />;
}

function ReasoningPart() {
   const running = useAuiState((s) => s.part.status.type === "running");
   return <StreamdownTextPrimitive mode={running ? "streaming" : "static"} />;
}

function ToolPart({
   part,
}: {
   part: ToolCallMessagePart & {
      status: { type: string };
      artifact?: unknown;
   };
}) {
   const { approveTool, rejectTool } = useMontteActions();
   const artifactResult = toolArtifactSchema.safeParse(part.artifact);
   const toolState = artifactResult.success
      ? artifactResult.data.state
      : undefined;
   const approvalId = artifactResult.success
      ? artifactResult.data.approvalId
      : undefined;
   const approvalApproved = artifactResult.success
      ? artifactResult.data.approvalApproved
      : undefined;
   const needsDecision =
      toolState === "approval-requested" &&
      approvalId !== undefined &&
      approvalApproved === undefined;
   const running =
      toolState === "awaiting-input" || toolState === "input-streaming";
   const completed =
      toolState !== "approval-requested" &&
      (part.result !== undefined ||
         part.artifact !== undefined ||
         approvalApproved === true ||
         toolState === "completed" ||
         part.status.type === "complete");
   const visual = getToolVisual(part.toolName);
   const title =
      running && visual.activeTitle !== undefined
         ? visual.activeTitle
         : visual.title;
   const statusLabel = getToolStatusLabel({
      completed,
      isError: part.isError === true,
      running,
   });
   const metrics = getToolMetrics(part);
   const Icon = visual.icon;

   return (
      <div className="flex w-full flex-col gap-2 rounded-md border border-border/60 bg-background/40 p-2 text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground">
         <div className="grid w-full grid-cols-[auto_1fr_auto] items-start gap-2">
            <span
               className={cn(
                  "inline-flex shrink-0 items-center justify-center rounded-md p-2",
                  getToolToneClassName(visual.tone),
               )}
            >
               <Icon className="size-4" />
            </span>
            <span className="flex min-w-0 flex-col gap-2">
               <span className="truncate font-medium text-foreground">
                  {title}
               </span>
               <span className="line-clamp-2 text-sm">
                  {visual.description}
               </span>
               {metrics.length > 0 ? (
                  <span className="flex flex-wrap gap-2">
                     {metrics.map((metric) => (
                        <span
                           className="rounded-md border border-border/60 bg-muted/20 p-2 text-xs text-muted-foreground"
                           key={metric}
                        >
                           {metric}
                        </span>
                     ))}
                  </span>
               ) : null}
            </span>
            <ToolStatusBadge
               completed={completed}
               isError={part.isError === true}
               label={statusLabel}
               running={running}
            />
         </div>
         {needsDecision ? (
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-2">
               <span className="min-w-0 flex-1 truncate">
                  Aprovar <span className="font-medium">{title}</span>?
               </span>
               <Button
                  className="h-8 px-2 text-sm"
                  onClick={() => void rejectTool(approvalId)}
                  size="sm"
                  variant="outline"
               >
                  Negar
               </Button>
               <Button
                  className="h-8 px-2 text-sm"
                  onClick={() => void approveTool(approvalId)}
                  size="sm"
               >
                  Aprovar
               </Button>
            </div>
         ) : null}
      </div>
   );
}

function getToolVisual(toolName: string): ToolVisualConfig {
   return (
      TOOL_VISUALS[toolName] ?? {
         title: "Ferramenta executada",
         activeTitle: "Executando ferramenta",
         description: "Executando uma ação operacional da Montte AI.",
         icon: Wrench,
         tone: "blue",
      }
   );
}

function getToolStatusLabel({
   completed,
   isError,
   running,
}: {
   completed: boolean;
   isError: boolean;
   running: boolean;
}) {
   if (isError) return "Falhou";
   if (running) return "Em andamento";
   if (completed) return "Concluída";
   return "Na fila";
}

function getToolToneClassName(tone: ToolTone) {
   switch (tone) {
      case "emerald":
         return "bg-emerald-500/10 text-emerald-400";
      case "amber":
         return "bg-amber-500/10 text-amber-400";
      case "violet":
         return "bg-violet-500/10 text-violet-400";
      case "cyan":
         return "bg-cyan-500/10 text-cyan-400";
      case "rose":
         return "bg-rose-500/10 text-rose-400";
      case "blue":
         return "bg-sky-500/10 text-sky-400";
   }
}

function ToolStatusBadge({
   completed,
   isError,
   label,
   running,
}: {
   completed: boolean;
   isError: boolean;
   label: string;
   running: boolean;
}) {
   return (
      <span
         className={cn(
            "inline-flex shrink-0 items-center gap-2 rounded-md border p-2 text-xs",
            isError
               ? "border-rose-500/30 bg-rose-500/10 text-rose-400"
               : running
                 ? "border-sky-500/30 bg-sky-500/10 text-sky-400"
                 : completed
                   ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                   : "border-border/60 bg-muted/20 text-muted-foreground",
         )}
      >
         {running ? (
            <Loader2 className="size-4 animate-spin" />
         ) : completed ? (
            <Check className="size-4" />
         ) : null}
         {label}
      </span>
   );
}

function getToolMetrics(
   part: ToolCallMessagePart & {
      result?: unknown;
   },
) {
   const args = toolArgsSchema.safeParse(part.args);
   const metrics = [
      ...getArgsMetrics(args.success ? args.data : undefined),
      ...getResultMetrics(part.toolName, part.result),
   ];
   return metrics.slice(0, 4);
}

function getArgsMetrics(args: z.infer<typeof toolArgsSchema> | undefined) {
   if (!args) return [];
   const metrics: string[] = [];
   if (args.startDate && args.endDate) {
      metrics.push(`${args.startDate} até ${args.endDate}`);
   }
   if (args.query) metrics.push(`Busca: ${args.query}`);
   const reportType = reportTypeLabel(args.reportType);
   if (reportType) metrics.push(reportType);
   return metrics;
}

function getResultMetrics(toolName: string, result: unknown) {
   if (toolName === "get_financial_summary") {
      const summary = financialSummaryResultSchema.safeParse(result);
      if (!summary.success) return [];
      return [
         `${summary.data.totalCount} lançamentos`,
         `Entradas ${formatCurrency(summary.data.incomeTotal)}`,
         `Saídas ${formatCurrency(summary.data.expenseTotal)}`,
         `Saldo ${formatCurrency(summary.data.balance)}`,
      ];
   }

   if (toolName === "generate_financial_report") {
      const report = financialReportResultSchema.safeParse(result);
      if (!report.success) return [];
      const label = reportTypeLabel(report.data.reportType);
      return label ? [label] : [];
   }

   if (toolName === "advisor_consult") {
      const advisor = advisorResultSchema.safeParse(result);
      if (!advisor.success) return [];
      if (advisor.data.fallback === true) return ["Fallback aplicado"];
      return advisor.data.guidance ? ["Orientação recebida"] : [];
   }

   const collection = toolCollectionResultSchema.safeParse(result);
   if (!collection.success) return [];
   const count =
      collection.data.total ??
      collection.data.totalCount ??
      collection.data.data?.length;
   if (count === undefined) return [];
   return [`${count} ${resultCountLabel(toolName, count)}`];
}

function resultCountLabel(toolName: string, count: number) {
   const plural = count !== 1;
   switch (toolName) {
      case "list_bank_accounts":
         return plural ? "contas" : "conta";
      case "list_credit_cards":
         return plural ? "cartões" : "cartão";
      case "list_card_statements":
         return plural ? "faturas" : "fatura";
      case "list_categories":
         return plural ? "categorias" : "categoria";
      case "list_cost_centers":
         return plural ? "Centros de Custo" : "Centro de Custo";
      case "search_transactions":
         return plural ? "lançamentos" : "lançamento";
      default:
         return plural ? "itens" : "item";
   }
}

function reportTypeLabel(reportType: string | undefined) {
   switch (reportType) {
      case "profit_and_loss":
         return "DRE";
      case "cash_flow":
         return "Fluxo de caixa";
      case "expenses_by_cost_center":
         return "Despesas por Centro de Custo";
      case "expenses_by_category":
         return "Despesas por categoria";
      case "aging":
         return "Aging";
      default:
         return undefined;
   }
}

function formatCurrency(value: string) {
   return format(of(value, "BRL"), "pt-BR");
}

function MessageActions({
   align,
   messageId,
   role,
}: {
   align: "start" | "end";
   messageId: string;
   role: MessageActionRole;
}) {
   const { deleteMessage } = useMontteActions();
   const isRunning = useMontteIsRunning();

   if (role === "system") return null;
   if (isRunning) return null;

   return (
      <ActionBarPrimitive.Root
         className={cn(
            "flex items-center gap-2 text-muted-foreground",
            align === "end" ? "justify-end" : "justify-start",
         )}
         hideWhenRunning
      >
         <ActionBarPrimitive.Copy asChild>
            <Button
               aria-label="Copiar"
               className="h-7 w-7 text-muted-foreground hover:text-foreground"
               size="icon"
               variant="ghost"
            >
               <Copy className="size-4" />
            </Button>
         </ActionBarPrimitive.Copy>
         {role === "user" ? (
            <ActionBarPrimitive.Edit asChild>
               <Button
                  aria-label="Editar"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  size="icon"
                  variant="ghost"
               >
                  <Pencil className="size-4" />
               </Button>
            </ActionBarPrimitive.Edit>
         ) : null}
         {role === "assistant" ? (
            <>
               <ActionBarPrimitive.FeedbackPositive asChild>
                  <Button
                     aria-label="Gostei da mensagem"
                     className="h-7 w-7 text-muted-foreground hover:text-emerald-500 data-[submitted=true]:text-emerald-500"
                     size="icon"
                     variant="ghost"
                  >
                     <ThumbsUp className="size-4" />
                  </Button>
               </ActionBarPrimitive.FeedbackPositive>
               <ActionBarPrimitive.FeedbackNegative asChild>
                  <Button
                     aria-label="Não gostei da mensagem"
                     className="h-7 w-7 text-muted-foreground hover:text-destructive data-[submitted=true]:text-destructive"
                     size="icon"
                     variant="ghost"
                  >
                     <ThumbsDown className="size-4" />
                  </Button>
               </ActionBarPrimitive.FeedbackNegative>
               <ActionBarPrimitive.Reload asChild>
                  <Button
                     aria-label="Regenerar resposta"
                     className="h-7 w-7 text-muted-foreground hover:text-foreground"
                     size="icon"
                     variant="ghost"
                  >
                     <RefreshCw className="size-4" />
                  </Button>
               </ActionBarPrimitive.Reload>
            </>
         ) : null}
         <Button
            aria-label="Excluir mensagem"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            disabled={isRunning}
            onClick={() => void deleteMessage(messageId)}
            size="icon"
            variant="ghost"
         >
            <Trash2 className="size-4" />
         </Button>
      </ActionBarPrimitive.Root>
   );
}
