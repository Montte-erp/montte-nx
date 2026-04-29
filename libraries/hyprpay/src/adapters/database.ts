import type { MergedSchema } from "../core/schema-merger";

export type Where = Record<string, unknown>;

export interface FindManyOptions {
   limit?: number;
   offset?: number;
   orderBy?: Record<string, "asc" | "desc">;
}

export interface DatabaseAdapter {
   id: string;
   schemaName?: string;
   create<T = unknown>(
      table: string,
      values: Record<string, unknown>,
   ): Promise<T>;
   findOne<T = unknown>(table: string, where: Where): Promise<T | null>;
   findMany<T = unknown>(
      table: string,
      where?: Where,
      opts?: FindManyOptions,
   ): Promise<T[]>;
   update<T = unknown>(
      table: string,
      where: Where,
      values: Record<string, unknown>,
   ): Promise<T>;
   delete(table: string, where: Where): Promise<void>;
   transaction<T>(fn: (tx: DatabaseAdapter) => Promise<T>): Promise<T>;
   applyMigrations?(schema: MergedSchema): Promise<void>;
}
