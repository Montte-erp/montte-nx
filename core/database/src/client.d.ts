import { type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@core/database/schema";
import { relations } from "@core/database/relations";
export type DatabaseInstance = NodePgDatabase<typeof schema, typeof relations>;
export declare const createDb: (opts: {
   databaseUrl: string;
   max?: number | undefined;
}) => DatabaseInstance;
//# sourceMappingURL=client.d.ts.map
