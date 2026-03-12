import { env } from "@core/environment/server";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "@core/database/schema";
import { relations } from "@core/database/relations";

export interface DatabaseClientOptions {
   databaseUrl?: string;
   max?: number;
}

export type DatabaseInstance = NodePgDatabase<typeof schema, typeof relations>;

export const createDb = (opts?: DatabaseClientOptions): DatabaseInstance => {
   return drizzle({
      casing: "snake_case",
      connection: {
         connectionString: opts?.databaseUrl,
         max: opts?.max,
      },
      schema,
      relations,
   });
};

export const db = createDb({ databaseUrl: env.DATABASE_URL });
