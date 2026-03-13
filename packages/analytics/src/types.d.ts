import { z } from "zod";
export declare const relativeDateRangeSchema: z.ZodObject<
   {
      type: z.ZodLiteral<"relative">;
      value: z.ZodEnum<{
         "12m": "12m";
         "14d": "14d";
         "180d": "180d";
         "30d": "30d";
         "7d": "7d";
         "90d": "90d";
         last_month: "last_month";
         this_month: "this_month";
         this_quarter: "this_quarter";
         this_year: "this_year";
      }>;
   },
   z.core.$strip
>;
export declare const absoluteDateRangeSchema: z.ZodObject<
   {
      type: z.ZodLiteral<"absolute">;
      start: z.ZodString;
      end: z.ZodString;
   },
   z.core.$strip
>;
export declare const dateRangeSchema: z.ZodDiscriminatedUnion<
   [
      z.ZodObject<
         {
            type: z.ZodLiteral<"relative">;
            value: z.ZodEnum<{
               "12m": "12m";
               "14d": "14d";
               "180d": "180d";
               "30d": "30d";
               "7d": "7d";
               "90d": "90d";
               last_month: "last_month";
               this_month: "this_month";
               this_quarter: "this_quarter";
               this_year: "this_year";
            }>;
         },
         z.core.$strip
      >,
      z.ZodObject<
         {
            type: z.ZodLiteral<"absolute">;
            start: z.ZodString;
            end: z.ZodString;
         },
         z.core.$strip
      >,
   ],
   "type"
>;
export declare const transactionFiltersSchema: z.ZodObject<
   {
      dateRange: z.ZodDiscriminatedUnion<
         [
            z.ZodObject<
               {
                  type: z.ZodLiteral<"relative">;
                  value: z.ZodEnum<{
                     "12m": "12m";
                     "14d": "14d";
                     "180d": "180d";
                     "30d": "30d";
                     "7d": "7d";
                     "90d": "90d";
                     last_month: "last_month";
                     this_month: "this_month";
                     this_quarter: "this_quarter";
                     this_year: "this_year";
                  }>;
               },
               z.core.$strip
            >,
            z.ZodObject<
               {
                  type: z.ZodLiteral<"absolute">;
                  start: z.ZodString;
                  end: z.ZodString;
               },
               z.core.$strip
            >,
         ],
         "type"
      >;
      transactionType: z.ZodOptional<
         z.ZodArray<
            z.ZodEnum<{
               expense: "expense";
               income: "income";
               transfer: "transfer";
            }>
         >
      >;
      bankAccountIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
      categoryIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
   },
   z.core.$strip
>;
export declare const measureSchema: z.ZodObject<
   {
      aggregation: z.ZodEnum<{
         avg: "avg";
         count: "count";
         net: "net";
         sum: "sum";
      }>;
   },
   z.core.$strip
>;
export declare const kpiConfigSchema: z.ZodObject<
   {
      type: z.ZodLiteral<"kpi">;
      measure: z.ZodObject<
         {
            aggregation: z.ZodEnum<{
               avg: "avg";
               count: "count";
               net: "net";
               sum: "sum";
            }>;
         },
         z.core.$strip
      >;
      filters: z.ZodObject<
         {
            dateRange: z.ZodDiscriminatedUnion<
               [
                  z.ZodObject<
                     {
                        type: z.ZodLiteral<"relative">;
                        value: z.ZodEnum<{
                           "12m": "12m";
                           "14d": "14d";
                           "180d": "180d";
                           "30d": "30d";
                           "7d": "7d";
                           "90d": "90d";
                           last_month: "last_month";
                           this_month: "this_month";
                           this_quarter: "this_quarter";
                           this_year: "this_year";
                        }>;
                     },
                     z.core.$strip
                  >,
                  z.ZodObject<
                     {
                        type: z.ZodLiteral<"absolute">;
                        start: z.ZodString;
                        end: z.ZodString;
                     },
                     z.core.$strip
                  >,
               ],
               "type"
            >;
            transactionType: z.ZodOptional<
               z.ZodArray<
                  z.ZodEnum<{
                     expense: "expense";
                     income: "income";
                     transfer: "transfer";
                  }>
               >
            >;
            bankAccountIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
            categoryIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
         },
         z.core.$strip
      >;
      compare: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
   },
   z.core.$strip
