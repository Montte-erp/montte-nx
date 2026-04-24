import { DBOSClient } from "@dbos-inc/dbos-sdk";

export function createWorkflowClient(
   systemDatabaseUrl: string,
): Promise<DBOSClient> {
   return DBOSClient.create({ systemDatabaseUrl });
}

export type { DBOSClient };
