export enum PlanName {
   FREE = "free",
   BASIC = "basic",
   ERP = "erp",
}

export const STRIPE_PLANS = [
   {
      annualPrice: null,
      description: "Para organizar suas finanças pessoais",
      displayName: "Free",
      features: [
         "1 usuário",
         "Transações ilimitadas",
         "Categorias",
         "Tags",
         "Importação OFX/CSV",
         "Exportação OFX/CSV/PDF",
      ],
      name: PlanName.FREE,
      price: "R$ 0",
   },
   {
      annualPrice: "R$ 190",
      description: "Para casais e pequenas equipes",
      displayName: "Básico",
      features: [
         "2 usuários",
         "Tudo do plano Free",
         "Anexos de comprovantes",
         "Colaboração em tempo real",
         "Funcionalidades de IA (em breve)",
         "Suporte por email",
         "14 dias de teste grátis",
      ],
      name: PlanName.BASIC,
      price: "R$ 19",
   },
   {
      annualPrice: "R$ 1500",
      description: "Para equipes e empresas em crescimento",
      displayName: "ERP",
      features: [
         "Membros ilimitados",
         "Todas as funcionalidades",
         "Centros de custo",
         "Fornecedores",
         "Modelos de juros",
         "Automações ilimitadas",
         "Funcionalidades de IA",
         "Suporte prioritário",
         "API access",
         "7 dias de teste grátis",
      ],
      highlighted: true,
      name: PlanName.ERP,
      price: "R$ 150",
   },
];
