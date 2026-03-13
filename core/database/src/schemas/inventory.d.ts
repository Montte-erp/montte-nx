import { z } from "zod";
export declare const inventoryMovementTypeEnum: import("drizzle-orm/pg-core").PgEnum<
   ["purchase", "sale", "waste"]
>;
export declare const inventoryProducts: import("drizzle-orm/pg-core").PgTableWithColumns<{
   name: "inventory_products";
   schema: undefined;
   columns: {
      id: import("drizzle-orm/pg-core").PgBuildColumn<
         "inventory_products",
         import("drizzle-orm/pg-core").SetIsPrimaryKey<
            import("drizzle-orm/pg-core").SetHasDefault<
               import("drizzle-orm/pg-core").PgUUIDBuilder
            >
         >,
         {
            name: string;
            tableName: "inventory_products";
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
         "inventory_products",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgUUIDBuilder
         >,
         {
            name: string;
            tableName: "inventory_products";
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
         "inventory_products",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgTextBuilder<[string, ...string[]]>
         >,
         {
            name: string;
            tableName: "inventory_products";
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
      description: import("drizzle-orm/pg-core").PgBuildColumn<
         "inventory_products",
         import("drizzle-orm/pg-core").PgTextBuilder<[string, ...string[]]>,
         {
            name: string;
            tableName: "inventory_products";
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
      baseUnit: import("drizzle-orm/pg-core").PgBuildColumn<
         "inventory_products",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgTextBuilder<[string, ...string[]]>
         >,
         {
            name: string;
            tableName: "inventory_products";
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
      purchaseUnit: import("drizzle-orm/pg-core").PgBuildColumn<
         "inventory_products",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgTextBuilder<[string, ...string[]]>
         >,
         {
            name: string;
            tableName: "inventory_products";
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
      purchaseUnitFactor: import("drizzle-orm/pg-core").PgBuildColumn<
         "inventory_products",
         import("drizzle-orm/pg-core").SetHasDefault<
            import("drizzle-orm/pg-core").SetNotNull<
               import("drizzle-orm/pg-core").PgNumericBuilder
            >
         >,
         {
            name: string;
            tableName: "inventory_products";
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
      sellingPrice: import("drizzle-orm/pg-core").PgBuildColumn<
         "inventory_products",
         import("drizzle-orm/pg-core").PgNumericBuilder,
         {
            name: string;
            tableName: "inventory_products";
            dataType: "string numeric";
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
      initialStock: import("drizzle-orm/pg-core").PgBuildColumn<
         "inventory_products",
         import("drizzle-orm/pg-core").SetHasDefault<
            import("drizzle-orm/pg-core").SetNotNull<
               import("drizzle-orm/pg-core").PgNumericBuilder
            >
         >,
         {
            name: string;
            tableName: "inventory_products";
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
      currentStock: import("drizzle-orm/pg-core").PgBuildColumn<
         "inventory_products",
         import("drizzle-orm/pg-core").SetHasDefault<
            import("drizzle-orm/pg-core").SetNotNull<
               import("drizzle-orm/pg-core").PgNumericBuilder
            >
         >,
         {
            name: string;
            tableName: "inventory_products";
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
      archivedAt: import("drizzle-orm/pg-core").PgBuildColumn<
         "inventory_products",
         import("drizzle-orm/pg-core").PgTimestampBuilder,
         {
            name: string;
            tableName: "inventory_products";
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
      createdAt: import("drizzle-orm/pg-core").PgBuildColumn<
         "inventory_products",
         import("drizzle-orm/pg-core").SetHasDefault<
            import("drizzle-orm/pg-core").SetNotNull<
               import("drizzle-orm/pg-core").PgTimestampBuilder
            >
         >,
         {
            name: string;
            tableName: "inventory_products";
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
         "inventory_products",
         import("drizzle-orm/pg-core").SetHasDefault<
            import("drizzle-orm/pg-core").SetHasDefault<
               import("drizzle-orm/pg-core").SetNotNull<
                  import("drizzle-orm/pg-core").PgTimestampBuilder
               >
            >
         >,
         {
            name: string;
            tableName: "inventory_products";
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
export declare const inventoryMovements: import("drizzle-orm/pg-core").PgTableWithColumns<{
   name: "inventory_movements";
   schema: undefined;
   columns: {
      id: import("drizzle-orm/pg-core").PgBuildColumn<
         "inventory_movements",
         import("drizzle-orm/pg-core").SetIsPrimaryKey<
            import("drizzle-orm/pg-core").SetHasDefault<
               import("drizzle-orm/pg-core").PgUUIDBuilder
            >
         >,
         {
            name: string;
            tableName: "inventory_movements";
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
         "inventory_movements",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgUUIDBuilder
         >,
         {
            name: string;
            tableName: "inventory_movements";
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
      productId: import("drizzle-orm/pg-core").PgBuildColumn<
         "inventory_movements",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgUUIDBuilder
         >,
         {
            name: string;
            tableName: "inventory_movements";
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
         "inventory_movements",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgEnumColumnBuilder<
               ["purchase", "sale", "waste"]
            >
         >,
         {
            name: string;
            tableName: "inventory_movements";
            dataType: "string enum";
            data: "purchase" | "sale" | "waste";
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: ["purchase", "sale", "waste"];
            identity: undefined;
            generated: undefined;
         }
      >;
      qty: import("drizzle-orm/pg-core").PgBuildColumn<
         "inventory_movements",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgNumericBuilder
         >,
         {
            name: string;
            tableName: "inventory_movements";
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
      unitPrice: import("drizzle-orm/pg-core").PgBuildColumn<
         "inventory_movements",
         import("drizzle-orm/pg-core").PgNumericBuilder,
         {
            name: string;
            tableName: "inventory_movements";
            dataType: "string numeric";
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
      totalAmount: import("drizzle-orm/pg-core").PgBuildColumn<
         "inventory_movements",
         import("drizzle-orm/pg-core").PgNumericBuilder,
         {
            name: string;
            tableName: "inventory_movements";
            dataType: "string numeric";
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
      supplierId: import("drizzle-orm/pg-core").PgBuildColumn<
         "inventory_movements",
         import("drizzle-orm/pg-core").PgUUIDBuilder,
         {
            name: string;
            tableName: "inventory_movements";
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
      transactionId: import("drizzle-orm/pg-core").PgBuildColumn<
         "inventory_movements",
         import("drizzle-orm/pg-core").PgUUIDBuilder,
         {
            name: string;
            tableName: "inventory_movements";
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
         "inventory_movements",
         import("drizzle-orm/pg-core").PgTextBuilder<[string, ...string[]]>,
         {
            name: string;
            tableName: "inventory_movements";
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
         "inventory_movements",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgDateStringBuilder
         >,
         {
            name: string;
            tableName: "inventory_movements";
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
      createdAt: import("drizzle-orm/pg-core").PgBuildColumn<
         "inventory_movements",
         import("drizzle-orm/pg-core").SetHasDefault<
            import("drizzle-orm/pg-core").SetNotNull<
               import("drizzle-orm/pg-core").PgTimestampBuilder
            >
         >,
         {
            name: string;
            tableName: "inventory_movements";
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
export declare const inventorySettings: import("drizzle-orm/pg-core").PgTableWithColumns<{
   name: "inventory_settings";
   schema: undefined;
   columns: {
      teamId: import("drizzle-orm/pg-core").PgBuildColumn<
         "inventory_settings",
         import("drizzle-orm/pg-core").SetIsPrimaryKey<
            import("drizzle-orm/pg-core").PgUUIDBuilder
         >,
         {
            name: string;
            tableName: "inventory_settings";
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
      purchaseBankAccountId: import("drizzle-orm/pg-core").PgBuildColumn<
         "inventory_settings",
         import("drizzle-orm/pg-core").PgUUIDBuilder,
         {
            name: string;
            tableName: "inventory_settings";
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
      purchaseCreditCardId: import("drizzle-orm/pg-core").PgBuildColumn<
         "inventory_settings",
         import("drizzle-orm/pg-core").PgUUIDBuilder,
         {
            name: string;
            tableName: "inventory_settings";
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
      purchaseCategoryId: import("drizzle-orm/pg-core").PgBuildColumn<
         "inventory_settings",
         import("drizzle-orm/pg-core").PgUUIDBuilder,
         {
            name: string;
            tableName: "inventory_settings";
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
      saleCategoryId: import("drizzle-orm/pg-core").PgBuildColumn<
         "inventory_settings",
         import("drizzle-orm/pg-core").PgUUIDBuilder,
         {
            name: string;
            tableName: "inventory_settings";
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
      wasteCategoryId: import("drizzle-orm/pg-core").PgBuildColumn<
         "inventory_settings",
         import("drizzle-orm/pg-core").PgUUIDBuilder,
         {
            name: string;
            tableName: "inventory_settings";
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
         "inventory_settings",
         import("drizzle-orm/pg-core").SetHasDefault<
            import("drizzle-orm/pg-core").SetNotNull<
               import("drizzle-orm/pg-core").PgTimestampBuilder
            >
         >,
         {
            name: string;
            tableName: "inventory_settings";
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
         "inventory_settings",
         import("drizzle-orm/pg-core").SetHasDefault<
            import("drizzle-orm/pg-core").SetHasDefault<
               import("drizzle-orm/pg-core").SetNotNull<
                  import("drizzle-orm/pg-core").PgTimestampBuilder
               >
            >
         >,
         {
            name: string;
            tableName: "inventory_settings";
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
export type InventoryProduct = typeof inventoryProducts.$inferSelect;
export type NewInventoryProduct = typeof inventoryProducts.$inferInsert;
export type InventoryMovement = typeof inventoryMovements.$inferSelect;
export type NewInventoryMovement = typeof inventoryMovements.$inferInsert;
export type InventorySettings = typeof inventorySettings.$inferSelect;
export declare const createInventoryProductSchema: z.ZodObject<
   {
      name: z.ZodString;
      description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
      baseUnit: z.ZodString;
      purchaseUnit: z.ZodString;
      purchaseUnitFactor: z.ZodDefault<z.ZodString>;
      sellingPrice: z.ZodOptional<z.ZodNullable<z.ZodString>>;
      initialStock: z.ZodDefault<z.ZodString>;
   },
   {
      out: {};
      in: {};
   }
>;
export declare const updateInventoryProductSchema: z.ZodObject<
   {
      name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
      description: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
      baseUnit: z.ZodOptional<z.ZodOptional<z.ZodString>>;
      purchaseUnit: z.ZodOptional<z.ZodOptional<z.ZodString>>;
      purchaseUnitFactor: z.ZodOptional<z.ZodOptional<z.ZodString>>;
      sellingPrice: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
   },
   {
      out: {};
      in: {};
   }
>;
export declare const createInventoryMovementSchema: z.ZodDiscriminatedUnion<
   [
      z.ZodObject<
         {
            productId: z.ZodString;
            qty: z.ZodString;
            supplierId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            transactionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            date: z.ZodString;
            type: z.ZodLiteral<"purchase">;
            unitPrice: z.ZodString;
         },
         z.core.$strip
      >,
      z.ZodObject<
         {
            productId: z.ZodString;
            qty: z.ZodString;
            supplierId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            transactionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            date: z.ZodString;
            type: z.ZodLiteral<"sale">;
            unitPrice: z.ZodString;
         },
         z.core.$strip
      >,
      z.ZodObject<
         {
            productId: z.ZodString;
            qty: z.ZodString;
            supplierId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            transactionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            date: z.ZodString;
            type: z.ZodLiteral<"waste">;
         },
         z.core.$strip
      >,
   ],
   "type"
>;
export type CreateInventoryProductInput = z.infer<
   typeof createInventoryProductSchema
>;
export type UpdateInventoryProductInput = z.infer<
   typeof updateInventoryProductSchema
>;
export type CreateInventoryMovementInput = z.infer<
   typeof createInventoryMovementSchema
>;
//# sourceMappingURL=inventory.d.ts.map
