import { createStore } from "@tanstack/react-store";

export interface RubiPageContext {
   skillHint?: string;
   route?: string;
   title?: string;
}

export interface RubiChatState {
   activeThreadId: string | null;
   hydratedThreadId: string | null;
   pageContext: RubiPageContext | undefined;
}

export const rubiChatStore = createStore<RubiChatState>({
   activeThreadId: null,
   hydratedThreadId: null,
   pageContext: undefined,
});

export function startRubiThread(
   threadId: string,
   pageContext: RubiPageContext,
) {
   rubiChatStore.setState((state) => ({
      ...state,
      activeThreadId: threadId,
      pageContext,
   }));
}

export function markRubiThreadHydrated(threadId: string) {
   rubiChatStore.setState((state) => ({
      ...state,
      hydratedThreadId: threadId,
   }));
}

export function resetRubiChat() {
   rubiChatStore.setState(() => ({
      activeThreadId: null,
      hydratedThreadId: null,
      pageContext: undefined,
   }));
}

export function loadRubiThread(threadId: string) {
   rubiChatStore.setState(() => ({
      activeThreadId: threadId,
      hydratedThreadId: null,
      pageContext: undefined,
   }));
}
