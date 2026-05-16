export type TaskType = "setup" | "onboarding" | "explore";
export type ProductId = "finance";
export type TaskRoute =
   | "/$slug/$teamSlug/bank-accounts"
   | "/$slug/$teamSlug/categories"
   | "/$slug/$teamSlug/transactions";

export interface TaskDefinition {
   id: string;
   title: string;
   description: string;
   type: TaskType;
   product: ProductId;
   dependsOn?: string;
   autoDetect: boolean;
   route: TaskRoute;
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
];

const VALID_PRODUCT_IDS: ReadonlySet<string> = new Set(
   TASK_DEFINITIONS.map((task) => task.product),
);

function isProductId(value: string): value is ProductId {
   return VALID_PRODUCT_IDS.has(value);
}

export function getTasksForProducts(
   selectedProducts: string[] | null,
): TaskDefinition[] {
   if (selectedProducts === null) return TASK_DEFINITIONS;
   const selectedValidProducts = selectedProducts.filter(isProductId);
   if (selectedValidProducts.length === 0) return TASK_DEFINITIONS;
   return TASK_DEFINITIONS.filter((task) =>
      selectedValidProducts.includes(task.product),
   );
}

export function getProductLabel(product: ProductId): string {
   switch (product) {
      case "finance":
         return "Financeiro";
   }
}

export const SDK_INSTALL_TASK_IDS: readonly string[] = [];
