export const AGENT_PROMPTS = {
   root: "montte-ai-root",
   advisor: "montte-ai-advisor",
   generateTitle: "montte-ai-generate-title",
   refreshSuggestions: "montte-ai-refresh-suggestions",
} as const;

export type AgentPromptKey = keyof typeof AGENT_PROMPTS;

export const AGENT_QUEUES = {
   generateTitle: "agent-title",
   refreshSuggestions: "agent-suggestions",
} as const;

export interface PageContext {
   route?: string;
   title?: string;
   summary?: string;
   skillHint?: string;
}

export type AgentQueueName = (typeof AGENT_QUEUES)[keyof typeof AGENT_QUEUES];
