import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { useRubiRuntime } from "@/features/rubi-chat/hooks/use-rubi-runtime";
import type { QuickSuggestion } from "@/features/rubi-chat/ui/thread";
import { formatTimeAgo, Thread } from "@/features/rubi-chat/ui/thread";
import { useActiveTeam } from "@/hooks/use-active-team";
import { orpc } from "@/integrations/orpc/client";

const QUICK_SUGGESTIONS: QuickSuggestion[] = [
   {
      label: "Resumo financeiro",
      prompt: "Mostre um resumo das minhas finanças de ",
   },
   {
      label: "Analisar gastos",
      prompt: "Analise meus gastos e sugira onde posso economizar: ",
   },
   { label: "Contas a pagar", prompt: "Quais são minhas contas a pagar em " },
   {
      label: "Criar meta",
      prompt: "Me ajude a criar uma meta financeira para ",
   },
   { label: "Relatório", prompt: "Gere um relatório financeiro do mês de " },
];

function RecentThreadsList({ teamId }: { teamId: string }) {
   const { data } = useSuspenseQuery(
      orpc.chat.listThreads.queryOptions({
         input: { teamId, page: 0, perPage: 5 },
      }),
   );

   return (
      <>
         {data.threads.map((t) => (
            <div
               className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left"
               key={t.id}
            >
               <span className="flex-1 truncate text-sm text-foreground/80">
                  {t.title}
               </span>
               <span className="shrink-0 text-xs text-muted-foreground/60">
                  {formatTimeAgo(t.updatedAt)}
               </span>
            </div>
         ))}
      </>
   );
}

function RubiChatTabInner({ teamId }: { teamId: string }) {
   return (
      <div className="h-full [&_.aui-user-message-content]:bg-background [&_.aui-user-message-content]:text-foreground">
         <Thread
            quickSuggestions={QUICK_SUGGESTIONS}
            recentThreadsSlot={
               <Suspense fallback={null}>
                  <RecentThreadsList teamId={teamId} />
               </Suspense>
            }
            welcomeIconUrl="/mascot.svg"
            welcomeSubtitle="Seu assistente financeiro e ERP com IA."
            welcomeTitle="Como posso te ajudar?"
         />
      </div>
   );
}

export function RubiChatTab() {
   const { activeTeamId } = useActiveTeam();
   const runtime = useRubiRuntime({ teamId: activeTeamId ?? "" });

   if (!activeTeamId) return null;

   return (
      <AssistantRuntimeProvider runtime={runtime}>
         <RubiChatTabInner teamId={activeTeamId} />
      </AssistantRuntimeProvider>
   );
}