>;
export declare const timeSeriesConfigSchema: z.ZodObject<
   {
      type: z.ZodLiteral<"time_series">;
      measure: z.ZodObject<
         {
            aggregation: z.ZodEnum<{
               avg: "avg";
               count: "count";
               net: "net";
               sum: "sum";
            }>;
         },
         z.core.$strip
      >;
      filters: z.ZodObject<
         {
            dateRange: z.ZodDiscriminatedUnion<
               [
                  z.ZodObject<
                     {
                        type: z.ZodLiteral<"relative">;
                        value: z.ZodEnum<{
                           "12m": "12m";
                           "14d": "14d";
                           "180d": "180d";
                           "30d": "30d";
                           "7d": "7d";
                           "90d": "90d";
                           last_month: "last_month";
                           this_month: "this_month";
                           this_quarter: "this_quarter";
                           this_year: "this_year";
                        }>;
                     },
                     z.core.$strip
                  >,
                  z.ZodObject<
                     {
                        type: z.ZodLiteral<"absolute">;
                        start: z.ZodString;
                        end: z.ZodString;
                     },
                     z.core.$strip
                  >,
               ],
               "type"
            >;
            transactionType: z.ZodOptional<
               z.ZodArray<
                  z.ZodEnum<{
                     expense: "expense";
                     income: "income";
                     transfer: "transfer";
                  }>
               >
            >;
            bankAccountIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
            categoryIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
         },
         z.core.$strip
      >;
      interval: z.ZodDefault<
         z.ZodEnum<{
            day: "day";
            month: "month";
            week: "week";
         }>
      >;
      chartType: z.ZodDefault<
         z.ZodEnum<{
            bar: "bar";
            line: "line";
         }>
      >;
      compare: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
   },
   z.core.$strip
>;
export declare const breakdownConfigSchema: z.ZodObject<
   {
      type: z.ZodLiteral<"breakdown">;
      measure: z.ZodObject<
         {
            aggregation: z.ZodEnum<{
               avg: "avg";
               count: "count";
               net: "net";
               sum: "sum";
            }>;
         },
         z.core.$strip
      >;
      filters: z.ZodObject<
         {
            dateRange: z.ZodDiscriminatedUnion<
               [
                  z.ZodObject<
                     {
                        type: z.ZodLiteral<"relative">;
                        value: z.ZodEnum<{
                           "12m": "12m";
                           "14d": "14d";
                           "180d": "180d";
                           "30d": "30d";
                           "7d": "7d";
                           "90d": "90d";
                           last_month: "last_month";
                           this_month: "this_month";
                           this_quarter: "this_quarter";
                           this_year: "this_year";
                        }>;
                     },
                     z.core.$strip
                  >,
                  z.ZodObject<
                     {
                        type: z.ZodLiteral<"absolute">;
                        start: z.ZodString;
                        end: z.ZodString;
                     },
                     z.core.$strip
                  >,
               ],
               "type"
            >;
            transactionType: z.ZodOptional<
               z.ZodArray<
                  z.ZodEnum<{
                     expense: "expense";
                     income: "income";
                     transfer: "transfer";
                  }>
               >
            >;
            bankAccountIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
            categoryIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
         },
         z.core.$strip
      >;
      groupBy: z.ZodDefault<
         z.ZodEnum<{
            bank_account: "bank_account";
            category: "category";
            subcategory: "subcategory";
            transaction_type: "transaction_type";
         }>
      >;
      limit: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
   },
   z.core.$strip
