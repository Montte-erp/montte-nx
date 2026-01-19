/**
 * Common pagination types and utilities for repository functions.
 * This module provides reusable pagination logic to reduce code duplication.
 */

export type PaginationOptions<TOrderBy extends string = string> = {
   page?: number;
   limit?: number;
   orderBy?: TOrderBy;
   orderDirection?: "asc" | "desc";
   search?: string;
};

export type PaginationMeta = {
   currentPage: number;
   hasNextPage: boolean;
   hasPreviousPage: boolean;
   limit: number;
   totalCount: number;
   totalPages: number;
};

export type PaginatedResult<T> = {
   items: T[];
   pagination: PaginationMeta;
};

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 10;
export const DEFAULT_ORDER_DIRECTION = "asc" as const;

/**
 * Parses pagination options with defaults
 */
export function parsePaginationOptions<TOrderBy extends string>(
   options: PaginationOptions<TOrderBy>,
   defaultOrderBy: TOrderBy,
): Required<PaginationOptions<TOrderBy>> {
   return {
      page: options.page ?? DEFAULT_PAGE,
      limit: options.limit ?? DEFAULT_LIMIT,
      orderBy: options.orderBy ?? defaultOrderBy,
      orderDirection: options.orderDirection ?? DEFAULT_ORDER_DIRECTION,
      search: options.search ?? "",
   };
}

/**
 * Calculates the offset for a given page and limit
 */
export function calculateOffset(page: number, limit: number): number {
   return (page - 1) * limit;
}

/**
 * Builds pagination metadata from total count and current options
 */
export function buildPaginationMeta(
   totalCount: number,
   page: number,
   limit: number,
): PaginationMeta {
   const totalPages = Math.ceil(totalCount / limit);

   return {
      currentPage: page,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
      limit,
      totalCount,
      totalPages,
   };
}

/**
 * Creates a paginated result from items and count
 */
export function createPaginatedResult<T>(
   items: T[],
   totalCount: number,
   page: number,
   limit: number,
): PaginatedResult<T> {
   return {
      items,
      pagination: buildPaginationMeta(totalCount, page, limit),
   };
}
