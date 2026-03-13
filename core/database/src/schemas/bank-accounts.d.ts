import { z } from "zod";
export declare const bankAccountTypeEnum: import("drizzle-orm/pg-core").PgEnum<
   ["checking", "savings", "investment", "payment", "cash"]
>;
export declare const bankAccountStatusEnum: import("drizzle-orm/pg-core").PgEnum<
   ["active", "archived"]
>;
export declare const bankAccounts: import("drizzle-orm/pg-core").PgTableWithColumns<{
   name: "bank_accounts";
   schema: undefined;
   columns: {
      id: import("drizzle-orm/pg-core").PgBuildColumn<
         "bank_accounts",
         import("drizzle-orm/pg-core").SetIsPrimaryKey<
            import("drizzle-orm/pg-core").SetHasDefault<
               import("drizzle-orm/pg-core").PgUUIDBuilder
            >
         >,
         {
            name: string;
            tableName: "bank_accounts";
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
         "bank_accounts",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgUUIDBuilder
         >,
         {
            name: string;
            tableName: "bank_accounts";
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
         "bank_accounts",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgTextBuilder<[string, ...string[]]>
         >,
         {
            name: string;
            tableName: "bank_accounts";
            dataType: "string";
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
      type: import("drizzle-orm/pg-core").PgBuildColumn<
         "bank_accounts",
         import("drizzle-orm/pg-core").SetHasDefault<
            import("drizzle-orm/pg-core").SetNotNull<
               import("drizzle-orm/pg-core").PgEnumColumnBuilder<
                  ["checking", "savings", "investment", "payment", "cash"]
               >
            >
         >,
         {
            name: string;
            tableName: "bank_accounts";
            dataType: "string enum";
            data: "cash" | "checking" | "investment" | "payment" | "savings";
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [
               "checking",
               "savings",
               "investment",
               "payment",
               "cash",
            ];
            identity: undefined;
            generated: undefined;
         }
      >;
      status: import("drizzle-orm/pg-core").PgBuildColumn<
         "bank_accounts",
         import("drizzle-orm/pg-core").SetHasDefault<
            import("drizzle-orm/pg-core").SetNotNull<
               import("drizzle-orm/pg-core").PgEnumColumnBuilder<
                  ["active", "archived"]
               >
            >
         >,
         {
            name: string;
            tableName: "bank_accounts";
            dataType: "string enum";
            data: "active" | "archived";
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: ["active", "archived"];
            identity: undefined;
            generated: undefined;
         }
      >;
      color: import("drizzle-orm/pg-core").PgBuildColumn<
         "bank_accounts",
         import("drizzle-orm/pg-core").SetHasDefault<
            import("drizzle-orm/pg-core").SetNotNull<
               import("drizzle-orm/pg-core").PgTextBuilder<
                  [string, ...string[]]
               >
            >
         >,
         {
            name: string;
            tableName: "bank_accounts";
            dataType: "string";
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
      iconUrl: import("drizzle-orm/pg-core").PgBuildColumn<
         "bank_accounts",
         import("drizzle-orm/pg-core").PgTextBuilder<[string, ...string[]]>,
         {
            name: string;
            tableName: "bank_accounts";
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
      bankCode: import("drizzle-orm/pg-core").PgBuildColumn<
         "bank_accounts",
         import("drizzle-orm/pg-core").PgTextBuilder<[string, ...string[]]>,
         {
            name: string;
            tableName: "bank_accounts";
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
      bankName: import("drizzle-orm/pg-core").PgBuildColumn<
         "bank_accounts",
         import("drizzle-orm/pg-core").PgTextBuilder<[string, ...string[]]>,
         {
            name: string;
            tableName: "bank_accounts";
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
      branch: import("drizzle-orm/pg-core").PgBuildColumn<
         "bank_accounts",
         import("drizzle-orm/pg-core").PgTextBuilder<[string, ...string[]]>,
         {
            name: string;
            tableName: "bank_accounts";
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
      accountNumber: import("drizzle-orm/pg-core").PgBuildColumn<
         "bank_accounts",
         import("drizzle-orm/pg-core").PgTextBuilder<[string, ...string[]]>,
         {
            name: string;
            tableName: "bank_accounts";
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
      initialBalance: import("drizzle-orm/pg-core").PgBuildColumn<
         "bank_accounts",
         import("drizzle-orm/pg-core").SetHasDefault<
            import("drizzle-orm/pg-core").SetNotNull<
               import("drizzle-orm/pg-core").PgNumericBuilder
            >
         >,
         {
            name: string;
            tableName: "bank_accounts";
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
      initialBalanceDate: import("drizzle-orm/pg-core").PgBuildColumn<
         "bank_accounts",
         import("drizzle-orm/pg-core").PgDateStringBuilder,
         {
            name: string;
            tableName: "bank_accounts";
            dataType: "string date";
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
      notes: import("drizzle-orm/pg-core").PgBuildColumn<
         "bank_accounts",
         import("drizzle-orm/pg-core").PgTextBuilder<[string, ...string[]]>,
         {
            name: string;
            tableName: "bank_accounts";
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
      createdAt: import("drizzle-orm/pg-core").PgBuildColumn<
         "bank_accounts",
         import("drizzle-orm/pg-core").SetHasDefault<
            import("drizzle-orm/pg-core").SetNotNull<
               import("drizzle-orm/pg-core").PgTimestampBuilder
            >
         >,
         {
            name: string;
            tableName: "bank_accounts";
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
         "bank_accounts",
         import("drizzle-orm/pg-core").SetHasDefault<
            import("drizzle-orm/pg-core").SetHasDefault<
               import("drizzle-orm/pg-core").SetNotNull<
                  import("drizzle-orm/pg-core").PgTimestampBuilder
               >
            >
         >,
         {
            name: string;
            tableName: "bank_accounts";
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
export type BankAccount = typeof bankAccounts.$inferSelect;
export type NewBankAccount = typeof bankAccounts.$inferInsert;
export type BankAccountType = (typeof bankAccountTypeEnum.enumValues)[number];
export type BankAccountStatus =
   (typeof bankAccountStatusEnum.enumValues)[number];
export declare const createBankAccountSchema: z.ZodObject<
   {
      type: z.ZodOptional<
         z.ZodEnum<{
            cash: "cash";
            checking: "checking";
            investment: "investment";
            payment: "payment";
            savings: "savings";
         }>
      >;
      iconUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
      notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
      bankCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
      bankName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
      branch: z.ZodOptional<z.ZodNullable<z.ZodString>>;
      accountNumber: z.ZodOptional<z.ZodNullable<z.ZodString>>;
      name: z.ZodString;
      color: z.ZodDefault<z.ZodString>;
      initialBalance: z.ZodDefault<z.ZodString>;
      initialBalanceDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
   },
   {
      out: {};
      in: {};
   }
>;
export declare const updateBankAccountSchema: z.ZodObject<
   {
      type: z.ZodOptional<
         z.ZodOptional<
            z.ZodEnum<{
               cash: "cash";
               checking: "checking";
               investment: "investment";
               payment: "payment";
               savings: "savings";
            }>
         >
      >;
      iconUrl: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
      notes: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
      bankCode: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
      bankName: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
      branch: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
      accountNumber: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
      name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
      color: z.ZodOptional<z.ZodOptional<z.ZodString>>;
      initialBalance: z.ZodOptional<z.ZodOptional<z.ZodString>>;
      initialBalanceDate: z.ZodOptional<
         z.ZodOptional<z.ZodNullable<z.ZodString>>
      >;
   },
   {
      out: {};
      in: {};
   }
>;
export type CreateBankAccountInput = z.infer<typeof createBankAccountSchema>;
export type UpdateBankAccountInput = z.infer<typeof updateBankAccountSchema>;
//# sourceMappingURL=bank-accounts.d.ts.map
