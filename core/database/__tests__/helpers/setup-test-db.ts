import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { pushSchema } from "drizzle-kit/api-postgres";
import * as schema from "@core/database/schema";
import { relations } from "@core/database/relations";
import type { DatabaseInstance } from "@core/database/client";

// =============================================================================
// PGLite Test Database
// =============================================================================

/**
 * Creates an in-memory PGLite database with the full schema applied.
 *
 * Each call spins up a fresh isolated Postgres instance — no shared state,
 * no Docker, safe for parallel test files in CI.
 *
 * @example
 * ```ts
 * import { setupTestDb } from "../helpers/setup-test-db";
 *
 * let db: Awaited<ReturnType<typeof setupTestDb>>["db"];
 * let cleanup: () => Promise<void>;
 *
 * beforeAll(async () => {
 *   ({ db, cleanup } = await setupTestDb());
 * });
 *
 * afterAll(async () => {
 *   await cleanup();
 * });
 * ```
 */
export async function setupTestDb() {
   const client = new PGlite();
   const db = drizzle({
      client,
      schema,
      relations,
   }) as unknown as DatabaseInstance;

   // Apply all Drizzle tables to the in-memory database
   const { apply } = await pushSchema(schema, db as any, "snake_case");
   await apply();

   return {
      db,
      client,
      cleanup: async () => {
         await client.close();
      },
   };
}

// =============================================================================
// Transaction-based test isolation
// =============================================================================

/**
 * Wraps each test in a transaction that rolls back after the test.
 * Keeps the schema intact between tests — only data is reset.
 *
 * @example
 * ```ts
 * import { setupTestDb } from "../helpers/setup-test-db";
 * import { withTestTransaction } from "../helpers/setup-test-db";
 *
 * let testDb: Awaited<ReturnType<typeof setupTestDb>>;
 *
 * beforeAll(async () => {
 *   testDb = await setupTestDb();
 * });
 *
 * afterAll(async () => {
 *   await testDb.cleanup();
 * });
 *
 * it("inserts data without polluting other tests", async () => {
 *   await withTestTransaction(testDb.db, async (tx) => {
 *     // tx is a DatabaseInstance scoped to a transaction
 *     // All changes are rolled back after the callback
 *     await tx.insert(users).values({ name: "Test" });
 *     const result = await tx.select().from(users);
 *     expect(result).toHaveLength(1);
 *   });
 *   // Data is gone here — rolled back
 * });
 * ```
 */
export async function withTestTransaction<T>(
   db: DatabaseInstance,
   fn: (tx: DatabaseInstance) => Promise<T>,
): Promise<T | undefined> {
   let result: T | undefined;
   try {
      await (db as any).transaction(async (tx: DatabaseInstance) => {
         result = await fn(tx);
         // Force rollback by throwing after the test function completes
         throw new RollbackError();
      });
   } catch (err) {
      if (!(err instanceof RollbackError)) {
         throw err;
      }
   }
   return result;
}

class RollbackError extends Error {
   constructor() {
      super("__test_rollback__");
      this.name = "RollbackError";
   }
}
