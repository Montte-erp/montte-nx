import { getLogger } from "@core/logging/root";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "@core/database/schema";
import { relations } from "@core/database/relations";

export type DatabaseInstance = NodePgDatabase<typeof schema, typeof relations>;

export const createDb = (opts: {
   databaseUrl: string;
   max?: number;
}): DatabaseInstance => {
   const logger = getLogger().child({ module: "database" });
   const pool = new Pool({
      connectionString: opts.databaseUrl,
      max: opts.max ?? 20,
   });
   logger.info("Connected successfully");
   return drizzle({
      casing: "snake_case",
      client: pool,
      schema,
      relations,
   });
};
