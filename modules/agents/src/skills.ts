interface SkillMeta {
   id: string;
   name: string;
   description: string;
}

export const SKILLS: readonly SkillMeta[] = [];

export function buildSkillCatalog(): string {
   if (SKILLS.length === 0) return "Nenhuma skill operacional disponível.";
   return SKILLS.map((s) => `- \`${s.id}\` — ${s.name}: ${s.description}`).join(
      "\n",
   );
}
