import { DrizzleDataSource } from "@dbos-inc/drizzle-datasource";
import type { DatabaseInstance } from "@core/database/client";
import * as schema from "@core/database/schema";
import { env } from "@core/environment/worker";

export const workflowsDataSource = new DrizzleDataSource<DatabaseInstance>(
   "workflows",
   { connectionString: env.DATABASE_URL },
   schema,
);
