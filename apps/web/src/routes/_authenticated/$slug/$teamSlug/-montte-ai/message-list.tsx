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
import {
   ArrowDown,
   Check,
   Copy,
   Loader2,
   Pencil,
   RefreshCw,
   ThumbsDown,
   ThumbsUp,
   Trash2,
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

const TOOL_LABELS: Record<string, string> = {
   advisor_consult: "Consultando advisor sênior",
   generate_financial_report: "Gerando relatório financeiro",
   get_financial_summary: "Consultando resumo financeiro",
   list_bank_accounts: "Listando contas bancárias",
   list_card_statements: "Listando faturas",
   list_categories: "Listando categorias",
   list_cost_centers: "Listando Centros de Custo",
   list_credit_cards: "Listando cartões",
   search_transactions: "Buscando lançamentos",
   __lazy__tool__discovery__: "Carregando ferramentas",
   catalog_search: "Consultando catálogo",
   meter_create: "Criando medidor",
   meter_details: "Detalhando medidor",
   meter_remove: "Removendo medidor",
   meter_update: "Atualizando medidor",
   meters_set_active: "Ativando ou arquivando medidores",
};

const toolArtifactSchema = z.object({
   state: z.string().optional(),
   approvalId: z.string().optional(),
   approvalApproved: z.boolean().optional(),
});

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
            <div className="mx-auto flex min-h-full w-full max-w-5xl flex-1 flex-col p-4">
               <AuiIf condition={(s) => s.thread.isEmpty}>
                  <div className="flex grow flex-col items-center justify-center gap-6 p-4">
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
   const label = TOOL_LABELS[part.toolName] ?? "Executando ferramenta";

   return (
      <div className="flex w-full flex-col gap-2 rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground">
         <div className="flex min-w-0 items-center gap-2">
            <span
               className={cn(
                  "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
                  running
                     ? "bg-muted text-muted-foreground"
                     : completed
                       ? "bg-emerald-500/10 text-emerald-500"
                       : "bg-muted text-muted-foreground",
               )}
            >
               {running ? (
                  <Loader2 className="size-2 animate-spin" />
               ) : completed ? (
                  <Check className="size-2" />
               ) : (
                  <Loader2 className="size-2 animate-spin" />
               )}
            </span>
            <span className="min-w-0 flex-1 truncate">{label}</span>
            <span className="shrink-0 text-xs">
               {running ? "Em andamento" : completed ? "Concluída" : "Na fila"}
            </span>
         </div>
         {needsDecision ? (
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-2">
               <span className="min-w-0 flex-1 truncate">
                  Aprovar <span className="font-medium">{label}</span>?
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
