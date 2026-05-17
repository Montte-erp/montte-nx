export const AGENT_PROMPTS = {
   root: "montte-ai-root",
   advisor: "montte-ai-advisor",
   generateTitle: "montte-ai-generate-title",
   refreshSuggestions: "montte-ai-refresh-suggestions",
} as const;

export type AgentPromptKey = keyof typeof AGENT_PROMPTS;

export const AGENT_JOB_QUEUES = {
   generateTitle: "agent-title",
   generateTitleDeadLetter: "agent-title-dlq",
   refreshSuggestions: "agent-suggestions",
   refreshSuggestionsDeadLetter: "agent-suggestions-dlq",
} as const;

export interface PageContext {
   route?: string;
   title?: string;
   summary?: string;
   skillHint?: string;
}

export type AgentJobQueueName =
   (typeof AGENT_JOB_QUEUES)[keyof typeof AGENT_JOB_QUEUES];
