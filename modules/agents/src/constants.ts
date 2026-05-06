export const AGENT_PROMPTS = {
   root: "montte-ai-root",
   advisor: "montte-ai-advisor",
   skillServices: "montte-ai-skill-services",
   generateTitle: "montte-ai-generate-title",
   refreshSuggestions: "montte-ai-refresh-suggestions",
} as const;

export type AgentPromptKey = keyof typeof AGENT_PROMPTS;

export const AGENT_SKILL_IDS = {
   services: "services",
} as const;

export type AgentSkillId =
   (typeof AGENT_SKILL_IDS)[keyof typeof AGENT_SKILL_IDS];

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
