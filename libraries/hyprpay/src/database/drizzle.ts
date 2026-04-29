import { sql, type SQL } from "drizzle-orm";
import type {
   DatabaseAdapter,
   FindManyOptions,
   Where,
} from "../adapters/database";
import { generateDDL } from "../core/ddl";
import { HyprPayError } from "../core/errors";
import type { MergedSchema } from "../core/schema-merger";

interface DrizzleLike {
   execute(query: SQL): Promise<{ rows: Array<Record<string, unknown>> }>;
   transaction<T>(fn: (tx: DrizzleLike) => Promise<T>): Promise<T>;
}

export interface DrizzleAdapterOptions {
   schemaName?: string;
}

export function drizzleAdapter(
   db: DrizzleLike,
   options?: DrizzleAdapterOptions,
): DatabaseAdapter {
   return makeAdapter(db, options?.schemaName);
}

function makeAdapter(db: DrizzleLike, schemaName?: string): DatabaseAdapter {
   const tableRef = (table: string): SQL =>
      schemaName
         ? sql`${sql.identifier(schemaName)}.${sql.identifier(table)}`
         : sql`${sql.identifier(table)}`;

   const whereClause = (where: Where): SQL => {
      const entries = Object.entries(where);
      if (entries.length === 0) return sql`TRUE`;
      const parts = entries.map(([k, v]) => sql`${sql.identifier(k)} = ${v}`);
      return sql.join(parts, sql` AND `);
   };

   const orderByClause = (orderBy?: Record<string, "asc" | "desc">): SQL => {
      if (!orderBy) return sql``;
      const entries = Object.entries(orderBy);
      if (entries.length === 0) return sql``;
      const parts = entries.map(([k, dir]) =>
         dir === "desc"
            ? sql`${sql.identifier(k)} DESC`
            : sql`${sql.identifier(k)} ASC`,
      );
      return sql` ORDER BY ${sql.join(parts, sql`, `)}`;
   };

   const adapter: DatabaseAdapter = {
      id: "drizzle",
      schemaName,

      async create(table, values) {
         const cols = Object.keys(values);
         if (cols.length === 0) {
            throw HyprPayError.badRequest(
               "EMPTY_INSERT",
               `Não é possível inserir em "${table}" sem valores.`,
            );
         }
         const colSql = sql.join(
            cols.map((c) => sql.identifier(c)),
            sql`, `,
         );
         const valSql = sql.join(
            cols.map((c) => sql`${values[c]}`),
            sql`, `,
         );
         const result = await db.execute(
            sql`INSERT INTO ${tableRef(table)} (${colSql}) VALUES (${valSql}) RETURNING *`,
         );
         const row = result.rows[0];
         if (!row) {
            throw HyprPayError.internal(
               "INSERT_NO_ROW",
               `INSERT em "${table}" não retornou linha.`,
            );
         }
         return row as never;
      },

      async findOne(table, where) {
         const result = await db.execute(
            sql`SELECT * FROM ${tableRef(table)} WHERE ${whereClause(where)} LIMIT 1`,
         );
         const row = result.rows[0];
         return (row ?? null) as never;
      },

      async findMany(table, where, opts?: FindManyOptions) {
         const wherePart =
            where && Object.keys(where).length > 0
               ? sql` WHERE ${whereClause(where)}`
               : sql``;
         const limitPart =
            typeof opts?.limit === "number" ? sql` LIMIT ${opts.limit}` : sql``;
         const offsetPart =
            typeof opts?.offset === "number"
               ? sql` OFFSET ${opts.offset}`
               : sql``;
         const result = await db.execute(
            sql`SELECT * FROM ${tableRef(table)}${wherePart}${orderByClause(opts?.orderBy)}${limitPart}${offsetPart}`,
         );
         return result.rows as never;
      },

      async update(table, where, values) {
         const cols = Object.keys(values);
         if (cols.length === 0) {
            throw HyprPayError.badRequest(
               "EMPTY_UPDATE",
               `UPDATE em "${table}" requer ao menos um valor.`,
            );
         }
         const setSql = sql.join(
            cols.map((c) => sql`${sql.identifier(c)} = ${values[c]}`),
            sql`, `,
         );
         const result = await db.execute(
            sql`UPDATE ${tableRef(table)} SET ${setSql} WHERE ${whereClause(where)} RETURNING *`,
         );
         const row = result.rows[0];
         if (!row) {
            throw HyprPayError.notFound(
               "UPDATE_NO_MATCH",
               `Nenhuma linha encontrada em "${table}" para atualizar.`,
            );
         }
         return row as never;
      },

      async delete(table, where) {
         await db.execute(
            sql`DELETE FROM ${tableRef(table)} WHERE ${whereClause(where)}`,
         );
      },

      async transaction(fn) {
         return db.transaction(async (tx) => fn(makeAdapter(tx, schemaName)));
      },

      async applyMigrations(schema: MergedSchema) {
         const effectiveSchema: MergedSchema = {
            ...schema,
            schemaName: schema.schemaName ?? schemaName,
         };
         const stmts = generateDDL(effectiveSchema);
         for (const stmt of stmts) {
            await db.execute(sql.raw(stmt));
         }
      },
   };

   return adapter;
}
