export const RUBI_PROMPTS = {
   root: "montte-rubi-root",
   advisor: "montte-rubi-advisor",
   skillServices: "montte-rubi-skill-services",
} as const;

export type RubiPromptKey = keyof typeof RUBI_PROMPTS;

export const RUBI_SKILL_IDS = {
   services: "services",
} as const;

export type RubiSkillId = (typeof RUBI_SKILL_IDS)[keyof typeof RUBI_SKILL_IDS];
