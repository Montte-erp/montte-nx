import { z } from "zod";
export declare const dashboardTileSchema: z.ZodObject<
   {
      insightId: z.ZodString;
      size: z.ZodEnum<{
         full: "full";
         lg: "lg";
         md: "md";
         sm: "sm";
      }>;
      order: z.ZodNumber;
   },
   z.core.$strip
>;
export type DashboardTile = z.infer<typeof dashboardTileSchema>;
export declare const DashboardDateRangeSchema: z.ZodObject<
   {
      type: z.ZodEnum<{
         absolute: "absolute";
         relative: "relative";
      }>;
      value: z.ZodString;
   },
   z.core.$strip
>;
export type DashboardDateRange = z.infer<typeof DashboardDateRangeSchema>;
export declare const DashboardFilterSchema: z.ZodUnion<
   readonly [
      z.ZodDiscriminatedUnion<
         [
            z.ZodObject<
               {
                  id: z.ZodString;
                  type: z.ZodLiteral<"string">;
                  field: z.ZodString;
                  operator: z.ZodEnum<{
                     eq: "eq";
                     neq: "neq";
                     contains: "contains";
                     not_contains: "not_contains";
                     starts_with: "starts_with";
                     ends_with: "ends_with";
                     matches: "matches";
                     is_empty: "is_empty";
                     is_not_empty: "is_not_empty";
                     in: "in";
                     not_in: "not_in";
                     one_of: "one_of";
                     not_one_of: "not_one_of";
                     contains_any: "contains_any";
                     contains_all: "contains_all";
                     ilike: "ilike";
                     not_ilike: "not_ilike";
                  }>;
                  value: z.ZodOptional<
                     z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>
                  >;
                  valueRef: z.ZodOptional<z.ZodString>;
                  options: z.ZodOptional<
                     z.ZodObject<
                        {
                           caseSensitive: z.ZodOptional<z.ZodBoolean>;
                           negate: z.ZodOptional<z.ZodBoolean>;
                           trim: z.ZodOptional<z.ZodBoolean>;
                           weight: z.ZodOptional<z.ZodNumber>;
                        },
                        z.core.$strip
                     >
                  >;
               },
               z.core.$strip
            >,
            z.ZodObject<
               {
                  id: z.ZodString;
                  type: z.ZodLiteral<"number">;
                  field: z.ZodString;
                  operator: z.ZodEnum<{
                     eq: "eq";
                     neq: "neq";
                     gt: "gt";
                     gte: "gte";
                     lt: "lt";
                     lte: "lte";
                     between: "between";
                     not_between: "not_between";
                  }>;
                  value: z.ZodOptional<
                     z.ZodUnion<
                        readonly [
                           z.ZodNumber,
                           z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>,
                        ]
                     >
                  >;
                  valueRef: z.ZodOptional<z.ZodString>;
                  options: z.ZodOptional<
                     z.ZodObject<
                        {
                           negate: z.ZodOptional<z.ZodBoolean>;
                           weight: z.ZodOptional<z.ZodNumber>;
                        },
                        z.core.$strip
                     >
                  >;
               },
               z.core.$strip
            >,
            z.ZodObject<
               {
                  id: z.ZodString;
                  type: z.ZodLiteral<"boolean">;
                  field: z.ZodString;
                  operator: z.ZodEnum<{
                     eq: "eq";
                     neq: "neq";
                     is_true: "is_true";
                     is_false: "is_false";
                  }>;
                  value: z.ZodOptional<z.ZodBoolean>;
                  valueRef: z.ZodOptional<z.ZodString>;
                  options: z.ZodOptional<
                     z.ZodObject<
                        {
                           negate: z.ZodOptional<z.ZodBoolean>;
                           weight: z.ZodOptional<z.ZodNumber>;
                        },
                        z.core.$strip
                     >
                  >;
               },
               z.core.$strip
            >,
            z.ZodObject<
               {
                  id: z.ZodString;
                  type: z.ZodLiteral<"date">;
                  field: z.ZodString;
                  operator: z.ZodEnum<{
                     eq: "eq";
                     neq: "neq";
                     between: "between";
                     not_between: "not_between";
                     before: "before";
                     after: "after";
                     is_weekend: "is_weekend";
                     is_weekday: "is_weekday";
                     day_of_week: "day_of_week";
                     day_of_month: "day_of_month";
                  }>;
                  value: z.ZodOptional<
                     z.ZodUnion<
                        readonly [
                           z.ZodString,
                           z.ZodDate,
                           z.ZodNumber,
                           z.ZodTuple<
                              [
                                 z.ZodUnion<
                                    readonly [
                                       z.ZodString,
                                       z.ZodDate,
                                       z.ZodNumber,
                                    ]
                                 >,
                                 z.ZodUnion<
                                    readonly [
                                       z.ZodString,
                                       z.ZodDate,
                                       z.ZodNumber,
                                    ]
                                 >,
                              ],
                              null
                           >,
                           z.ZodArray<z.ZodNumber>,
                        ]
                     >
                  >;
                  valueRef: z.ZodOptional<z.ZodString>;
                  options: z.ZodOptional<
                     z.ZodObject<
                        {
                           negate: z.ZodOptional<z.ZodBoolean>;
                           weight: z.ZodOptional<z.ZodNumber>;
                        },
                        z.core.$strip
                     >
                  >;
               },
               z.core.$strip
            >,
            z.ZodObject<
               {
                  id: z.ZodString;
                  type: z.ZodLiteral<"array">;
                  field: z.ZodString;
                  operator: z.ZodEnum<{
                     contains: "contains";
                     not_contains: "not_contains";
                     is_empty: "is_empty";
                     is_not_empty: "is_not_empty";
                     contains_any: "contains_any";
                     contains_all: "contains_all";
                     length_eq: "length_eq";
                     length_gt: "length_gt";
                     length_lt: "length_lt";
                  }>;
                  value: z.ZodOptional<
                     z.ZodUnion<
                        readonly [
                           z.ZodUnknown,
                           z.ZodArray<z.ZodUnknown>,
                           z.ZodNumber,
                        ]
                     >
                  >;
                  valueRef: z.ZodOptional<z.ZodString>;
                  options: z.ZodOptional<
                     z.ZodObject<
                        {
                           negate: z.ZodOptional<z.ZodBoolean>;
                           weight: z.ZodOptional<z.ZodNumber>;
                        },
                        z.core.$strip
                     >
                  >;
               },
               z.core.$strip
            >,
         ],
         "type"
      >,
      z.ZodObject<
         {
            id: z.ZodString;
            type: z.ZodLiteral<"custom">;
            field: z.ZodString;
            operator: z.ZodString;
            value: z.ZodOptional<z.ZodUnknown>;
            valueRef: z.ZodOptional<z.ZodString>;
            options: z.ZodOptional<
               z.ZodObject<
                  {
                     negate: z.ZodOptional<z.ZodBoolean>;
                     weight: z.ZodOptional<z.ZodNumber>;
                  },
                  z.core.$loose
               >
            >;
         },
         z.core.$strip
      >,
   ]
