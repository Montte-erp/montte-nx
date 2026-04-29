import type { FieldSchema, MergedSchema, TableSchema } from "./schema-merger";

const RESERVED_WORDS = new Set([
   "user",
   "order",
   "table",
   "column",
   "select",
   "from",
   "where",
   "group",
]);

export function generateDDL(schema: MergedSchema): string[] {
   const stmts: string[] = [];
   const target = schema.schemaName;

   if (target) {
      stmts.push(`CREATE SCHEMA IF NOT EXISTS ${quoteIdent(target)};`);
   }

   for (const [name, table] of Object.entries(schema.tables)) {
      stmts.push(buildCreateTable(name, table, target));
   }

   for (const [name, table] of Object.entries(schema.tables)) {
      for (const idx of table.indexes ?? []) {
         stmts.push(buildCreateIndex(name, idx, target));
      }
   }

   return stmts;
}

export function quoteIdent(ident: string): string {
   if (
      !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(ident) ||
      RESERVED_WORDS.has(ident.toLowerCase())
   ) {
      return `"${ident.replace(/"/g, '""')}"`;
   }
   return `"${ident}"`;
}

function qualified(name: string, schema?: string): string {
   return schema
      ? `${quoteIdent(schema)}.${quoteIdent(name)}`
      : quoteIdent(name);
}

function buildCreateTable(
   name: string,
   table: TableSchema,
   schemaName?: string,
): string {
   const cols = Object.entries(table.fields).map(([colName, field]) =>
      buildColumnDef(colName, field, schemaName),
   );
   return `CREATE TABLE IF NOT EXISTS ${qualified(name, schemaName)} (\n  ${cols.join(",\n  ")}\n);`;
}

function buildColumnDef(
   name: string,
   field: FieldSchema,
   schemaName?: string,
): string {
   const parts: string[] = [`${quoteIdent(name)} ${mapFieldType(field)}`];
   if (field.primary) parts.push("PRIMARY KEY");
   if (field.required && !field.primary) parts.push("NOT NULL");
   if (field.unique) parts.push("UNIQUE");
   if (field.defaultValue !== undefined) {
      parts.push(`DEFAULT ${quoteLiteral(field.defaultValue)}`);
   } else if (field.primary && field.type === "uuid") {
      parts.push("DEFAULT gen_random_uuid()");
   } else if (
      field.type === "date" &&
      (name === "createdAt" || name === "updatedAt")
   ) {
      parts.push("DEFAULT CURRENT_TIMESTAMP");
   }
   if (field.references) {
      parts.push(
         `REFERENCES ${qualified(field.references.table, schemaName)}(${quoteIdent(field.references.field)})`,
      );
   }
   return parts.join(" ");
}

function mapFieldType(field: FieldSchema): string {
   switch (field.type) {
      case "uuid":
         return "uuid";
      case "string":
         return "text";
      case "number":
         return "numeric";
      case "boolean":
         return "boolean";
      case "date":
         return "timestamp with time zone";
      case "json":
         return "jsonb";
   }
}

function quoteLiteral(value: unknown): string {
   if (value === null || value === undefined) return "NULL";
   if (typeof value === "number" || typeof value === "boolean")
      return String(value);
   if (typeof value === "string") return `'${value.replace(/'/g, "''")}'`;
   return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
}

function buildCreateIndex(
   tableName: string,
   idx: NonNullable<TableSchema["indexes"]>[number],
   schemaName?: string,
): string {
   const indexName = idx.name ?? `${tableName}_${idx.fields.join("_")}_idx`;
   const cols = idx.fields.map(quoteIdent).join(", ");
   const unique = idx.unique ? "UNIQUE " : "";
   return `CREATE ${unique}INDEX IF NOT EXISTS ${quoteIdent(indexName)} ON ${qualified(tableName, schemaName)} (${cols});`;
}
