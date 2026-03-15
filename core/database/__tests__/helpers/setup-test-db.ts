import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { pushSchema } from "drizzle-kit/api";
import * as schema from "@core/database/schema";
import type { DatabaseInstance } from "@core/database/client";

export async function setupTestDb() {
   const client = new PGlite();
   const db = drizzle({
      client,
      schema,
   }) as unknown as DatabaseInstance;

   const { apply } = await pushSchema(schema, db as any, ["public"]);
   await apply();

   return {
      db,
      client,
      cleanup: async () => {
         await client.close();
      },
   };
}

export async function withTestTransaction<T>(
   db: DatabaseInstance,
   fn: (tx: DatabaseInstance) => Promise<T>,
): Promise<T | undefined> {
   let result: T | undefined;
   try {
      await (db as any).transaction(async (tx: DatabaseInstance) => {
         result = await fn(tx);
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
