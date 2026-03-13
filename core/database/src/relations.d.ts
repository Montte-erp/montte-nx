import * as schema from "@core/database/schema";
export declare const relations: import("drizzle-orm").ExtractTablesWithRelations<
   {
      user: {
         sessions: import("drizzle-orm").Many<"session">;
         accounts: import("drizzle-orm").Many<"account">;
         teamMembers: import("drizzle-orm").Many<"teamMember">;
         members: import("drizzle-orm").Many<"member">;
         invitations: import("drizzle-orm").Many<"invitation">;
         twoFactors: import("drizzle-orm").Many<"twoFactor">;
      };
      session: {
         user: import("drizzle-orm").One<"user", true>;
      };
      account: {
         user: import("drizzle-orm").One<"user", true>;
      };
      organization: {
         teams: import("drizzle-orm").Many<"team">;
         members: import("drizzle-orm").Many<"member">;
         invitations: import("drizzle-orm").Many<"invitation">;
      };
      team: {
         organization: import("drizzle-orm").One<"organization", true>;
         teamMembers: import("drizzle-orm").Many<"teamMember">;
      };
      teamMember: {
         team: import("drizzle-orm").One<"team", true>;
         user: import("drizzle-orm").One<"user", true>;
      };
      member: {
         organization: import("drizzle-orm").One<"organization", true>;
         user: import("drizzle-orm").One<"user", true>;
      };
      invitation: {
         organization: import("drizzle-orm").One<"organization", true>;
         user: import("drizzle-orm").One<"user", true>;
      };
      twoFactor: {
         user: import("drizzle-orm").One<"user", true>;
      };
      bills: {
         bankAccount: import("drizzle-orm").One<"bankAccounts", true>;
         category: import("drizzle-orm").One<"categories", true>;
         transaction: import("drizzle-orm").One<"transactions", true>;
         recurrenceSetting: import("drizzle-orm").One<
            "recurrenceSettings",
            true
         >;
      };
      recurrenceSettings: {
         bills: import("drizzle-orm").Many<"bills">;
      };
      budgetGoals: {
         category: import("drizzle-orm").One<"categories", true>;
      };
      categories: {
         parent: import("drizzle-orm").One<"categories", true>;
         children: import("drizzle-orm").Many<"categories">;
      };
      contacts: {
         transactions: import("drizzle-orm").Many<"transactions">;
      };
      dashboards: {
         organization: import("drizzle-orm").One<"organization", true>;
         team: import("drizzle-orm").One<"team", true>;
         createdByUser: import("drizzle-orm").One<"user", true>;
      };
      events: {
         organization: import("drizzle-orm").One<"organization", true>;
         user: import("drizzle-orm").One<"user", true>;
         team: import("drizzle-orm").One<"team", true>;
      };
      insights: {
         organization: import("drizzle-orm").One<"organization", true>;
         team: import("drizzle-orm").One<"team", true>;
         createdByUser: import("drizzle-orm").One<"user", true>;
      };
      financialGoals: {
         category: import("drizzle-orm").One<"categories", true>;
         movements: import("drizzle-orm").Many<"financialGoalMovements">;
      };
      financialGoalMovements: {
         goal: import("drizzle-orm").One<"financialGoals", true>;
         transaction: import("drizzle-orm").One<"transactions", true>;
      };
      inventoryProducts: {
         movements: import("drizzle-orm").Many<"inventoryMovements">;
      };
      inventoryMovements: {
         product: import("drizzle-orm").One<"inventoryProducts", true>;
      };
      services: {
         category: import("drizzle-orm").One<"categories", true>;
         tag: import("drizzle-orm").One<"tags", true>;
         variants: import("drizzle-orm").Many<"serviceVariants">;
         resources: import("drizzle-orm").Many<"resources">;
      };
      serviceVariants: {
         service: import("drizzle-orm").One<"services", true>;
         subscriptions: import("drizzle-orm").Many<"contactSubscriptions">;
      };
      contactSubscriptions: {
         contact: import("drizzle-orm").One<"contacts", true>;
         variant: import("drizzle-orm").One<"serviceVariants", true>;
      };
      resources: {
         service: import("drizzle-orm").One<"services", true>;
      };
      bankAccounts: {
         bills: import("drizzle-orm").Many<"bills">;
         transactions: import("drizzle-orm").Many<"transactions">;
         creditCards: import("drizzle-orm").Many<"creditCards">;
      };
      creditCards: {
         bankAccount: import("drizzle-orm").One<"bankAccounts", true>;
         statements: import("drizzle-orm").Many<"creditCardStatements">;
      };
      creditCardStatements: {
         creditCard: import("drizzle-orm").One<"creditCards", true>;
         bill: import("drizzle-orm").One<"bills", true>;
         paymentTransaction: import("drizzle-orm").One<"transactions", true>;
      };
      transactions: {
         bankAccount: import("drizzle-orm").One<"bankAccounts", true>;
         destinationBankAccount: import("drizzle-orm").One<
            "bankAccounts",
            true
         >;
         creditCard: import("drizzle-orm").One<"creditCards", true>;
         category: import("drizzle-orm").One<"categories", true>;
         transactionTags: import("drizzle-orm").Many<"transactionTags">;
         items: import("drizzle-orm").Many<"transactionItems">;
         contact: import("drizzle-orm").One<"contacts", true>;
      };
      transactionTags: {
         transaction: import("drizzle-orm").One<"transactions", true>;
         tag: import("drizzle-orm").One<"tags", true>;
      };
      transactionItems: {
         transaction: import("drizzle-orm").One<"transactions", true>;
         service: import("drizzle-orm").One<"services", true>;
      };
      webhookEndpoints: {
         organization: import("drizzle-orm").One<"organization", true>;
         team: import("drizzle-orm").One<"team", true>;
         deliveries: import("drizzle-orm").Many<"webhookDeliveries">;
      };
      webhookDeliveries: {
         webhookEndpoint: import("drizzle-orm").One<"webhookEndpoints", true>;
         event: import("drizzle-orm").One<"events", true>;
      };
   },
   import("drizzle-orm").ExtractTablesFromSchema<typeof schema>
>;
//# sourceMappingURL=relations.d.ts.map
