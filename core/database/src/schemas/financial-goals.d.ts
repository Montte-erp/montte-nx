import { z } from "zod";
export declare const goalMovementTypeEnum: import("drizzle-orm/pg-core").PgEnum<
   ["deposit", "withdrawal"]
>;
export type GoalMovementType = (typeof goalMovementTypeEnum.enumValues)[number];
export declare const financialGoals: import("drizzle-orm/pg-core").PgTableWithColumns<{
   name: "financial_goals";
   schema: undefined;
   columns: {
      id: import("drizzle-orm/pg-core").PgBuildColumn<
         "financial_goals",
         import("drizzle-orm/pg-core").SetIsPrimaryKey<
            import("drizzle-orm/pg-core").SetHasDefault<
               import("drizzle-orm/pg-core").PgUUIDBuilder
            >
         >,
         {
            name: string;
            tableName: "financial_goals";
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
         "financial_goals",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgUUIDBuilder
         >,
         {
            name: string;
            tableName: "financial_goals";
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
      categoryId: import("drizzle-orm/pg-core").PgBuildColumn<
         "financial_goals",
         import("drizzle-orm/pg-core").PgUUIDBuilder,
         {
            name: string;
            tableName: "financial_goals";
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
      name: import("drizzle-orm/pg-core").PgBuildColumn<
         "financial_goals",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgTextBuilder<[string, ...string[]]>
         >,
         {
            name: string;
            tableName: "financial_goals";
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
      targetAmount: import("drizzle-orm/pg-core").PgBuildColumn<
         "financial_goals",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgNumericBuilder
         >,
         {
            name: string;
            tableName: "financial_goals";
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
      currentAmount: import("drizzle-orm/pg-core").PgBuildColumn<
         "financial_goals",
         import("drizzle-orm/pg-core").SetHasDefault<
            import("drizzle-orm/pg-core").SetNotNull<
               import("drizzle-orm/pg-core").PgNumericBuilder
            >
         >,
         {
            name: string;
            tableName: "financial_goals";
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
      startDate: import("drizzle-orm/pg-core").PgBuildColumn<
         "financial_goals",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgDateStringBuilder
         >,
         {
            name: string;
            tableName: "financial_goals";
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
      targetDate: import("drizzle-orm/pg-core").PgBuildColumn<
         "financial_goals",
         import("drizzle-orm/pg-core").PgDateStringBuilder,
         {
            name: string;
            tableName: "financial_goals";
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
      alertThreshold: import("drizzle-orm/pg-core").PgBuildColumn<
         "financial_goals",
         import("drizzle-orm/pg-core").PgIntegerBuilder,
         {
            name: string;
            tableName: "financial_goals";
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
      alertSentAt: import("drizzle-orm/pg-core").PgBuildColumn<
         "financial_goals",
         import("drizzle-orm/pg-core").PgTimestampBuilder,
         {
            name: string;
            tableName: "financial_goals";
            dataType: "object date";
            data: Date;
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
      isCompleted: import("drizzle-orm/pg-core").PgBuildColumn<
         "financial_goals",
         import("drizzle-orm/pg-core").SetHasDefault<
            import("drizzle-orm/pg-core").SetNotNull<
               import("drizzle-orm/pg-core").PgBooleanBuilder
            >
         >,
         {
            name: string;
            tableName: "financial_goals";
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
      createdAt: import("drizzle-orm/pg-core").PgBuildColumn<
         "financial_goals",
         import("drizzle-orm/pg-core").SetHasDefault<
            import("drizzle-orm/pg-core").SetNotNull<
               import("drizzle-orm/pg-core").PgTimestampBuilder
            >
         >,
         {
            name: string;
            tableName: "financial_goals";
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
         "financial_goals",
         import("drizzle-orm/pg-core").SetHasDefault<
            import("drizzle-orm/pg-core").SetHasDefault<
               import("drizzle-orm/pg-core").SetNotNull<
                  import("drizzle-orm/pg-core").PgTimestampBuilder
               >
            >
         >,
         {
            name: string;
            tableName: "financial_goals";
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
export declare const financialGoalMovements: import("drizzle-orm/pg-core").PgTableWithColumns<{
   name: "financial_goal_movements";
   schema: undefined;
   columns: {
      id: import("drizzle-orm/pg-core").PgBuildColumn<
         "financial_goal_movements",
         import("drizzle-orm/pg-core").SetIsPrimaryKey<
            import("drizzle-orm/pg-core").SetHasDefault<
               import("drizzle-orm/pg-core").PgUUIDBuilder
            >
         >,
         {
            name: string;
            tableName: "financial_goal_movements";
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
      goalId: import("drizzle-orm/pg-core").PgBuildColumn<
         "financial_goal_movements",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgUUIDBuilder
         >,
         {
            name: string;
            tableName: "financial_goal_movements";
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
      type: import("drizzle-orm/pg-core").PgBuildColumn<
         "financial_goal_movements",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgEnumColumnBuilder<
               ["deposit", "withdrawal"]
            >
         >,
         {
            name: string;
            tableName: "financial_goal_movements";
            dataType: "string enum";
            data: "deposit" | "withdrawal";
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: ["deposit", "withdrawal"];
            identity: undefined;
            generated: undefined;
         }
      >;
      amount: import("drizzle-orm/pg-core").PgBuildColumn<
         "financial_goal_movements",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgNumericBuilder
         >,
         {
            name: string;
            tableName: "financial_goal_movements";
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
      date: import("drizzle-orm/pg-core").PgBuildColumn<
         "financial_goal_movements",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgDateStringBuilder
         >,
         {
            name: string;
            tableName: "financial_goal_movements";
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
      transactionId: import("drizzle-orm/pg-core").PgBuildColumn<
         "financial_goal_movements",
         import("drizzle-orm/pg-core").PgUUIDBuilder,
         {
            name: string;
            tableName: "financial_goal_movements";
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
      notes: import("drizzle-orm/pg-core").PgBuildColumn<
         "financial_goal_movements",
         import("drizzle-orm/pg-core").PgTextBuilder<[string, ...string[]]>,
         {
            name: string;
            tableName: "financial_goal_movements";
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
         "financial_goal_movements",
         import("drizzle-orm/pg-core").SetHasDefault<
            import("drizzle-orm/pg-core").SetNotNull<
               import("drizzle-orm/pg-core").PgTimestampBuilder
            >
         >,
         {
            name: string;
            tableName: "financial_goal_movements";
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
         "financial_goal_movements",
         import("drizzle-orm/pg-core").SetHasDefault<
            import("drizzle-orm/pg-core").SetHasDefault<
               import("drizzle-orm/pg-core").SetNotNull<
                  import("drizzle-orm/pg-core").PgTimestampBuilder
               >
            >
         >,
         {
            name: string;
            tableName: "financial_goal_movements";
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
export type FinancialGoal = typeof financialGoals.$inferSelect;
export type NewFinancialGoal = typeof financialGoals.$inferInsert;
export type FinancialGoalMovement = typeof financialGoalMovements.$inferSelect;
export type NewFinancialGoalMovement =
   typeof financialGoalMovements.$inferInsert;
export declare const createFinancialGoalSchema: z.ZodObject<
   {
      name: z.ZodString;
      targetAmount: z.ZodString;
      startDate: z.ZodString;
      targetDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
      categoryId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
      alertThreshold: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
   },
   {
      out: {};
      in: {};
   }
>;
export declare const updateFinancialGoalSchema: z.ZodObject<
   {
      name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
      targetAmount: z.ZodOptional<z.ZodOptional<z.ZodString>>;
      startDate: z.ZodOptional<z.ZodOptional<z.ZodString>>;
      targetDate: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
      categoryId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
      alertThreshold: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
   },
   {
      out: {};
      in: {};
   }
>;
export declare const createGoalMovementSchema: z.ZodObject<
   {
      type: z.ZodEnum<{
         deposit: "deposit";
         withdrawal: "withdrawal";
      }>;
      amount: z.ZodString;
      date: z.ZodString;
      transactionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
      notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
   },
   z.core.$strip
>;
export type CreateFinancialGoalInput = z.infer<
   typeof createFinancialGoalSchema
>;
export type UpdateFinancialGoalInput = z.infer<
   typeof updateFinancialGoalSchema
>;
export type CreateGoalMovementInput = z.infer<typeof createGoalMovementSchema>;
//# sourceMappingURL=financial-goals.d.ts.map
