import { log } from "@core/logging";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "@core/database/schema";

export type DatabaseInstance = NodePgDatabase<typeof schema>;

export const createDb = (opts: {
   databaseUrl: string;
   max?: number;
}): DatabaseInstance => {
   const pool = new Pool({
      connectionString: opts.databaseUrl,
      max: opts.max ?? 20,
   });
   log.info("database", "Connected successfully");
   return drizzle({
      casing: "snake_case",
      client: pool,
      schema,
   });
};
