import { z } from "zod";
export declare const serviceSourceEnum: import("drizzle-orm/pg-core").PgEnum<
   ["manual", "asaas"]
>;
export type ServiceSource = (typeof serviceSourceEnum.enumValues)[number];
export declare const contactTypeEnum: import("drizzle-orm/pg-core").PgEnum<
   ["cliente", "fornecedor", "ambos"]
>;
export declare const contactDocumentTypeEnum: import("drizzle-orm/pg-core").PgEnum<
   ["cpf", "cnpj"]
>;
export declare const contacts: import("drizzle-orm/pg-core").PgTableWithColumns<{
   name: "contacts";
   schema: undefined;
   columns: {
      id: import("drizzle-orm/pg-core").PgBuildColumn<
         "contacts",
         import("drizzle-orm/pg-core").SetIsPrimaryKey<
            import("drizzle-orm/pg-core").SetHasDefault<
               import("drizzle-orm/pg-core").PgUUIDBuilder
            >
         >,
         {
            name: string;
            tableName: "contacts";
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
         "contacts",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgUUIDBuilder
         >,
         {
            name: string;
            tableName: "contacts";
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
         "contacts",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgTextBuilder<[string, ...string[]]>
         >,
         {
            name: string;
            tableName: "contacts";
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
         "contacts",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgEnumColumnBuilder<
               ["cliente", "fornecedor", "ambos"]
            >
         >,
         {
            name: string;
            tableName: "contacts";
            dataType: "string enum";
            data: "ambos" | "cliente" | "fornecedor";
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: ["cliente", "fornecedor", "ambos"];
            identity: undefined;
            generated: undefined;
         }
      >;
      email: import("drizzle-orm/pg-core").PgBuildColumn<
         "contacts",
         import("drizzle-orm/pg-core").PgTextBuilder<[string, ...string[]]>,
         {
            name: string;
            tableName: "contacts";
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
      phone: import("drizzle-orm/pg-core").PgBuildColumn<
         "contacts",
         import("drizzle-orm/pg-core").PgTextBuilder<[string, ...string[]]>,
         {
            name: string;
            tableName: "contacts";
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
      document: import("drizzle-orm/pg-core").PgBuildColumn<
         "contacts",
         import("drizzle-orm/pg-core").PgTextBuilder<[string, ...string[]]>,
         {
            name: string;
            tableName: "contacts";
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
      documentType: import("drizzle-orm/pg-core").PgBuildColumn<
         "contacts",
         import("drizzle-orm/pg-core").PgEnumColumnBuilder<["cpf", "cnpj"]>,
         {
            name: string;
            tableName: "contacts";
            dataType: "string enum";
            data: "cnpj" | "cpf";
            driverParam: string;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: ["cpf", "cnpj"];
            identity: undefined;
            generated: undefined;
         }
      >;
      notes: import("drizzle-orm/pg-core").PgBuildColumn<
         "contacts",
         import("drizzle-orm/pg-core").PgTextBuilder<[string, ...string[]]>,
         {
            name: string;
            tableName: "contacts";
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
      source: import("drizzle-orm/pg-core").PgBuildColumn<
         "contacts",
         import("drizzle-orm/pg-core").SetHasDefault<
            import("drizzle-orm/pg-core").SetNotNull<
               import("drizzle-orm/pg-core").PgEnumColumnBuilder<
                  ["manual", "asaas"]
               >
            >
         >,
         {
            name: string;
            tableName: "contacts";
            dataType: "string enum";
            data: "asaas" | "manual";
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: ["manual", "asaas"];
            identity: undefined;
            generated: undefined;
         }
      >;
      externalId: import("drizzle-orm/pg-core").PgBuildColumn<
         "contacts",
         import("drizzle-orm/pg-core").PgTextBuilder<[string, ...string[]]>,
         {
            name: string;
            tableName: "contacts";
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
         "contacts",
         import("drizzle-orm/pg-core").SetHasDefault<
            import("drizzle-orm/pg-core").SetNotNull<
               import("drizzle-orm/pg-core").PgBooleanBuilder
            >
         >,
         {
            name: string;
            tableName: "contacts";
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
         "contacts",
         import("drizzle-orm/pg-core").SetHasDefault<
            import("drizzle-orm/pg-core").SetNotNull<
               import("drizzle-orm/pg-core").PgTimestampBuilder
            >
         >,
         {
            name: string;
            tableName: "contacts";
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
         "contacts",
         import("drizzle-orm/pg-core").SetHasDefault<
            import("drizzle-orm/pg-core").SetHasDefault<
               import("drizzle-orm/pg-core").SetNotNull<
                  import("drizzle-orm/pg-core").PgTimestampBuilder
               >
            >
         >,
         {
            name: string;
            tableName: "contacts";
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
export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
export type ContactType = (typeof contactTypeEnum.enumValues)[number];
export type ContactDocumentType =
   (typeof contactDocumentTypeEnum.enumValues)[number];
export declare const createContactSchema: z.ZodObject<
   {
      name: z.ZodString;
      type: z.ZodEnum<{
         ambos: "ambos";
         cliente: "cliente";
         fornecedor: "fornecedor";
      }>;
      email: z.ZodOptional<z.ZodNullable<z.ZodString>>;
      phone: z.ZodOptional<z.ZodNullable<z.ZodString>>;
      document: z.ZodOptional<z.ZodNullable<z.ZodString>>;
      documentType: z.ZodOptional<
         z.ZodNullable<
            z.ZodEnum<{
               cnpj: "cnpj";
               cpf: "cpf";
            }>
         >
      >;
      notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
   },
   {
      out: {};
      in: {};
   }
>;
export declare const updateContactSchema: z.ZodObject<
   {
      name: z.ZodOptional<z.ZodString>;
      type: z.ZodOptional<
         z.ZodEnum<{
            ambos: "ambos";
            cliente: "cliente";
            fornecedor: "fornecedor";
         }>
      >;
      email: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
      phone: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
      document: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
      documentType: z.ZodOptional<
         z.ZodOptional<
            z.ZodNullable<
               z.ZodEnum<{
                  cnpj: "cnpj";
                  cpf: "cpf";
               }>
            >
         >
      >;
      notes: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
   },
   {
      out: {};
      in: {};
   }
>;
export type CreateContactInput = z.infer<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;
//# sourceMappingURL=contacts.d.ts.map
