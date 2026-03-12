import type { ModelId } from "@packages/agents/models";
import { DEFAULT_CONTENT_MODEL_ID } from "@packages/agents/models";
import { Store } from "@tanstack/react-store";

interface ChatContextState {
   model: ModelId;
   thinkingBudget: number;
   mode: string | null;
   contextId: string | null;
   workflow: string | null;
}

const DEFAULT_STATE: ChatContextState = {
   model: DEFAULT_CONTENT_MODEL_ID,
   thinkingBudget: 0,
   mode: null,
   contextId: null,
   workflow: null,
};

export const chatContextStore = new Store<ChatContextState>(DEFAULT_STATE);

export function setChatModel(model: ModelId) {
   chatContextStore.setState((s) => ({ ...s, model }));
}

export function setChatThinkingBudget(thinkingBudget: number) {
   chatContextStore.setState((s) => ({ ...s, thinkingBudget }));
}

export function resetChatContext() {
   chatContextStore.setState(() => ({ ...DEFAULT_STATE }));
}
