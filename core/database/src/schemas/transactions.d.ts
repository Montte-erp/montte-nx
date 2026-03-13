import { z } from "zod";
export declare const paymentMethodEnum: import("drizzle-orm/pg-core").PgEnum<
   [
      "pix",
      "credit_card",
      "debit_card",
      "boleto",
      "cash",
      "transfer",
      "other",
      "cheque",
      "automatic_debit",
   ]
>;
export declare const transactionTypeEnum: import("drizzle-orm/pg-core").PgEnum<
   ["income", "expense", "transfer"]
>;
export declare const transactions: import("drizzle-orm/pg-core").PgTableWithColumns<{
   name: "transactions";
   schema: undefined;
   columns: {
      id: import("drizzle-orm/pg-core").PgBuildColumn<
         "transactions",
         import("drizzle-orm/pg-core").SetIsPrimaryKey<
            import("drizzle-orm/pg-core").SetHasDefault<
               import("drizzle-orm/pg-core").PgUUIDBuilder
            >
         >,
         {
            name: string;
            tableName: "transactions";
            dataType: "string uuid";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            identity: undefined;
            generated: undefined;
         }
      >;
      teamId: import("drizzle-orm/pg-core").PgBuildColumn<
         "transactions",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgUUIDBuilder
         >,
         {
            name: string;
            tableName: "transactions";
            dataType: "string uuid";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            identity: undefined;
            generated: undefined;
         }
      >;
      name: import("drizzle-orm/pg-core").PgBuildColumn<
         "transactions",
         import("drizzle-orm/pg-core").PgTextBuilder<[string, ...string[]]>,
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
         }
      >;
      type: import("drizzle-orm/pg-core").PgBuildColumn<
         "transactions",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgEnumColumnBuilder<
               ["income", "expense", "transfer"]
            >
         >,
         {
            name: string;
            tableName: "transactions";
            dataType: "string enum";
            data: "expense" | "income" | "transfer";
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: ["income", "expense", "transfer"];
            identity: undefined;
            generated: undefined;
         }
      >;
      amount: import("drizzle-orm/pg-core").PgBuildColumn<
         "transactions",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgNumericBuilder
         >,
         {
            name: string;
            tableName: "transactions";
            dataType: "string numeric";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            identity: undefined;
            generated: undefined;
         }
      >;
      description: import("drizzle-orm/pg-core").PgBuildColumn<
         "transactions",
         import("drizzle-orm/pg-core").PgTextBuilder<[string, ...string[]]>,
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
         }
      >;
      date: import("drizzle-orm/pg-core").PgBuildColumn<
         "transactions",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgDateStringBuilder
         >,
         {
            name: string;
            tableName: "transactions";
            dataType: "string date";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            identity: undefined;
            generated: undefined;
         }
      >;
      bankAccountId: import("drizzle-orm/pg-core").PgBuildColumn<
         "transactions",
         import("drizzle-orm/pg-core").PgUUIDBuilder,
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
         }
      >;
      destinationBankAccountId: import("drizzle-orm/pg-core").PgBuildColumn<
         "transactions",
         import("drizzle-orm/pg-core").PgUUIDBuilder,
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
         }
      >;
      creditCardId: import("drizzle-orm/pg-core").PgBuildColumn<
         "transactions",
         import("drizzle-orm/pg-core").PgUUIDBuilder,
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
         }
      >;
      categoryId: import("drizzle-orm/pg-core").PgBuildColumn<
         "transactions",
         import("drizzle-orm/pg-core").PgUUIDBuilder,
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
         }
      >;
      attachmentUrl: import("drizzle-orm/pg-core").PgBuildColumn<
         "transactions",
         import("drizzle-orm/pg-core").PgTextBuilder<[string, ...string[]]>,
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
         }
      >;
      paymentMethod: import("drizzle-orm/pg-core").PgBuildColumn<
         "transactions",
         import("drizzle-orm/pg-core").PgEnumColumnBuilder<
            [
               "pix",
               "credit_card",
               "debit_card",
               "boleto",
               "cash",
               "transfer",
               "other",
               "cheque",
               "automatic_debit",
            ]
         >,
         {
            name: string;
            tableName: "transactions";
            dataType: "string enum";
            data:
               | "automatic_debit"
               | "boleto"
               | "cash"
               | "cheque"
               | "credit_card"
               | "debit_card"
               | "other"
               | "pix"
               | "transfer";
            driverParam: string;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [
               "pix",
               "credit_card",
               "debit_card",
               "boleto",
               "cash",
               "transfer",
               "other",
               "cheque",
               "automatic_debit",
            ];
            identity: undefined;
            generated: undefined;
         }
      >;
      isInstallment: import("drizzle-orm/pg-core").PgBuildColumn<
         "transactions",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").SetHasDefault<
               import("drizzle-orm/pg-core").PgBooleanBuilder
            >
         >,
         {
            name: string;
            tableName: "transactions";
            dataType: "boolean";
            data: boolean;
            driverParam: boolean;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            identity: undefined;
            generated: undefined;
         }
      >;
      installmentCount: import("drizzle-orm/pg-core").PgBuildColumn<
         "transactions",
         import("drizzle-orm/pg-core").PgIntegerBuilder,
         {
            name: string;
            tableName: "transactions";
            dataType: "number int32";
            data: number;
            driverParam: string | number;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            identity: undefined;
            generated: undefined;
         }
      >;
      installmentNumber: import("drizzle-orm/pg-core").PgBuildColumn<
         "transactions",
         import("drizzle-orm/pg-core").PgIntegerBuilder,
         {
            name: string;
            tableName: "transactions";
            dataType: "number int32";
            data: number;
            driverParam: string | number;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            identity: undefined;
            generated: undefined;
         }
      >;
      installmentGroupId: import("drizzle-orm/pg-core").PgBuildColumn<
         "transactions",
         import("drizzle-orm/pg-core").PgUUIDBuilder,
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
         }
      >;
      statementPeriod: import("drizzle-orm/pg-core").PgBuildColumn<
         "transactions",
         import("drizzle-orm/pg-core").PgTextBuilder<[string, ...string[]]>,
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
         }
      >;
      contactId: import("drizzle-orm/pg-core").PgBuildColumn<
         "transactions",
         import("drizzle-orm/pg-core").PgUUIDBuilder,
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
         }
      >;
      createdAt: import("drizzle-orm/pg-core").PgBuildColumn<
         "transactions",
         import("drizzle-orm/pg-core").SetHasDefault<
            import("drizzle-orm/pg-core").SetNotNull<
               import("drizzle-orm/pg-core").PgTimestampBuilder
            >
         >,
         {
            name: string;
            tableName: "transactions";
            dataType: "object date";
            data: Date;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            identity: undefined;
            generated: undefined;
         }
      >;
      updatedAt: import("drizzle-orm/pg-core").PgBuildColumn<
         "transactions",
         import("drizzle-orm/pg-core").SetHasDefault<
            import("drizzle-orm/pg-core").SetHasDefault<
               import("drizzle-orm/pg-core").SetNotNull<
                  import("drizzle-orm/pg-core").PgTimestampBuilder
               >
            >
         >,
         {
            name: string;
            tableName: "transactions";
            dataType: "object date";
            data: Date;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            identity: undefined;
            generated: undefined;
         }
      >;
   };
   dialect: "pg";
}>;
export declare const transactionTags: import("drizzle-orm/pg-core").PgTableWithColumns<{
   name: "transaction_tags";
   schema: undefined;
   columns: {
      transactionId: import("drizzle-orm/pg-core").PgBuildColumn<
         "transaction_tags",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgUUIDBuilder
         >,
         {
            name: string;
            tableName: "transaction_tags";
            dataType: "string uuid";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            identity: undefined;
            generated: undefined;
         }
      >;
      tagId: import("drizzle-orm/pg-core").PgBuildColumn<
         "transaction_tags",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgUUIDBuilder
         >,
         {
            name: string;
            tableName: "transaction_tags";
            dataType: "string uuid";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            identity: undefined;
            generated: undefined;
         }
      >;
   };
   dialect: "pg";
}>;
export declare const transactionItems: import("drizzle-orm/pg-core").PgTableWithColumns<{
   name: "transaction_items";
   schema: undefined;
   columns: {
      id: import("drizzle-orm/pg-core").PgBuildColumn<
         "transaction_items",
         import("drizzle-orm/pg-core").SetIsPrimaryKey<
            import("drizzle-orm/pg-core").SetHasDefault<
               import("drizzle-orm/pg-core").PgUUIDBuilder
            >
         >,
         {
            name: string;
            tableName: "transaction_items";
            dataType: "string uuid";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            identity: undefined;
            generated: undefined;
         }
      >;
      transactionId: import("drizzle-orm/pg-core").PgBuildColumn<
         "transaction_items",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgUUIDBuilder
         >,
         {
            name: string;
            tableName: "transaction_items";
            dataType: "string uuid";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            identity: undefined;
            generated: undefined;
         }
      >;
      serviceId: import("drizzle-orm/pg-core").PgBuildColumn<
         "transaction_items",
         import("drizzle-orm/pg-core").PgUUIDBuilder,
         {
            name: string;
            tableName: "transaction_items";
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
         }
      >;
      teamId: import("drizzle-orm/pg-core").PgBuildColumn<
         "transaction_items",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgUUIDBuilder
         >,
         {
            name: string;
            tableName: "transaction_items";
            dataType: "string uuid";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            identity: undefined;
            generated: undefined;
         }
      >;
      description: import("drizzle-orm/pg-core").PgBuildColumn<
         "transaction_items",
         import("drizzle-orm/pg-core").PgTextBuilder<[string, ...string[]]>,
         {
            name: string;
            tableName: "transaction_items";
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
         }
      >;
      quantity: import("drizzle-orm/pg-core").PgBuildColumn<
         "transaction_items",
         import("drizzle-orm/pg-core").SetHasDefault<
            import("drizzle-orm/pg-core").SetNotNull<
               import("drizzle-orm/pg-core").PgNumericBuilder
            >
         >,
         {
            name: string;
            tableName: "transaction_items";
            dataType: "string numeric";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            identity: undefined;
            generated: undefined;
         }
      >;
      unitPrice: import("drizzle-orm/pg-core").PgBuildColumn<
         "transaction_items",
         import("drizzle-orm/pg-core").SetHasDefault<
            import("drizzle-orm/pg-core").SetNotNull<
               import("drizzle-orm/pg-core").PgNumericBuilder
            >
         >,
         {
            name: string;
            tableName: "transaction_items";
            dataType: "string numeric";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            identity: undefined;
            generated: undefined;
         }
      >;
      createdAt: import("drizzle-orm/pg-core").PgBuildColumn<
         "transaction_items",
         import("drizzle-orm/pg-core").SetHasDefault<
            import("drizzle-orm/pg-core").SetNotNull<
               import("drizzle-orm/pg-core").PgTimestampBuilder
            >
         >,
         {
            name: string;
            tableName: "transaction_items";
            dataType: "object date";
            data: Date;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            identity: undefined;
            generated: undefined;
         }
      >;
   };
   dialect: "pg";
}>;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type TransactionType = (typeof transactionTypeEnum.enumValues)[number];
export type TransactionTag = typeof transactionTags.$inferSelect;
export type NewTransactionTag = typeof transactionTags.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type NewTransactionItem = typeof transactionItems.$inferInsert;
export declare const createTransactionSchema: z.ZodObject<
   {
      paymentMethod: z.ZodOptional<
         z.ZodNullable<
            z.ZodEnum<{
               automatic_debit: "automatic_debit";
               boleto: "boleto";
               cash: "cash";
               cheque: "cheque";
               credit_card: "credit_card";
               debit_card: "debit_card";
               other: "other";
               pix: "pix";
               transfer: "transfer";
            }>
         >
      >;
      isInstallment: z.ZodOptional<z.ZodBoolean>;
      installmentCount: z.ZodOptional<z.ZodNullable<z.ZodInt>>;
      installmentNumber: z.ZodOptional<z.ZodNullable<z.ZodInt>>;
      installmentGroupId: z.ZodOptional<z.ZodNullable<z.ZodUUID>>;
      statementPeriod: z.ZodOptional<z.ZodNullable<z.ZodString>>;
      name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
      type: z.ZodEnum<{
         expense: "expense";
         income: "income";
         transfer: "transfer";
      }>;
      amount: z.ZodString;
      date: z.ZodString;
      description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
      bankAccountId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
      destinationBankAccountId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
      creditCardId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
      categoryId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
      contactId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
      attachmentUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
   },
   {
      out: {};
      in: {};
   }
