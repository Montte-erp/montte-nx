import { PGlite } from "@electric-sql/pglite";
import { uuid_ossp } from "@electric-sql/pglite/contrib/uuid_ossp";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { DBOS, type DBOSConfig } from "@dbos-inc/dbos-sdk";
import { Pool, type PoolClient, type PoolConfig, type QueryConfig } from "pg";

export type PgliteDbosRuntime = {
   databaseUrl: string;
   shutdown: () => Promise<void>;
};

export async function launchPgliteDBOS(): Promise<PgliteDbosRuntime> {
   const pg = new PGlite({ extensions: { uuid_ossp } });
   await pg.waitReady;

   const port = 16432 + Math.floor(Math.random() * 10_000);
   const server = new PGLiteSocketServer({ db: pg, port, host: "127.0.0.1" });
   await server.start();

   const databaseUrl = `postgresql://postgres:postgres@127.0.0.1:${port}/postgres`;
   const systemDatabasePool = createPgliteDbosPool({
      connectionString: databaseUrl,
      max: 1,
   });

   await DBOS.shutdown();
   const config: DBOSConfig = {
      name: "classification-pglite-test",
      systemDatabaseUrl: databaseUrl,
      systemDatabasePool,
      useListenNotify: false,
      runAdminServer: false,
      schedulerPollingIntervalMs: 200,
   };
   DBOS.setConfig(config);
   await DBOS.launch();

   return {
      databaseUrl,
      shutdown: async () => {
         await DBOS.shutdown();
         await server.stop();
         await pg.close();
      },
   };
}

function createPgliteDbosPool(config: PoolConfig): Pool {
   const pool = new Pool(config);

   pool.on("connect", (client) => {
      patchPgliteDbosClient(client);
   });

   return pool;
}

function patchPgliteDbosClient(client: PoolClient): void {
   const query = client.query.bind(client);

   client.query = new Proxy(query, {
      apply(target, thisArgument, argumentsList) {
         const [statement] = argumentsList;
         const [normalizedStatement, ...rest] =
            normalizePgliteDbosQueryArguments(statement, argumentsList);

         if (normalizedStatement !== statement) {
            return Reflect.apply(target, thisArgument, [
               normalizedStatement,
               ...rest,
            ]);
         }

         return Reflect.apply(target, thisArgument, argumentsList);
      },
   });
}

function normalizePgliteDbosQueryArguments(
   statement: unknown,
   argumentsList: Array<unknown>,
): Array<unknown> {
   if (typeof statement === "string") {
      return [
         stripConcurrentIndexKeyword(statement),
         ...argumentsList.slice(1),
      ];
   }

   if (isQueryConfigWithText(statement)) {
      return [
         { ...statement, text: stripConcurrentIndexKeyword(statement.text) },
         ...argumentsList.slice(1),
      ];
   }

   return argumentsList;
}

function stripConcurrentIndexKeyword(queryText: string): string {
   return queryText.replace(/\sCONCURRENTLY\b/gi, "");
}

function isQueryConfigWithText(statement: unknown): statement is QueryConfig {
   return (
      typeof statement === "object" &&
      statement !== null &&
      "text" in statement &&
      typeof statement.text === "string"
   );
}
