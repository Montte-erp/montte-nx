import { z } from "zod";
export declare const creditCardStatusEnum: import("drizzle-orm/pg-core").PgEnum<
   ["active", "blocked", "cancelled"]
>;
export declare const creditCardBrandEnum: import("drizzle-orm/pg-core").PgEnum<
   ["visa", "mastercard", "elo", "amex", "hipercard", "other"]
>;
export declare const creditCards: import("drizzle-orm/pg-core").PgTableWithColumns<{
   name: "credit_cards";
   schema: undefined;
   columns: {
      id: import("drizzle-orm/pg-core").PgBuildColumn<
         "credit_cards",
         import("drizzle-orm/pg-core").SetIsPrimaryKey<
            import("drizzle-orm/pg-core").SetHasDefault<
               import("drizzle-orm/pg-core").PgUUIDBuilder
            >
         >,
         {
            name: string;
            tableName: "credit_cards";
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
         "credit_cards",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgUUIDBuilder
         >,
         {
            name: string;
            tableName: "credit_cards";
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
         "credit_cards",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgTextBuilder<[string, ...string[]]>
         >,
         {
            name: string;
            tableName: "credit_cards";
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
      color: import("drizzle-orm/pg-core").PgBuildColumn<
         "credit_cards",
         import("drizzle-orm/pg-core").SetHasDefault<
            import("drizzle-orm/pg-core").SetNotNull<
               import("drizzle-orm/pg-core").PgTextBuilder<
                  [string, ...string[]]
               >
            >
         >,
         {
            name: string;
            tableName: "credit_cards";
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
         "credit_cards",
         import("drizzle-orm/pg-core").PgTextBuilder<[string, ...string[]]>,
         {
            name: string;
            tableName: "credit_cards";
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
      creditLimit: import("drizzle-orm/pg-core").PgBuildColumn<
         "credit_cards",
         import("drizzle-orm/pg-core").SetHasDefault<
            import("drizzle-orm/pg-core").SetNotNull<
               import("drizzle-orm/pg-core").PgNumericBuilder
            >
         >,
         {
            name: string;
            tableName: "credit_cards";
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
      closingDay: import("drizzle-orm/pg-core").PgBuildColumn<
         "credit_cards",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgIntegerBuilder
         >,
         {
            name: string;
            tableName: "credit_cards";
            dataType: "number int32";
            data: number;
            driverParam: string | number;
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
      dueDay: import("drizzle-orm/pg-core").PgBuildColumn<
         "credit_cards",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgIntegerBuilder
         >,
         {
            name: string;
            tableName: "credit_cards";
            dataType: "number int32";
            data: number;
            driverParam: string | number;
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
         "credit_cards",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgUUIDBuilder
         >,
         {
            name: string;
            tableName: "credit_cards";
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
      status: import("drizzle-orm/pg-core").PgBuildColumn<
         "credit_cards",
         import("drizzle-orm/pg-core").SetHasDefault<
            import("drizzle-orm/pg-core").SetNotNull<
               import("drizzle-orm/pg-core").PgEnumColumnBuilder<
                  ["active", "blocked", "cancelled"]
               >
            >
         >,
         {
            name: string;
            tableName: "credit_cards";
            dataType: "string enum";
            data: "active" | "blocked" | "cancelled";
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: ["active", "blocked", "cancelled"];
            identity: undefined;
            generated: undefined;
         }
      >;
      brand: import("drizzle-orm/pg-core").PgBuildColumn<
         "credit_cards",
         import("drizzle-orm/pg-core").PgEnumColumnBuilder<
            ["visa", "mastercard", "elo", "amex", "hipercard", "other"]
         >,
         {
            name: string;
            tableName: "credit_cards";
            dataType: "string enum";
            data:
               | "amex"
               | "elo"
               | "hipercard"
               | "mastercard"
               | "other"
               | "visa";
            driverParam: string;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [
               "visa",
               "mastercard",
               "elo",
               "amex",
               "hipercard",
               "other",
            ];
            identity: undefined;
            generated: undefined;
         }
      >;
      createdAt: import("drizzle-orm/pg-core").PgBuildColumn<
         "credit_cards",
         import("drizzle-orm/pg-core").SetHasDefault<
            import("drizzle-orm/pg-core").SetNotNull<
               import("drizzle-orm/pg-core").PgTimestampBuilder
            >
         >,
         {
            name: string;
            tableName: "credit_cards";
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
         "credit_cards",
         import("drizzle-orm/pg-core").SetHasDefault<
            import("drizzle-orm/pg-core").SetHasDefault<
               import("drizzle-orm/pg-core").SetNotNull<
                  import("drizzle-orm/pg-core").PgTimestampBuilder
               >
            >
         >,
         {
            name: string;
            tableName: "credit_cards";
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
export type CreditCard = typeof creditCards.$inferSelect;
export type NewCreditCard = typeof creditCards.$inferInsert;
export type CreditCardStatus = (typeof creditCardStatusEnum.enumValues)[number];
export type CreditCardBrand = (typeof creditCardBrandEnum.enumValues)[number];
export declare const createCreditCardSchema: z.ZodObject<
   {
      iconUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
      name: z.ZodString;
      color: z.ZodDefault<z.ZodString>;
      creditLimit: z.ZodDefault<z.ZodString>;
      closingDay: z.ZodNumber;
      dueDay: z.ZodNumber;
      bankAccountId: z.ZodString;
      brand: z.ZodOptional<
         z.ZodNullable<
            z.ZodEnum<{
               amex: "amex";
               elo: "elo";
               hipercard: "hipercard";
               mastercard: "mastercard";
               other: "other";
               visa: "visa";
            }>
         >
      >;
   },
   {
      out: {};
      in: {};
   }
>;
export declare const updateCreditCardSchema: z.ZodObject<
   {
      iconUrl: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
      name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
      color: z.ZodOptional<z.ZodOptional<z.ZodString>>;
      creditLimit: z.ZodOptional<z.ZodOptional<z.ZodString>>;
      closingDay: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
      dueDay: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
      bankAccountId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
      brand: z.ZodOptional<
         z.ZodOptional<
            z.ZodNullable<
               z.ZodEnum<{
                  amex: "amex";
                  elo: "elo";
                  hipercard: "hipercard";
                  mastercard: "mastercard";
                  other: "other";
                  visa: "visa";
               }>
            >
         >
      >;
   },
   {
      out: {};
      in: {};
   }
>;
export type CreateCreditCardInput = z.infer<typeof createCreditCardSchema>;
export type UpdateCreditCardInput = z.infer<typeof updateCreditCardSchema>;
//# sourceMappingURL=credit-cards.d.ts.map
