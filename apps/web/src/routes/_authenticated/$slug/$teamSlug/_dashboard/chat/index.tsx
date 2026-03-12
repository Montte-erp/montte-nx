import { AssistantRuntimeProvider } from "@assistant-ui/react";
import {
   AssistantChatTransport,
   useChatRuntime,
} from "@assistant-ui/react-ai-sdk";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
   createFileRoute,
   useNavigate,
   useParams,
} from "@tanstack/react-router";
import { useMemo, useRef } from "react";
import { chatContextStore } from "@/features/rubi-chat/stores/chat-context-store";
import { Thread } from "@/features/rubi-chat/ui/thread";
import { useActiveTeam } from "@/hooks/use-active-team";
import { orpc } from "@/integrations/orpc/client";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/chat/",
)({
   component: ChatIndexPage,
});

const QUICK_SUGGESTIONS = [
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

function ChatIndexPageContent({ teamId }: { teamId: string }) {
   const { slug, teamSlug } = useParams({
      from: "/_authenticated/$slug/$teamSlug/_dashboard",
   });
   const navigate = useNavigate();
   const queryClient = useQueryClient();

   const threadIdRef = useRef<string | undefined>(undefined);
   const hasNavigated = useRef(false);
   const createThread = useMutation(orpc.chat.createThread.mutationOptions({}));
   const createThreadRef = useRef(createThread.mutateAsync);
   createThreadRef.current = createThread.mutateAsync;

   // Transport lazily creates a thread on the first message send
   const transport = useMemo(
      () =>
         new AssistantChatTransport({
            api: "/api/chat",
            body: async () => {
               if (!threadIdRef.current) {
                  const thread = await createThreadRef.current({ teamId });
                  threadIdRef.current = thread.id;
               }
               const { mode, model, thinkingBudget } = chatContextStore.state;
               return {
                  teamId,
                  threadId: threadIdRef.current,
                  mode,
                  model,
                  ...(thinkingBudget > 0 ? { thinkingBudget } : {}),
               };
            },
         }),
      [teamId],
   );

   const runtime = useChatRuntime({
      transport,
      onFinish: () => {
         if (threadIdRef.current && !hasNavigated.current) {
            hasNavigated.current = true;
            // Invalidate so $threadId.tsx fetches fresh data after navigation
            queryClient.invalidateQueries();
            navigate({
               to: "/$slug/$teamSlug/chat/$threadId",
               params: { slug, teamSlug, threadId: threadIdRef.current },
               replace: true,
            });
         }
      },
   });

   return (
      <AssistantRuntimeProvider runtime={runtime}>
         <Thread
            quickSuggestions={QUICK_SUGGESTIONS}
            welcomeIconUrl="/mascot.svg"
            welcomeSubtitle="Seu assistente financeiro e ERP com IA."
            welcomeTitle="Como posso te ajudar?"
         />
      </AssistantRuntimeProvider>
   );
}

function ChatIndexPage() {
   const { activeTeamId } = useActiveTeam();
   if (!activeTeamId) return null;
   return <ChatIndexPageContent teamId={activeTeamId} />;
}
