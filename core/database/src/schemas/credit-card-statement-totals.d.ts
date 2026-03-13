export declare const creditCardStatementTotals: import("drizzle-orm/pg-core").PgMaterializedViewWithSelection<
   "credit_card_statement_totals",
   false,
   {
      creditCardId: import("drizzle-orm/pg-core").PgColumn<
         "string uuid",
         Omit<
            {
               name: string;
               tableName: "transactions";
               dataType: "string uuid";
               data: string;
               driverParam: string;
               notNull: false;
               hasDefault: false;
               isPrimaryKey: false;
               isAutoincrement: false;
               hasRuntimeDefault: false;
               enumValues: undefined;
               identity: undefined;
               generated: undefined;
            },
            "tableName"
         > & {
            tableName: "credit_card_statement_totals";
            insertType: unknown;
         },
         {}
      >;
      statementPeriod: import("drizzle-orm/pg-core").PgColumn<
         "string",
         Omit<
            {
               name: string;
               tableName: "transactions";
               dataType: "string";
               data: string;
               driverParam: string;
               notNull: false;
               hasDefault: false;
               isPrimaryKey: false;
               isAutoincrement: false;
               hasRuntimeDefault: false;
               enumValues: undefined;
               identity: undefined;
               generated: undefined;
            },
            "tableName"
         > & {
            tableName: "credit_card_statement_totals";
            insertType: unknown;
         },
         {}
      >;
      totalPurchases: import("drizzle-orm").SQL.Aliased<string>;
      transactionCount: import("drizzle-orm").SQL.Aliased<number>;
   }
>;
//# sourceMappingURL=credit-card-statement-totals.d.ts.map
