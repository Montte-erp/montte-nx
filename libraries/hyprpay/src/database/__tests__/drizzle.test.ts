import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { drizzleAdapter } from "../drizzle";
import { mergeSchemas, type TableSchema } from "../../core/schema-merger";

interface TestCtx {
   client: PGlite;
   db: ReturnType<typeof drizzle>;
}

const subscriptionsTable: TableSchema = {
   fields: {
      status: { type: "string", required: true },
      gatewayId: { type: "string", required: true },
   },
   indexes: [{ fields: ["status"] }],
};

async function setup(): Promise<TestCtx> {
   const client = new PGlite();
   const db = drizzle({ client });
   return { client, db };
}

describe("drizzleAdapter", () => {
   let ctx: TestCtx;

   beforeEach(async () => {
      ctx = await setup();
   });

   afterEach(async () => {
      await ctx.client.close();
   });

   describe("applyMigrations", () => {
      it("creates tables in the public schema by default", async () => {
         const adapter = drizzleAdapter(ctx.db);
         const merged = mergeSchemas([
            {
               pluginId: "subscriptions",
               schema: { subscriptions: subscriptionsTable },
            },
         ]);
         await adapter.applyMigrations!(merged);

         const tables = await ctx.client.query<{ table_name: string }>(
            `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subscriptions'`,
         );
         expect(tables.rows).toHaveLength(1);
      });

      it("creates the schema and tables when schemaName is provided", async () => {
         const adapter = drizzleAdapter(ctx.db, { schemaName: "billing" });
         const merged = mergeSchemas(
            [
               {
                  pluginId: "subscriptions",
                  schema: { subscriptions: subscriptionsTable },
               },
            ],
            { schemaName: "billing" },
         );
         await adapter.applyMigrations!(merged);

         const schemas = await ctx.client.query<{ schema_name: string }>(
            `SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'billing'`,
         );
         expect(schemas.rows).toHaveLength(1);

         const tables = await ctx.client.query<{ table_name: string }>(
            `SELECT table_name FROM information_schema.tables WHERE table_schema = 'billing' AND table_name = 'subscriptions'`,
         );
         expect(tables.rows).toHaveLength(1);
      });

      it("injects core fields (id, userId, createdAt, updatedAt)", async () => {
         const adapter = drizzleAdapter(ctx.db);
         const merged = mergeSchemas([
            {
               pluginId: "subscriptions",
               schema: { subscriptions: subscriptionsTable },
            },
         ]);
         await adapter.applyMigrations!(merged);

         const cols = await ctx.client.query<{ column_name: string }>(
            `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'subscriptions'`,
         );
         const names = cols.rows.map((r) => r.column_name).sort();
         expect(names).toContain("id");
         expect(names).toContain("userId");
         expect(names).toContain("createdAt");
         expect(names).toContain("updatedAt");
         expect(names).toContain("status");
         expect(names).toContain("gatewayId");
      });

      it("creates declared indexes", async () => {
         const adapter = drizzleAdapter(ctx.db);
         const merged = mergeSchemas([
            {
               pluginId: "subscriptions",
               schema: { subscriptions: subscriptionsTable },
            },
         ]);
         await adapter.applyMigrations!(merged);

         const idxs = await ctx.client.query<{ indexname: string }>(
            `SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'subscriptions'`,
         );
         const names = idxs.rows.map((r) => r.indexname);
         expect(names).toContain("subscriptions_status_idx");
      });

      it("is idempotent — running twice does not throw", async () => {
         const adapter = drizzleAdapter(ctx.db);
         const merged = mergeSchemas([
            {
               pluginId: "subscriptions",
               schema: { subscriptions: subscriptionsTable },
            },
         ]);
         await adapter.applyMigrations!(merged);
         await expect(adapter.applyMigrations!(merged)).resolves.not.toThrow();
      });
   });

   describe("CRUD", () => {
      it("create + findOne returns the inserted row", async () => {
         const adapter = drizzleAdapter(ctx.db, { schemaName: "billing" });
         const merged = mergeSchemas(
            [
               {
                  pluginId: "subscriptions",
                  schema: { subscriptions: subscriptionsTable },
               },
            ],
            { schemaName: "billing" },
         );
         await adapter.applyMigrations!(merged);

         const userId = "00000000-0000-0000-0000-000000000001";
         const created = await adapter.create<{
            id: string;
            status: string;
            gatewayId: string;
            userId: string;
         }>("subscriptions", {
            userId,
            status: "active",
            gatewayId: "stripe",
         });
         expect(created.id).toBeDefined();
         expect(created.status).toBe("active");
         expect(created.gatewayId).toBe("stripe");
         expect(created.userId).toBe(userId);

         const found = await adapter.findOne<{ id: string; status: string }>(
            "subscriptions",
            { id: created.id },
         );
         expect(found?.status).toBe("active");
      });

      it("update changes values and returns the row", async () => {
         const adapter = drizzleAdapter(ctx.db);
         await adapter.applyMigrations!(
            mergeSchemas([
               {
                  pluginId: "subscriptions",
                  schema: { subscriptions: subscriptionsTable },
               },
            ]),
         );
         const created = await adapter.create<{ id: string }>("subscriptions", {
            userId: "00000000-0000-0000-0000-000000000001",
            status: "active",
            gatewayId: "stripe",
         });
         const updated = await adapter.update<{ id: string; status: string }>(
            "subscriptions",
            { id: created.id },
            { status: "canceled" },
         );
         expect(updated.status).toBe("canceled");
      });

      it("findMany respects limit and orderBy", async () => {
         const adapter = drizzleAdapter(ctx.db);
         await adapter.applyMigrations!(
            mergeSchemas([
               {
                  pluginId: "subscriptions",
                  schema: { subscriptions: subscriptionsTable },
               },
            ]),
         );
         const userId = "00000000-0000-0000-0000-000000000001";
         await adapter.create("subscriptions", {
            userId,
            status: "active",
            gatewayId: "stripe",
         });
         await adapter.create("subscriptions", {
            userId,
            status: "canceled",
            gatewayId: "stripe",
         });

         const rows = await adapter.findMany<{ status: string }>(
            "subscriptions",
            { gatewayId: "stripe" },
            { limit: 10, orderBy: { status: "asc" } },
         );
         expect(rows).toHaveLength(2);
         expect(rows[0].status).toBe("active");
         expect(rows[1].status).toBe("canceled");
      });

      it("delete removes the row", async () => {
         const adapter = drizzleAdapter(ctx.db);
         await adapter.applyMigrations!(
            mergeSchemas([
               {
                  pluginId: "subscriptions",
                  schema: { subscriptions: subscriptionsTable },
               },
            ]),
         );
         const created = await adapter.create<{ id: string }>("subscriptions", {
            userId: "00000000-0000-0000-0000-000000000001",
            status: "active",
            gatewayId: "stripe",
         });
         await adapter.delete("subscriptions", { id: created.id });
         const found = await adapter.findOne("subscriptions", {
            id: created.id,
         });
         expect(found).toBeNull();
      });

      it("transaction commits on success", async () => {
         const adapter = drizzleAdapter(ctx.db);
         await adapter.applyMigrations!(
            mergeSchemas([
               {
                  pluginId: "subscriptions",
                  schema: { subscriptions: subscriptionsTable },
               },
            ]),
         );
         const userId = "00000000-0000-0000-0000-000000000001";
         const id = await adapter.transaction(async (tx) => {
            const r = await tx.create<{ id: string }>("subscriptions", {
               userId,
               status: "active",
               gatewayId: "stripe",
            });
            return r.id;
         });
         const found = await adapter.findOne("subscriptions", { id });
         expect(found).not.toBeNull();
      });

      it("transaction rolls back on throw", async () => {
         const adapter = drizzleAdapter(ctx.db);
         await adapter.applyMigrations!(
            mergeSchemas([
               {
                  pluginId: "subscriptions",
                  schema: { subscriptions: subscriptionsTable },
               },
            ]),
         );
         const userId = "00000000-0000-0000-0000-000000000001";
         await expect(
            adapter.transaction(async (tx) => {
               await tx.create("subscriptions", {
                  userId,
                  status: "active",
                  gatewayId: "stripe",
               });
               throw new Error("rollback");
            }),
         ).rejects.toThrow("rollback");

         const rows = await adapter.findMany("subscriptions", { userId });
         expect(rows).toHaveLength(0);
      });
   });
});
