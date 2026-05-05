export const AGENT_PROMPTS = {
   root: "montte-rubi-root",
   advisor: "montte-rubi-advisor",
   skillServices: "montte-rubi-skill-services",
} as const;

export type AgentPromptKey = keyof typeof AGENT_PROMPTS;

export const AGENT_SKILL_IDS = {
   services: "services",
} as const;

export type AgentSkillId =
   (typeof AGENT_SKILL_IDS)[keyof typeof AGENT_SKILL_IDS];
