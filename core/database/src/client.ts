import { env } from "@core/environment/web/server";
import { getLogger } from "@core/logging/root";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "@core/database/schema";
import { relations } from "@core/database/relations";

const logger = getLogger().child({ module: "database" });

export type DatabaseInstance = NodePgDatabase<typeof schema, typeof relations>;

export const pool = new Pool({
   connectionString: env.DATABASE_URL,
   max: 20,
});

export const db: DatabaseInstance = drizzle({
   casing: "snake_case",
   client: pool,
   schema,
   relations,
});

export const createDb = (opts?: {
   databaseUrl?: string;
   max?: number;
}): DatabaseInstance => {
   const p = new Pool({
      connectionString: opts?.databaseUrl,
      max: opts?.max ?? 20,
   });
   return drizzle({
      casing: "snake_case",
      client: p,
      schema,
      relations,
   });
};

logger.info("Connected successfully");
