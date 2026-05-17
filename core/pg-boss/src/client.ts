import { PgBoss } from "pg-boss";
import type { ConstructorOptions } from "pg-boss";
import { getLogger } from "@core/logging/root";

const logger = getLogger().child({ module: "pg-boss" });

export type PgBossClient = PgBoss;

export type CreatePgBossClientOptions = {
   connectionString: string;
   schema?: string;
   applicationName?: string;
   enableSchedules?: boolean;
   supervise?: boolean;
};

export class PgBossJobError extends Error {
   constructor(message: string, options?: ErrorOptions) {
      super(message, options);
      this.name = "PgBossJobError";
   }
}

export function createPgBossClient(options: CreatePgBossClientOptions) {
   const constructorOptions: ConstructorOptions = {
      connectionString: options.connectionString,
      application_name: options.applicationName ?? "montte-pg-boss",
      schedule: options.enableSchedules ?? false,
      supervise: options.supervise ?? true,
      persistWarnings: true,
   };
   if (options.schema) constructorOptions.schema = options.schema;

   const boss = new PgBoss(constructorOptions);
   boss.on("error", (err) => {
      logger.error({ err }, "pg-boss error");
   });
   boss.on("warning", (warning) => {
      logger.warn({ warning }, "pg-boss warning");
   });
   return boss;
}

export async function startPgBossClient(options: CreatePgBossClientOptions) {
   const boss = createPgBossClient(options);
   await boss.start();
   return boss;
}
