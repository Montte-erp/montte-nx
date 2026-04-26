import { PGlite } from "@electric-sql/pglite";
import { uuid_ossp } from "@electric-sql/pglite/contrib/uuid_ossp";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { DBOS, type DBOSConfig } from "@dbos-inc/dbos-sdk";

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

   await DBOS.shutdown();
   const config: DBOSConfig = {
      name: "classification-pglite-test",
      systemDatabaseUrl: databaseUrl,
      systemDatabasePoolSize: 1,
      useListenNotify: false,
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
