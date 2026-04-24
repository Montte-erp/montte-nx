import { DBOSClient } from "@dbos-inc/dbos-sdk";
export function createWorkflowClient(systemDatabaseUrl) {
   return DBOSClient.create({ systemDatabaseUrl });
}
