import type { DatabaseInstance } from "@core/database/client";
export declare function createDefaultInsights(
   db: DatabaseInstance,
   organizationId: string,
   teamId: string,
   userId: string,
): Promise<string[]>;
export declare function createDefaultDashboard(
   db: DatabaseInstance,
   organizationId: string,
   teamId: string,
   userId: string,
   name: string,
   insightIds: string[],
): Promise<
   | {
        createdAt: Date;
        createdBy: string;
        description: string | null;
        globalDateRange: {
           type: "absolute" | "relative";
           value: string;
        } | null;
        globalFilters:
           | (
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
           | null;
        id: string;
        isDefault: boolean;
        name: string;
        organizationId: string;
        teamId: string;
        tiles: {
           insightId: string;
           size: "full" | "lg" | "md" | "sm";
           order: number;
        }[];
        updatedAt: Date;
     }
   | undefined
>;
//# sourceMappingURL=seed-defaults.d.ts.map
