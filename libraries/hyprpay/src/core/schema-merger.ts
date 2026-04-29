export type FieldType =
   | "string"
   | "number"
   | "boolean"
   | "date"
   | "json"
   | "uuid";

export interface FieldSchema {
   type: FieldType;
   primary?: boolean;
   required?: boolean;
   unique?: boolean;
   defaultValue?: unknown;
   references?: { table: string; field: string };
}

export interface TableSchema {
   fields: Record<string, FieldSchema>;
   indexes?: Array<{ name?: string; fields: string[]; unique?: boolean }>;
}

export interface AdditionalField {
   pluginId: string;
   field: FieldSchema;
}

const CORE_FIELDS: Record<string, FieldSchema> = {
   id: { type: "uuid", primary: true, required: true },
   userId: { type: "uuid", required: true },
   createdAt: { type: "date", required: true },
   updatedAt: { type: "date", required: true },
};

export interface MergeSchemasInput {
   pluginId: string;
   schema: Record<string, TableSchema>;
}

export interface MergedSchema {
   schemaName?: string;
   tables: Record<string, TableSchema>;
   ownership: Record<string, string>;
}

export interface MergeSchemasOptions {
   schemaName?: string;
}

export function mergeSchemas(
   plugins: MergeSchemasInput[],
   options?: MergeSchemasOptions,
): MergedSchema {
   const tables: Record<string, TableSchema> = {};
   const ownership: Record<string, string> = {};

   for (const { pluginId, schema } of plugins) {
      for (const [tableName, table] of Object.entries(schema)) {
         const existing = tables[tableName];
         if (!existing) {
            tables[tableName] = {
               fields: { ...CORE_FIELDS, ...table.fields },
               indexes: table.indexes ? [...table.indexes] : undefined,
            };
            ownership[tableName] = pluginId;
            continue;
         }
         tables[tableName] = {
            fields: { ...existing.fields, ...table.fields },
            indexes: mergeIndexes(existing.indexes, table.indexes),
         };
      }
   }

   return { schemaName: options?.schemaName, tables, ownership };
}

function mergeIndexes(
   a: TableSchema["indexes"],
   b: TableSchema["indexes"],
): TableSchema["indexes"] {
   if (!a && !b) return undefined;
   if (!a) return b;
   if (!b) return a;
   return [...a, ...b];
}