>;
export declare const updateTransactionSchema: z.ZodObject<
   {
      paymentMethod: z.ZodOptional<
         z.ZodOptional<
            z.ZodNullable<
               z.ZodEnum<{
                  automatic_debit: "automatic_debit";
                  boleto: "boleto";
                  cash: "cash";
                  cheque: "cheque";
                  credit_card: "credit_card";
                  debit_card: "debit_card";
                  other: "other";
                  pix: "pix";
                  transfer: "transfer";
               }>
            >
         >
      >;
      isInstallment: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
      installmentCount: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodInt>>>;
      installmentNumber: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodInt>>>;
      installmentGroupId: z.ZodOptional<
         z.ZodOptional<z.ZodNullable<z.ZodUUID>>
      >;
      statementPeriod: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
      name: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
      amount: z.ZodOptional<z.ZodOptional<z.ZodString>>;
      date: z.ZodOptional<z.ZodOptional<z.ZodString>>;
      description: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
      bankAccountId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
      destinationBankAccountId: z.ZodOptional<
         z.ZodOptional<z.ZodNullable<z.ZodString>>
      >;
      creditCardId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
      categoryId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
      contactId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
      attachmentUrl: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
   },
   {
      out: {};
      in: {};
   }
>;
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
//# sourceMappingURL=transactions.d.ts.map
