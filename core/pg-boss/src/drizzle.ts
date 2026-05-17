import { sql } from "drizzle-orm";
import { fromDrizzle } from "pg-boss";
import type { DrizzleTransactionLike } from "pg-boss";

export function fromDrizzleTransaction(tx: DrizzleTransactionLike) {
   return fromDrizzle(tx, sql);
}
