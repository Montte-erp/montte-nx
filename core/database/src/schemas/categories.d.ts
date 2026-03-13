import { z } from "zod";
export declare const categoryTypeEnum: import("drizzle-orm/pg-core").PgEnum<
   ["income", "expense"]
>;
export declare const categories: import("drizzle-orm/pg-core").PgTableWithColumns<{
   name: "categories";
   schema: undefined;
   columns: {
      id: import("drizzle-orm/pg-core").PgBuildColumn<
         "categories",
         import("drizzle-orm/pg-core").SetIsPrimaryKey<
            import("drizzle-orm/pg-core").SetHasDefault<
               import("drizzle-orm/pg-core").PgUUIDBuilder
            >
         >,
         {
            name: string;
            tableName: "categories";
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
         "categories",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgUUIDBuilder
         >,
         {
            name: string;
            tableName: "categories";
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
      parentId: import("drizzle-orm/pg-core").PgBuildColumn<
         "categories",
         import("drizzle-orm/pg-core").PgUUIDBuilder,
         {
            name: string;
            tableName: "categories";
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
         "categories",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgTextBuilder<[string, ...string[]]>
         >,
         {
            name: string;
            tableName: "categories";
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
         "categories",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgEnumColumnBuilder<
               ["income", "expense"]
            >
         >,
         {
            name: string;
            tableName: "categories";
            dataType: "string enum";
            data: "expense" | "income";
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: ["income", "expense"];
            identity: undefined;
            generated: undefined;
         }
      >;
      level: import("drizzle-orm/pg-core").PgBuildColumn<
         "categories",
         import("drizzle-orm/pg-core").SetHasDefault<
            import("drizzle-orm/pg-core").SetNotNull<
               import("drizzle-orm/pg-core").PgIntegerBuilder
            >
         >,
         {
            name: string;
            tableName: "categories";
            dataType: "number int32";
            data: number;
            driverParam: string | number;
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
      description: import("drizzle-orm/pg-core").PgBuildColumn<
         "categories",
         import("drizzle-orm/pg-core").PgTextBuilder<[string, ...string[]]>,
         {
            name: string;
            tableName: "categories";
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
      isDefault: import("drizzle-orm/pg-core").PgBuildColumn<
         "categories",
         import("drizzle-orm/pg-core").SetHasDefault<
            import("drizzle-orm/pg-core").SetNotNull<
               import("drizzle-orm/pg-core").PgBooleanBuilder
            >
         >,
         {
            name: string;
            tableName: "categories";
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
      color: import("drizzle-orm/pg-core").PgBuildColumn<
         "categories",
         import("drizzle-orm/pg-core").PgTextBuilder<[string, ...string[]]>,
         {
            name: string;
            tableName: "categories";
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
      icon: import("drizzle-orm/pg-core").PgBuildColumn<
         "categories",
         import("drizzle-orm/pg-core").PgTextBuilder<[string, ...string[]]>,
         {
            name: string;
            tableName: "categories";
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
      isArchived: import("drizzle-orm/pg-core").PgBuildColumn<
         "categories",
         import("drizzle-orm/pg-core").SetHasDefault<
            import("drizzle-orm/pg-core").SetNotNull<
               import("drizzle-orm/pg-core").PgBooleanBuilder
            >
         >,
         {
            name: string;
            tableName: "categories";
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
      keywords: import("drizzle-orm/pg-core").PgBuildColumn<
         "categories",
         import("drizzle-orm/pg-core").SetDimensions<
            import("drizzle-orm/pg-core").PgTextBuilder<[string, ...string[]]>,
            1
         >,
         {
            name: string;
            tableName: "categories";
            dataType: "string";
            data: string[];
            driverParam: string | string[];
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
         "categories",
         import("drizzle-orm/pg-core").PgTextBuilder<[string, ...string[]]>,
         {
            name: string;
            tableName: "categories";
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
      participatesDre: import("drizzle-orm/pg-core").PgBuildColumn<
         "categories",
         import("drizzle-orm/pg-core").SetHasDefault<
            import("drizzle-orm/pg-core").SetNotNull<
               import("drizzle-orm/pg-core").PgBooleanBuilder
            >
         >,
         {
            name: string;
            tableName: "categories";
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
      dreGroupId: import("drizzle-orm/pg-core").PgBuildColumn<
         "categories",
         import("drizzle-orm/pg-core").PgTextBuilder<[string, ...string[]]>,
         {
            name: string;
            tableName: "categories";
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
         "categories",
         import("drizzle-orm/pg-core").SetHasDefault<
            import("drizzle-orm/pg-core").SetNotNull<
               import("drizzle-orm/pg-core").PgTimestampBuilder
            >
         >,
         {
            name: string;
            tableName: "categories";
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
         "categories",
         import("drizzle-orm/pg-core").SetHasDefault<
            import("drizzle-orm/pg-core").SetHasDefault<
               import("drizzle-orm/pg-core").SetNotNull<
                  import("drizzle-orm/pg-core").PgTimestampBuilder
               >
            >
         >,
         {
            name: string;
            tableName: "categories";
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
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type CategoryType = (typeof categoryTypeEnum.enumValues)[number];
export declare const createCategorySchema: z.ZodObject<
   {
      name: z.ZodString;
      type: z.ZodEnum<{
         expense: "expense";
         income: "income";
      }>;
      parentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
      description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
      color: z.ZodOptional<z.ZodNullable<z.ZodString>>;
      icon: z.ZodOptional<z.ZodNullable<z.ZodString>>;
      keywords: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>;
      notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
      participatesDre: z.ZodDefault<z.ZodBoolean>;
      dreGroupId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
   },
   {
      out: {};
      in: {};
   }
>;
export declare const updateCategorySchema: z.ZodObject<
   {
      name: z.ZodOptional<z.ZodString>;
      description: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
      color: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
      icon: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
      keywords: z.ZodOptional<
         z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>
      >;
      notes: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
      participatesDre: z.ZodOptional<z.ZodBoolean>;
      dreGroupId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
   },
   {
      out: {};
      in: {};
   }
>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
//# sourceMappingURL=categories.d.ts.map
