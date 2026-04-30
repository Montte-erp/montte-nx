import { useSuspenseQuery } from "@tanstack/react-query";
import { shallow, useStore } from "@tanstack/react-store";
import {
   approveAllRubiTools,
   approveRubiTool,
   getRubiUserMessageText,
   loadRubiThreadById,
   rejectAllRubiTools,
   rejectRubiTool,
   resetRubiChat,
   rubiChatStore,
   rubiRecentThreadsQueryOptions,
   RUBI_SCOPES_BY_ID,
   RUBI_SCOPE_IDS,
   RUBI_SUGGESTION_IDS,
   selectRubiScope,
   sendRubiMessage,
   setRubiComposerValue,
   setRubiScopeOpen,
} from "./rubi-chat-store";

export function useRubiChat() {
   const state = useStore(
      rubiChatStore,
      (value) => ({
         activeThreadId: value.activeThreadId,
         composerValue: value.composerValue,
         isStreaming: value.isStreaming,
         messages: value.messages,
         pendingApprovalIds: value.pendingApprovalIds,
         scopeOpen: value.scopeOpen,
         selectedScopeId: value.selectedScopeId,
      }),
      shallow,
   );

   const recentsQuery = useSuspenseQuery(rubiRecentThreadsQueryOptions());
   const selectedScope = RUBI_SCOPES_BY_ID[state.selectedScopeId];
   const scopes = RUBI_SCOPE_IDS.map((id) => ({
      id,
      ...RUBI_SCOPES_BY_ID[id],
   }));
   const suggestions = RUBI_SUGGESTION_IDS.map((id) => ({
      id,
      ...RUBI_SCOPES_BY_ID[id],
   }));

   return {
      ...state,
      hasConversation: state.messages.length > 0,
      recents: recentsQuery.data.threads,
      scopes,
      selectedScope: { id: state.selectedScopeId, ...selectedScope },
      suggestions,
      approveAll: approveAllRubiTools,
      approveTool: approveRubiTool,
      getUserMessageText: getRubiUserMessageText,
      loadThread: loadRubiThreadById,
      rejectAll: rejectAllRubiTools,
      rejectTool: rejectRubiTool,
      reset: resetRubiChat,
      selectScope: selectRubiScope,
      sendMessage: sendRubiMessage,
      setComposerValue: setRubiComposerValue,
      setScopeOpen: setRubiScopeOpen,
   };
}
