export type TaskType = "setup" | "onboarding" | "explore";
export type ProductId = "finance";

export interface TaskDefinition {
   id: string;
   title: string;
   description: string;
   type: TaskType;
   product: ProductId;
   dependsOn?: string;
   autoDetect: boolean;
   route: string;
}

export const TASK_DEFINITIONS: TaskDefinition[] = [
   {
      id: "connect_bank_account",
      title: "Conecte uma conta bancária",
      description:
         "Adicione sua primeira conta para começar a registrar transações.",
      type: "setup",
      product: "finance",
      autoDetect: true,
      route: "/$slug/$teamSlug/bank-accounts",
   },
   {
      id: "create_category",
      title: "Crie uma categoria",
      description: "Organize suas transações criando uma categoria de gastos.",
      type: "onboarding",
      product: "finance",
      dependsOn: "connect_bank_account",
      autoDetect: true,
      route: "/$slug/$teamSlug/categories",
   },
   {
      id: "add_transaction",
      title: "Registre sua primeira transação",
      description:
         "Adicione uma receita ou despesa para começar a acompanhar suas finanças.",
      type: "onboarding",
      product: "finance",
      dependsOn: "create_category",
      autoDetect: true,
      route: "/$slug/$teamSlug/transactions",
   },
   {
      id: "create_insight",
      title: "Veja seus insights financeiros",
      description: "Explore o dashboard com métricas sobre suas finanças.",
      type: "explore",
      product: "finance",
      dependsOn: "add_transaction",
      autoDetect: true,
      route: "/$slug/$teamSlug/analytics/dashboards",
   },
];

export function getTasksForProducts(
   selectedProducts: string[] | null,
): TaskDefinition[] {
   const products = selectedProducts ?? [];
   const hasFinance = products.includes("finance");
   if (!hasFinance) return [];
   return TASK_DEFINITIONS;
}

export function getProductLabel(product: ProductId): string {
   switch (product) {
      case "finance":
         return "Finanças Pessoais";
   }
}

export const SDK_INSTALL_TASK_IDS: readonly string[] = [];
