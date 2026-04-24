import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { pushSchema } from "drizzle-kit/api";
import { fromPromise } from "neverthrow";
import * as schema from "../schema";
import type { DatabaseInstance } from "../client";

const ROLLBACK_MARKER = "__test_rollback__";

export async function setupTestDb() {
   const client = new PGlite();
   const db = drizzle({
      client,
      schema,
   }) as unknown as DatabaseInstance;

   const { apply } = await pushSchema(schema, db as any, [
      "finance",
      "crm",
      "inventory",
      "platform",
   ]);
   await apply();

   return {
      db,
      client,
      cleanup: async () => {
         await client.close();
      },
   };
}

function isRollbackMarker(err: unknown): boolean {
   if (typeof err !== "object" || err === null) return false;
   if (!("message" in err)) return false;
   return err.message === ROLLBACK_MARKER;
}

export async function withTestTransaction<T>(
   db: DatabaseInstance,
   fn: (tx: DatabaseInstance) => Promise<T>,
): Promise<T | undefined> {
   let result: T | undefined;
   const txResult = await fromPromise(
      (db as any).transaction(async (tx: DatabaseInstance) => {
         result = await fn(tx);
         throw new Error(ROLLBACK_MARKER);
      }),
      (err) => err,
   );
   if (txResult.isErr() && !isRollbackMarker(txResult.error)) {
      throw txResult.error;
   }
   return result;
}
