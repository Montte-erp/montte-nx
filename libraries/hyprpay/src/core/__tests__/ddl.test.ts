import { describe, expect, it } from "vitest";
import { generateDDL } from "../ddl";
import { mergeSchemas } from "../schema-merger";

describe("generateDDL", () => {
   it("emits CREATE SCHEMA when schemaName is set", () => {
      const merged = mergeSchemas(
         [
            {
               pluginId: "subs",
               schema: {
                  subscriptions: {
                     fields: { status: { type: "string", required: true } },
                  },
               },
            },
         ],
         { schemaName: "billing" },
      );
      const stmts = generateDDL(merged);
      expect(stmts[0]).toBe('CREATE SCHEMA IF NOT EXISTS "billing";');
   });

   it("qualifies tables with schemaName", () => {
      const merged = mergeSchemas(
         [
            {
               pluginId: "subs",
               schema: {
                  subscriptions: {
                     fields: { status: { type: "string", required: true } },
                  },
               },
            },
         ],
         { schemaName: "billing" },
      );
      const stmts = generateDDL(merged);
      const create = stmts.find((s) => s.startsWith("CREATE TABLE"));
      expect(create).toContain('"billing"."subscriptions"');
   });

   it("uses public (unqualified) when schemaName is not set", () => {
      const merged = mergeSchemas([
         {
            pluginId: "subs",
            schema: {
               subscriptions: {
                  fields: { status: { type: "string", required: true } },
               },
            },
         },
      ]);
      const stmts = generateDDL(merged);
      const create = stmts.find((s) => s.startsWith("CREATE TABLE"));
      expect(create).toContain('"subscriptions"');
      expect(create).not.toContain('"public".');
   });

   it("injects defaults for id (uuid) and timestamps", () => {
      const merged = mergeSchemas([
         {
            pluginId: "subs",
            schema: {
               subscriptions: {
                  fields: { status: { type: "string", required: true } },
               },
            },
         },
      ]);
      const stmts = generateDDL(merged);
      const create = stmts.find((s) => s.startsWith("CREATE TABLE"))!;
      expect(create).toContain("DEFAULT gen_random_uuid()");
      expect(create).toContain("DEFAULT CURRENT_TIMESTAMP");
   });

   it("emits CREATE INDEX statements after table creation", () => {
      const merged = mergeSchemas([
         {
            pluginId: "subs",
            schema: {
               subscriptions: {
                  fields: { status: { type: "string", required: true } },
                  indexes: [{ fields: ["status"] }],
               },
            },
         },
      ]);
      const stmts = generateDDL(merged);
      const idxIdx = stmts.findIndex((s) => s.includes("CREATE INDEX"));
      const tableIdx = stmts.findIndex((s) => s.startsWith("CREATE TABLE"));
      expect(idxIdx).toBeGreaterThan(tableIdx);
      expect(stmts[idxIdx]).toContain('"subscriptions_status_idx"');
   });

   it("emits unique indexes when configured", () => {
      const merged = mergeSchemas([
         {
            pluginId: "subs",
            schema: {
               subscriptions: {
                  fields: { externalId: { type: "string" } },
                  indexes: [{ fields: ["externalId"], unique: true }],
               },
            },
         },
      ]);
      const stmts = generateDDL(merged);
      expect(stmts.some((s) => s.includes("CREATE UNIQUE INDEX"))).toBe(true);
   });
});