>;
export declare const insightConfigSchema: z.ZodDiscriminatedUnion<
   [
      z.ZodObject<
         {
            type: z.ZodLiteral<"kpi">;
            measure: z.ZodObject<
               {
                  aggregation: z.ZodEnum<{
                     avg: "avg";
                     count: "count";
                     net: "net";
                     sum: "sum";
                  }>;
               },
               z.core.$strip
            >;
            filters: z.ZodObject<
               {
                  dateRange: z.ZodDiscriminatedUnion<
                     [
                        z.ZodObject<
                           {
                              type: z.ZodLiteral<"relative">;
                              value: z.ZodEnum<{
                                 "12m": "12m";
                                 "14d": "14d";
                                 "180d": "180d";
                                 "30d": "30d";
                                 "7d": "7d";
                                 "90d": "90d";
                                 last_month: "last_month";
                                 this_month: "this_month";
                                 this_quarter: "this_quarter";
                                 this_year: "this_year";
                              }>;
                           },
                           z.core.$strip
                        >,
                        z.ZodObject<
                           {
                              type: z.ZodLiteral<"absolute">;
                              start: z.ZodString;
                              end: z.ZodString;
                           },
                           z.core.$strip
                        >,
                     ],
                     "type"
                  >;
                  transactionType: z.ZodOptional<
                     z.ZodArray<
                        z.ZodEnum<{
                           expense: "expense";
                           income: "income";
                           transfer: "transfer";
                        }>
                     >
                  >;
                  bankAccountIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
                  categoryIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
               },
               z.core.$strip
            >;
            compare: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
         },
         z.core.$strip
      >,
      z.ZodObject<
         {
            type: z.ZodLiteral<"time_series">;
            measure: z.ZodObject<
               {
                  aggregation: z.ZodEnum<{
                     avg: "avg";
                     count: "count";
                     net: "net";
                     sum: "sum";
                  }>;
               },
               z.core.$strip
            >;
            filters: z.ZodObject<
               {
                  dateRange: z.ZodDiscriminatedUnion<
                     [
                        z.ZodObject<
                           {
                              type: z.ZodLiteral<"relative">;
                              value: z.ZodEnum<{
                                 "12m": "12m";
                                 "14d": "14d";
                                 "180d": "180d";
                                 "30d": "30d";
                                 "7d": "7d";
                                 "90d": "90d";
                                 last_month: "last_month";
                                 this_month: "this_month";
                                 this_quarter: "this_quarter";
                                 this_year: "this_year";
                              }>;
                           },
                           z.core.$strip
                        >,
                        z.ZodObject<
                           {
                              type: z.ZodLiteral<"absolute">;
                              start: z.ZodString;
                              end: z.ZodString;
                           },
                           z.core.$strip
                        >,
                     ],
                     "type"
                  >;
                  transactionType: z.ZodOptional<
                     z.ZodArray<
                        z.ZodEnum<{
                           expense: "expense";
                           income: "income";
                           transfer: "transfer";
                        }>
                     >
                  >;
                  bankAccountIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
                  categoryIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
               },
               z.core.$strip
            >;
            interval: z.ZodDefault<
               z.ZodEnum<{
                  day: "day";
                  month: "month";
                  week: "week";
               }>
            >;
            chartType: z.ZodDefault<
               z.ZodEnum<{
                  bar: "bar";
                  line: "line";
               }>
            >;
            compare: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
         },
         z.core.$strip
      >,
      z.ZodObject<
         {
            type: z.ZodLiteral<"breakdown">;
            measure: z.ZodObject<
               {
                  aggregation: z.ZodEnum<{
                     avg: "avg";
                     count: "count";
                     net: "net";
                     sum: "sum";
                  }>;
               },
               z.core.$strip
            >;
            filters: z.ZodObject<
               {
                  dateRange: z.ZodDiscriminatedUnion<
                     [
                        z.ZodObject<
                           {
                              type: z.ZodLiteral<"relative">;
                              value: z.ZodEnum<{
                                 "12m": "12m";
                                 "14d": "14d";
                                 "180d": "180d";
                                 "30d": "30d";
                                 "7d": "7d";
                                 "90d": "90d";
                                 last_month: "last_month";
                                 this_month: "this_month";
                                 this_quarter: "this_quarter";
                                 this_year: "this_year";
                              }>;
                           },
                           z.core.$strip
                        >,
                        z.ZodObject<
                           {
                              type: z.ZodLiteral<"absolute">;
                              start: z.ZodString;
                              end: z.ZodString;
                           },
                           z.core.$strip
                        >,
                     ],
                     "type"
                  >;
                  transactionType: z.ZodOptional<
                     z.ZodArray<
                        z.ZodEnum<{
                           expense: "expense";
                           income: "income";
                           transfer: "transfer";
                        }>
                     >
                  >;
                  bankAccountIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
                  categoryIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
               },
               z.core.$strip
            >;
            groupBy: z.ZodDefault<
               z.ZodEnum<{
                  bank_account: "bank_account";
                  category: "category";
                  subcategory: "subcategory";
                  transaction_type: "transaction_type";
               }>
            >;
            limit: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
         },
         z.core.$strip
      >,
   ],
   "type"
>;
export type DateRange = z.infer<typeof dateRangeSchema>;
export type TransactionFilters = z.infer<typeof transactionFiltersSchema>;
export type Measure = z.infer<typeof measureSchema>;
export type KpiConfig = z.infer<typeof kpiConfigSchema>;
export type TimeSeriesConfig = z.infer<typeof timeSeriesConfigSchema>;
export type BreakdownConfig = z.infer<typeof breakdownConfigSchema>;
export type InsightConfig = z.infer<typeof insightConfigSchema>;
export interface KpiResult {
   value: number;
   comparison?: {
      value: number;
      percentageChange: number;
   };
}
export interface TimeSeriesDataPoint {
   date: string;
   value: number;
}
export interface TimeSeriesResult {
   data: TimeSeriesDataPoint[];
   comparison?: {
      data: TimeSeriesDataPoint[];
   };
}
export interface BreakdownItem {
   label: string;
   value: number;
   color?: string | null;
}
export interface BreakdownResult {
   data: BreakdownItem[];
   total: number;
}
//# sourceMappingURL=types.d.ts.map
