import { getLogger } from "@core/logging/root";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@core/database/schema";
export const createDb = (opts) => {
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
   });
};
