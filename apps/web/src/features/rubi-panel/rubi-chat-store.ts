import { createStore } from "@tanstack/react-store";

export interface RubiStreamInput {
   threadId: string;
   turnId: string;
   pageContext: {
      skillHint?: string;
      route?: string;
      title?: string;
   };
}

export interface RubiChatState {
   threadId: string | null;
   streamInput: RubiStreamInput | null;
}

export const rubiChatStore = createStore<RubiChatState>({
   threadId: null,
   streamInput: null,
});

export function setRubiThreadId(threadId: string | null) {
   rubiChatStore.setState((s) => ({ ...s, threadId }));
}

export function setRubiStreamInput(streamInput: RubiStreamInput | null) {
   rubiChatStore.setState((s) => ({ ...s, streamInput }));
}

export function resetRubiChat() {
   rubiChatStore.setState(() => ({ threadId: null, streamInput: null }));
}

export function loadRubiThread(threadId: string) {
   rubiChatStore.setState(() => ({ threadId, streamInput: null }));
}