>;
export type DashboardFilter = z.infer<typeof DashboardFilterSchema>;
export declare const dashboards: import("drizzle-orm/pg-core").PgTableWithColumns<{
   name: "dashboards";
   schema: undefined;
   columns: {
      id: import("drizzle-orm/pg-core").PgBuildColumn<
         "dashboards",
         import("drizzle-orm/pg-core").SetIsPrimaryKey<
            import("drizzle-orm/pg-core").SetHasDefault<
               import("drizzle-orm/pg-core").PgUUIDBuilder
            >
         >,
         {
            name: string;
            tableName: "dashboards";
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
      organizationId: import("drizzle-orm/pg-core").PgBuildColumn<
         "dashboards",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgUUIDBuilder
         >,
         {
            name: string;
            tableName: "dashboards";
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
      teamId: import("drizzle-orm/pg-core").PgBuildColumn<
         "dashboards",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgUUIDBuilder
         >,
         {
            name: string;
            tableName: "dashboards";
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
      createdBy: import("drizzle-orm/pg-core").PgBuildColumn<
         "dashboards",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgUUIDBuilder
         >,
         {
            name: string;
            tableName: "dashboards";
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
         "dashboards",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgTextBuilder<[string, ...string[]]>
         >,
         {
            name: string;
            tableName: "dashboards";
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
         "dashboards",
         import("drizzle-orm/pg-core").PgTextBuilder<[string, ...string[]]>,
         {
            name: string;
            tableName: "dashboards";
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
         "dashboards",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").SetHasDefault<
               import("drizzle-orm/pg-core").PgBooleanBuilder
            >
         >,
         {
            name: string;
            tableName: "dashboards";
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
      tiles: import("drizzle-orm/pg-core").PgBuildColumn<
         "dashboards",
         import("drizzle-orm/pg-core").SetHasDefault<
            import("drizzle-orm/pg-core").SetNotNull<
               import("drizzle-orm/pg-core").Set$Type<
                  import("drizzle-orm/pg-core").PgJsonbBuilder,
                  {
                     insightId: string;
                     size: "full" | "lg" | "md" | "sm";
                     order: number;
                  }[]
               >
            >
         >,
         {
            name: string;
            tableName: "dashboards";
            dataType: "object json";
            data: {
               insightId: string;
               size: "full" | "lg" | "md" | "sm";
               order: number;
            }[];
            driverParam: unknown;
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
      globalDateRange: import("drizzle-orm/pg-core").PgBuildColumn<
         "dashboards",
         import("drizzle-orm/pg-core").Set$Type<
            import("drizzle-orm/pg-core").PgJsonbBuilder,
            {
               type: "absolute" | "relative";
               value: string;
            }
         >,
         {
            name: string;
            tableName: "dashboards";
            dataType: "object json";
            data: {
               type: "absolute" | "relative";
               value: string;
            };
            driverParam: unknown;
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
      globalFilters: import("drizzle-orm/pg-core").PgBuildColumn<
         "dashboards",
         import("drizzle-orm/pg-core").SetHasDefault<
            import("drizzle-orm/pg-core").Set$Type<
               import("drizzle-orm/pg-core").PgJsonbBuilder,
               (
                  | {
                       id: string;
                       type: "string";
                       field: string;
                       operator:
                          | "contains"
                          | "contains_all"
                          | "contains_any"
                          | "ends_with"
                          | "eq"
                          | "ilike"
                          | "in"
                          | "is_empty"
                          | "is_not_empty"
                          | "matches"
                          | "neq"
                          | "not_contains"
                          | "not_ilike"
                          | "not_in"
                          | "not_one_of"
                          | "one_of"
                          | "starts_with";
                       value?: string | string[] | undefined;
                       valueRef?: string | undefined;
                       options?:
                          | {
                               caseSensitive?: boolean | undefined;
                               negate?: boolean | undefined;
                               trim?: boolean | undefined;
                               weight?: number | undefined;
                            }
                          | undefined;
                    }
                  | {
                       id: string;
                       type: "number";
                       field: string;
                       operator:
                          | "between"
                          | "eq"
                          | "gt"
                          | "gte"
                          | "lt"
                          | "lte"
                          | "neq"
                          | "not_between";
                       value?: number | [number, number] | undefined;
                       valueRef?: string | undefined;
                       options?:
                          | {
                               negate?: boolean | undefined;
                               weight?: number | undefined;
                            }
                          | undefined;
                    }
                  | {
                       id: string;
                       type: "boolean";
                       field: string;
                       operator: "eq" | "is_false" | "is_true" | "neq";
                       value?: boolean | undefined;
                       valueRef?: string | undefined;
                       options?:
                          | {
                               negate?: boolean | undefined;
                               weight?: number | undefined;
                            }
                          | undefined;
                    }
                  | {
                       id: string;
                       type: "date";
                       field: string;
                       operator:
                          | "after"
                          | "before"
                          | "between"
                          | "day_of_month"
                          | "day_of_week"
                          | "eq"
                          | "is_weekday"
                          | "is_weekend"
                          | "neq"
                          | "not_between";
                       value?:
                          | string
                          | number
                          | number[]
                          | Date
                          | [string | number | Date, string | number | Date]
                          | undefined;
                       valueRef?: string | undefined;
                       options?:
                          | {
                               negate?: boolean | undefined;
                               weight?: number | undefined;
                            }
                          | undefined;
                    }
                  | {
                       id: string;
                       type: "array";
                       field: string;
                       operator:
                          | "contains"
                          | "contains_all"
                          | "contains_any"
                          | "is_empty"
                          | "is_not_empty"
                          | "length_eq"
                          | "length_gt"
                          | "length_lt"
                          | "not_contains";
                       value?: unknown;
                       valueRef?: string | undefined;
                       options?:
                          | {
                               negate?: boolean | undefined;
                               weight?: number | undefined;
                            }
                          | undefined;
                    }
                  | {
                       id: string;
                       type: "custom";
                       field: string;
                       operator: string;
                       value?: unknown;
                       valueRef?: string | undefined;
                       options?:
                          | {
                               [x: string]: unknown;
                               negate?: boolean | undefined;
                               weight?: number | undefined;
                            }
                          | undefined;
                    }
               )[]
            >
         >,
         {
            name: string;
            tableName: "dashboards";
            dataType: "object json";
            data: (
               | {
                    id: string;
                    type: "string";
                    field: string;
                    operator:
                       | "contains"
                       | "contains_all"
                       | "contains_any"
                       | "ends_with"
                       | "eq"
                       | "ilike"
                       | "in"
                       | "is_empty"
                       | "is_not_empty"
                       | "matches"
                       | "neq"
                       | "not_contains"
                       | "not_ilike"
                       | "not_in"
                       | "not_one_of"
                       | "one_of"
                       | "starts_with";
                    value?: string | string[] | undefined;
                    valueRef?: string | undefined;
                    options?:
                       | {
                            caseSensitive?: boolean | undefined;
                            negate?: boolean | undefined;
                            trim?: boolean | undefined;
                            weight?: number | undefined;
                         }
                       | undefined;
                 }
               | {
                    id: string;
                    type: "number";
                    field: string;
                    operator:
                       | "between"
                       | "eq"
                       | "gt"
                       | "gte"
                       | "lt"
                       | "lte"
                       | "neq"
                       | "not_between";
                    value?: number | [number, number] | undefined;
                    valueRef?: string | undefined;
                    options?:
                       | {
                            negate?: boolean | undefined;
                            weight?: number | undefined;
                         }
                       | undefined;
                 }
               | {
                    id: string;
                    type: "boolean";
                    field: string;
                    operator: "eq" | "is_false" | "is_true" | "neq";
                    value?: boolean | undefined;
                    valueRef?: string | undefined;
                    options?:
                       | {
                            negate?: boolean | undefined;
                            weight?: number | undefined;
                         }
                       | undefined;
                 }
               | {
                    id: string;
                    type: "date";
                    field: string;
                    operator:
                       | "after"
                       | "before"
                       | "between"
                       | "day_of_month"
                       | "day_of_week"
                       | "eq"
                       | "is_weekday"
                       | "is_weekend"
                       | "neq"
                       | "not_between";
                    value?:
                       | string
                       | number
                       | number[]
                       | Date
                       | [string | number | Date, string | number | Date]
                       | undefined;
                    valueRef?: string | undefined;
                    options?:
                       | {
                            negate?: boolean | undefined;
                            weight?: number | undefined;
                         }
                       | undefined;
                 }
               | {
                    id: string;
                    type: "array";
                    field: string;
                    operator:
                       | "contains"
                       | "contains_all"
                       | "contains_any"
                       | "is_empty"
                       | "is_not_empty"
                       | "length_eq"
                       | "length_gt"
                       | "length_lt"
                       | "not_contains";
                    value?: unknown;
                    valueRef?: string | undefined;
                    options?:
                       | {
                            negate?: boolean | undefined;
                            weight?: number | undefined;
                         }
                       | undefined;
                 }
               | {
                    id: string;
                    type: "custom";
                    field: string;
                    operator: string;
                    value?: unknown;
                    valueRef?: string | undefined;
                    options?:
                       | {
                            [x: string]: unknown;
                            negate?: boolean | undefined;
                            weight?: number | undefined;
                         }
                       | undefined;
                 }
            )[];
            driverParam: unknown;
            notNull: false;
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
         "dashboards",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").SetHasDefault<
               import("drizzle-orm/pg-core").PgTimestampBuilder
            >
         >,
         {
            name: string;
            tableName: "dashboards";
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
         "dashboards",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").SetHasDefault<
               import("drizzle-orm/pg-core").SetHasDefault<
                  import("drizzle-orm/pg-core").PgTimestampBuilder
               >
            >
         >,
         {
            name: string;
            tableName: "dashboards";
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
export type Dashboard = typeof dashboards.$inferSelect;
export type NewDashboard = typeof dashboards.$inferInsert;
export declare const createDashboardSchema: z.ZodObject<
   {
      name: z.ZodString;
      description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
      tiles: z.ZodDefault<
         z.ZodArray<
            z.ZodObject<
               {
                  insightId: z.ZodString;
                  size: z.ZodEnum<{
                     full: "full";
                     lg: "lg";
                     md: "md";
                     sm: "sm";
                  }>;
                  order: z.ZodNumber;
               },
               z.core.$strip
            >
         >
      >;
      globalDateRange: z.ZodOptional<
         z.ZodNullable<
            z.ZodObject<
               {
                  type: z.ZodEnum<{
                     absolute: "absolute";
                     relative: "relative";
                  }>;
                  value: z.ZodString;
               },
               z.core.$strip
            >
         >
      >;
      globalFilters: z.ZodDefault<
         z.ZodArray<
            z.ZodUnion<
               readonly [
                  z.ZodDiscriminatedUnion<
                     [
                        z.ZodObject<
                           {
                              id: z.ZodString;
                              type: z.ZodLiteral<"string">;
                              field: z.ZodString;
                              operator: z.ZodEnum<{
                                 eq: "eq";
                                 neq: "neq";
                                 contains: "contains";
                                 not_contains: "not_contains";
                                 starts_with: "starts_with";
                                 ends_with: "ends_with";
                                 matches: "matches";
                                 is_empty: "is_empty";
                                 is_not_empty: "is_not_empty";
                                 in: "in";
                                 not_in: "not_in";
                                 one_of: "one_of";
                                 not_one_of: "not_one_of";
                                 contains_any: "contains_any";
                                 contains_all: "contains_all";
                                 ilike: "ilike";
                                 not_ilike: "not_ilike";
                              }>;
                              value: z.ZodOptional<
                                 z.ZodUnion<
                                    readonly [
                                       z.ZodString,
                                       z.ZodArray<z.ZodString>,
                                    ]
                                 >
                              >;
                              valueRef: z.ZodOptional<z.ZodString>;
                              options: z.ZodOptional<
                                 z.ZodObject<
                                    {
                                       caseSensitive: z.ZodOptional<z.ZodBoolean>;
                                       negate: z.ZodOptional<z.ZodBoolean>;
                                       trim: z.ZodOptional<z.ZodBoolean>;
                                       weight: z.ZodOptional<z.ZodNumber>;
                                    },
                                    z.core.$strip
                                 >
                              >;
                           },
                           z.core.$strip
                        >,
                        z.ZodObject<
                           {
                              id: z.ZodString;
                              type: z.ZodLiteral<"number">;
                              field: z.ZodString;
                              operator: z.ZodEnum<{
                                 eq: "eq";
                                 neq: "neq";
                                 gt: "gt";
                                 gte: "gte";
                                 lt: "lt";
                                 lte: "lte";
                                 between: "between";
                                 not_between: "not_between";
                              }>;
                              value: z.ZodOptional<
                                 z.ZodUnion<
                                    readonly [
                                       z.ZodNumber,
                                       z.ZodTuple<
                                          [z.ZodNumber, z.ZodNumber],
                                          null
                                       >,
                                    ]
                                 >
                              >;
                              valueRef: z.ZodOptional<z.ZodString>;
                              options: z.ZodOptional<
                                 z.ZodObject<
                                    {
                                       negate: z.ZodOptional<z.ZodBoolean>;
                                       weight: z.ZodOptional<z.ZodNumber>;
                                    },
                                    z.core.$strip
                                 >
                              >;
                           },
                           z.core.$strip
                        >,
                        z.ZodObject<
                           {
                              id: z.ZodString;
                              type: z.ZodLiteral<"boolean">;
                              field: z.ZodString;
                              operator: z.ZodEnum<{
                                 eq: "eq";
                                 neq: "neq";
                                 is_true: "is_true";
                                 is_false: "is_false";
                              }>;
                              value: z.ZodOptional<z.ZodBoolean>;
                              valueRef: z.ZodOptional<z.ZodString>;
                              options: z.ZodOptional<
                                 z.ZodObject<
                                    {
                                       negate: z.ZodOptional<z.ZodBoolean>;
                                       weight: z.ZodOptional<z.ZodNumber>;
                                    },
                                    z.core.$strip
                                 >
                              >;
                           },
                           z.core.$strip
                        >,
                        z.ZodObject<
                           {
                              id: z.ZodString;
                              type: z.ZodLiteral<"date">;
                              field: z.ZodString;
                              operator: z.ZodEnum<{
                                 eq: "eq";
                                 neq: "neq";
                                 between: "between";
                                 not_between: "not_between";
                                 before: "before";
                                 after: "after";
                                 is_weekend: "is_weekend";
                                 is_weekday: "is_weekday";
                                 day_of_week: "day_of_week";
                                 day_of_month: "day_of_month";
                              }>;
                              value: z.ZodOptional<
                                 z.ZodUnion<
                                    readonly [
                                       z.ZodString,
                                       z.ZodDate,
                                       z.ZodNumber,
                                       z.ZodTuple<
                                          [
                                             z.ZodUnion<
                                                readonly [
                                                   z.ZodString,
                                                   z.ZodDate,
                                                   z.ZodNumber,
                                                ]
                                             >,
                                             z.ZodUnion<
                                                readonly [
                                                   z.ZodString,
                                                   z.ZodDate,
                                                   z.ZodNumber,
                                                ]
                                             >,
                                          ],
                                          null
                                       >,
                                       z.ZodArray<z.ZodNumber>,
                                    ]
                                 >
                              >;
                              valueRef: z.ZodOptional<z.ZodString>;
                              options: z.ZodOptional<
                                 z.ZodObject<
                                    {
                                       negate: z.ZodOptional<z.ZodBoolean>;
                                       weight: z.ZodOptional<z.ZodNumber>;
                                    },
                                    z.core.$strip
                                 >
                              >;
                           },
                           z.core.$strip
                        >,
                        z.ZodObject<
                           {
                              id: z.ZodString;
                              type: z.ZodLiteral<"array">;
                              field: z.ZodString;
                              operator: z.ZodEnum<{
                                 contains: "contains";
                                 not_contains: "not_contains";
                                 is_empty: "is_empty";
                                 is_not_empty: "is_not_empty";
                                 contains_any: "contains_any";
                                 contains_all: "contains_all";
                                 length_eq: "length_eq";
                                 length_gt: "length_gt";
                                 length_lt: "length_lt";
                              }>;
                              value: z.ZodOptional<
                                 z.ZodUnion<
                                    readonly [
                                       z.ZodUnknown,
                                       z.ZodArray<z.ZodUnknown>,
                                       z.ZodNumber,
                                    ]
                                 >
                              >;
                              valueRef: z.ZodOptional<z.ZodString>;
                              options: z.ZodOptional<
                                 z.ZodObject<
                                    {
                                       negate: z.ZodOptional<z.ZodBoolean>;
                                       weight: z.ZodOptional<z.ZodNumber>;
                                    },
                                    z.core.$strip
                                 >
                              >;
                           },
                           z.core.$strip
                        >,
                     ],
                     "type"
                  >,
                  z.ZodObject<
                     {
                        id: z.ZodString;
                        type: z.ZodLiteral<"custom">;
                        field: z.ZodString;
                        operator: z.ZodString;
                        value: z.ZodOptional<z.ZodUnknown>;
                        valueRef: z.ZodOptional<z.ZodString>;
                        options: z.ZodOptional<
                           z.ZodObject<
                              {
                                 negate: z.ZodOptional<z.ZodBoolean>;
                                 weight: z.ZodOptional<z.ZodNumber>;
                              },
                              z.core.$loose
                           >
                        >;
                     },
                     z.core.$strip
                  >,
               ]
            >
         >
      >;
   },
   {
      out: {};
      in: {};
   }
>;
export declare const updateDashboardSchema: z.ZodObject<
   {
      name: z.ZodOptional<z.ZodString>;
      description: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
      tiles: z.ZodOptional<
         z.ZodDefault<
            z.ZodArray<
               z.ZodObject<
                  {
                     insightId: z.ZodString;
                     size: z.ZodEnum<{
                        full: "full";
                        lg: "lg";
                        md: "md";
                        sm: "sm";
                     }>;
                     order: z.ZodNumber;
                  },
                  z.core.$strip
               >
            >
         >
      >;
      globalDateRange: z.ZodOptional<
         z.ZodOptional<
            z.ZodNullable<
               z.ZodObject<
                  {
                     type: z.ZodEnum<{
                        absolute: "absolute";
                        relative: "relative";
                     }>;
                     value: z.ZodString;
                  },
                  z.core.$strip
               >
            >
         >
      >;
      globalFilters: z.ZodOptional<
         z.ZodDefault<
            z.ZodArray<
               z.ZodUnion<
                  readonly [
                     z.ZodDiscriminatedUnion<
                        [
                           z.ZodObject<
                              {
                                 id: z.ZodString;
                                 type: z.ZodLiteral<"string">;
                                 field: z.ZodString;
                                 operator: z.ZodEnum<{
                                    eq: "eq";
                                    neq: "neq";
                                    contains: "contains";
                                    not_contains: "not_contains";
                                    starts_with: "starts_with";
                                    ends_with: "ends_with";
                                    matches: "matches";
                                    is_empty: "is_empty";
                                    is_not_empty: "is_not_empty";
                                    in: "in";
                                    not_in: "not_in";
                                    one_of: "one_of";
                                    not_one_of: "not_one_of";
                                    contains_any: "contains_any";
                                    contains_all: "contains_all";
                                    ilike: "ilike";
                                    not_ilike: "not_ilike";
                                 }>;
                                 value: z.ZodOptional<
                                    z.ZodUnion<
                                       readonly [
                                          z.ZodString,
                                          z.ZodArray<z.ZodString>,
                                       ]
                                    >
                                 >;
                                 valueRef: z.ZodOptional<z.ZodString>;
                                 options: z.ZodOptional<
                                    z.ZodObject<
                                       {
                                          caseSensitive: z.ZodOptional<z.ZodBoolean>;
                                          negate: z.ZodOptional<z.ZodBoolean>;
                                          trim: z.ZodOptional<z.ZodBoolean>;
                                          weight: z.ZodOptional<z.ZodNumber>;
                                       },
                                       z.core.$strip
                                    >
                                 >;
                              },
                              z.core.$strip
                           >,
                           z.ZodObject<
                              {
                                 id: z.ZodString;
                                 type: z.ZodLiteral<"number">;
                                 field: z.ZodString;
                                 operator: z.ZodEnum<{
                                    eq: "eq";
                                    neq: "neq";
                                    gt: "gt";
                                    gte: "gte";
                                    lt: "lt";
                                    lte: "lte";
                                    between: "between";
                                    not_between: "not_between";
                                 }>;
                                 value: z.ZodOptional<
                                    z.ZodUnion<
                                       readonly [
                                          z.ZodNumber,
                                          z.ZodTuple<
                                             [z.ZodNumber, z.ZodNumber],
                                             null
                                          >,
                                       ]
                                    >
                                 >;
                                 valueRef: z.ZodOptional<z.ZodString>;
                                 options: z.ZodOptional<
                                    z.ZodObject<
                                       {
                                          negate: z.ZodOptional<z.ZodBoolean>;
                                          weight: z.ZodOptional<z.ZodNumber>;
                                       },
                                       z.core.$strip
                                    >
                                 >;
                              },
                              z.core.$strip
                           >,
                           z.ZodObject<
                              {
                                 id: z.ZodString;
                                 type: z.ZodLiteral<"boolean">;
                                 field: z.ZodString;
                                 operator: z.ZodEnum<{
                                    eq: "eq";
                                    neq: "neq";
                                    is_true: "is_true";
                                    is_false: "is_false";
                                 }>;
                                 value: z.ZodOptional<z.ZodBoolean>;
                                 valueRef: z.ZodOptional<z.ZodString>;
                                 options: z.ZodOptional<
                                    z.ZodObject<
                                       {
                                          negate: z.ZodOptional<z.ZodBoolean>;
                                          weight: z.ZodOptional<z.ZodNumber>;
                                       },
                                       z.core.$strip
                                    >
                                 >;
                              },
                              z.core.$strip
                           >,
                           z.ZodObject<
                              {
                                 id: z.ZodString;
                                 type: z.ZodLiteral<"date">;
                                 field: z.ZodString;
                                 operator: z.ZodEnum<{
                                    eq: "eq";
                                    neq: "neq";
                                    between: "between";
                                    not_between: "not_between";
                                    before: "before";
                                    after: "after";
                                    is_weekend: "is_weekend";
                                    is_weekday: "is_weekday";
                                    day_of_week: "day_of_week";
                                    day_of_month: "day_of_month";
                                 }>;
                                 value: z.ZodOptional<
                                    z.ZodUnion<
                                       readonly [
                                          z.ZodString,
                                          z.ZodDate,
                                          z.ZodNumber,
                                          z.ZodTuple<
                                             [
                                                z.ZodUnion<
                                                   readonly [
                                                      z.ZodString,
                                                      z.ZodDate,
                                                      z.ZodNumber,
                                                   ]
                                                >,
                                                z.ZodUnion<
                                                   readonly [
                                                      z.ZodString,
                                                      z.ZodDate,
                                                      z.ZodNumber,
                                                   ]
                                                >,
                                             ],
                                             null
                                          >,
                                          z.ZodArray<z.ZodNumber>,
                                       ]
                                    >
                                 >;
                                 valueRef: z.ZodOptional<z.ZodString>;
                                 options: z.ZodOptional<
                                    z.ZodObject<
                                       {
                                          negate: z.ZodOptional<z.ZodBoolean>;
                                          weight: z.ZodOptional<z.ZodNumber>;
                                       },
                                       z.core.$strip
                                    >
                                 >;
                              },
                              z.core.$strip
                           >,
                           z.ZodObject<
                              {
                                 id: z.ZodString;
                                 type: z.ZodLiteral<"array">;
                                 field: z.ZodString;
                                 operator: z.ZodEnum<{
                                    contains: "contains";
                                    not_contains: "not_contains";
                                    is_empty: "is_empty";
                                    is_not_empty: "is_not_empty";
                                    contains_any: "contains_any";
                                    contains_all: "contains_all";
                                    length_eq: "length_eq";
                                    length_gt: "length_gt";
                                    length_lt: "length_lt";
                                 }>;
                                 value: z.ZodOptional<
                                    z.ZodUnion<
                                       readonly [
                                          z.ZodUnknown,
                                          z.ZodArray<z.ZodUnknown>,
                                          z.ZodNumber,
                                       ]
                                    >
                                 >;
                                 valueRef: z.ZodOptional<z.ZodString>;
                                 options: z.ZodOptional<
                                    z.ZodObject<
                                       {
                                          negate: z.ZodOptional<z.ZodBoolean>;
                                          weight: z.ZodOptional<z.ZodNumber>;
                                       },
                                       z.core.$strip
                                    >
                                 >;
                              },
                              z.core.$strip
                           >,
                        ],
                        "type"
                     >,
                     z.ZodObject<
                        {
                           id: z.ZodString;
                           type: z.ZodLiteral<"custom">;
                           field: z.ZodString;
                           operator: z.ZodString;
                           value: z.ZodOptional<z.ZodUnknown>;
                           valueRef: z.ZodOptional<z.ZodString>;
                           options: z.ZodOptional<
                              z.ZodObject<
                                 {
                                    negate: z.ZodOptional<z.ZodBoolean>;
                                    weight: z.ZodOptional<z.ZodNumber>;
                                 },
                                 z.core.$loose
                              >
                           >;
                        },
                        z.core.$strip
                     >,
                  ]
               >
            >
         >
      >;
   },
   {
      out: {};
      in: {};
   }
>;
export type CreateDashboardInput = z.infer<typeof createDashboardSchema>;
export type UpdateDashboardInput = z.infer<typeof updateDashboardSchema>;
//# sourceMappingURL=dashboards.d.ts.map
