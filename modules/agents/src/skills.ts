interface SkillMeta {
   id: string;
   name: string;
   description: string;
   promptName: string;
}

export const SKILLS: readonly SkillMeta[] = [
   {
      id: "financeiro",
      name: "Financeiro",
      description:
         "Consulta lançamentos, saldos, categorias, Centros de Custo, contas, cartões, faturas e relatórios financeiros.",
      promptName: "montte-ai-skill-financeiro",
   },
];

export function buildSkillCatalog(): string {
   if (SKILLS.length === 0) return "Nenhuma skill operacional disponível.";
   return SKILLS.map((s) => `- \`${s.id}\` — ${s.name}: ${s.description}`).join(
      "\n",
   );
}

export function getSkillPromptName(skillId: string | undefined) {
   return SKILLS.find((skill) => skill.id === skillId)?.promptName;
}
