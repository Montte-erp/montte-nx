import type { DatabaseInstance } from "@core/database/client";
import {
   type CreateDashboardInput,
   type Dashboard,
   type DashboardTile,
   type UpdateDashboardInput,
} from "@core/database/schemas/dashboards";
export declare function ensureDashboardOwnership(
   db: DatabaseInstance,
   id: string,
   organizationId: string,
   teamId: string,
): Promise<{
   id: string;
   organizationId: string;
   teamId: string;
   createdBy: string;
   name: string;
   description: string | null;
   isDefault: boolean;
   tiles: {
      insightId: string;
      size: "full" | "lg" | "md" | "sm";
      order: number;
   }[];
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
   createdAt: Date;
   updatedAt: Date;
}>;
export declare function createDashboard(
   db: DatabaseInstance,
   organizationId: string,
   teamId: string,
   createdBy: string,
   data: CreateDashboardInput,
): Promise<{
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
}>;
export declare function listDashboards(
   db: DatabaseInstance,
   organizationId: string,
): Promise<
   {
      id: string;
      organizationId: string;
      teamId: string;
      createdBy: string;
      name: string;
      description: string | null;
      isDefault: boolean;
      tiles: {
         insightId: string;
         size: "full" | "lg" | "md" | "sm";
         order: number;
      }[];
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
      createdAt: Date;
      updatedAt: Date;
   }[]
>;
export declare function listDashboardsByTeam(
   db: DatabaseInstance,
   teamId: string,
): Promise<
   {
      id: string;
      organizationId: string;
      teamId: string;
      createdBy: string;
      name: string;
      description: string | null;
      isDefault: boolean;
      tiles: {
         insightId: string;
         size: "full" | "lg" | "md" | "sm";
         order: number;
      }[];
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
      createdAt: Date;
      updatedAt: Date;
   }[]
>;
export declare function getDashboardById(
   db: DatabaseInstance,
   dashboardId: string,
): Promise<{
   id: string;
   organizationId: string;
   teamId: string;
   createdBy: string;
   name: string;
   description: string | null;
   isDefault: boolean;
   tiles: {
      insightId: string;
      size: "full" | "lg" | "md" | "sm";
      order: number;
   }[];
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
   createdAt: Date;
   updatedAt: Date;
} | null>;
export declare function updateDashboard(
   db: DatabaseInstance,
   dashboardId: string,
   data: UpdateDashboardInput,
): Promise<{
   id: string;
   organizationId: string;
   teamId: string;
   createdBy: string;
   name: string;
   description: string | null;
   isDefault: boolean;
   tiles: {
      insightId: string;
      size: "full" | "lg" | "md" | "sm";
      order: number;
   }[];
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
   createdAt: Date;
   updatedAt: Date;
}>;
export declare function updateDashboardTiles(
   db: DatabaseInstance,
   dashboardId: string,
   tiles: DashboardTile[],
): Promise<{
   id: string;
   organizationId: string;
   teamId: string;
   createdBy: string;
   name: string;
   description: string | null;
   isDefault: boolean;
   tiles: {
      insightId: string;
      size: "full" | "lg" | "md" | "sm";
      order: number;
   }[];
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
   createdAt: Date;
   updatedAt: Date;
}>;
export declare function deleteDashboard(
   db: DatabaseInstance,
   dashboardId: string,
): Promise<void>;
export declare function setDashboardAsHome(
   db: DatabaseInstance,
   dashboardId: string,
   teamId: string,
): Promise<{
   id: string;
   organizationId: string;
   teamId: string;
   createdBy: string;
   name: string;
   description: string | null;
   isDefault: boolean;
   tiles: {
      insightId: string;
      size: "full" | "lg" | "md" | "sm";
      order: number;
   }[];
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
   createdAt: Date;
   updatedAt: Date;
}>;
export declare function getDefaultDashboard(
   db: DatabaseInstance,
   organizationId: string,
   teamId: string,
): Promise<Dashboard>;
//# sourceMappingURL=dashboard-repository.d.ts.map
