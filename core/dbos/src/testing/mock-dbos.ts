import type { DatabaseInstance } from "@core/database/client";
import { vi } from "vitest";

// Consumer pattern — `vi.hoisted` runs ABOVE imports, so use the async form
// and re-import this module inside each factory:
//
//    import { vi } from "vitest";
//
//    const dbosMocks = vi.hoisted(async () => {
//       const mod = await import("@core/dbos/testing/mock-dbos");
//       return mod.createDbosMocks();
//    });
//    vi.mock("@dbos-inc/dbos-sdk", async () => {
//       const mod = await import("@core/dbos/testing/mock-dbos");
//       return mod.dbosSdkMockFactory(await dbosMocks);
//    });
//    vi.mock("@dbos-inc/drizzle-datasource", async () => {
//       const mod = await import("@core/dbos/testing/mock-dbos");
//       return mod.drizzleDataSourceMockFactory(await dbosMocks);
//    });
//
//    // workflow imports go here. In hooks, await dbosMocks before .setActiveDb().

export type DbosMocks = {
   runStepSpy: ReturnType<typeof vi.fn>;
   sleepSpy: ReturnType<typeof vi.fn>;
   startWorkflowSpy: ReturnType<typeof vi.fn<(...args: unknown[]) => void>>;
   infoSpy: ReturnType<typeof vi.fn>;
   warnSpy: ReturnType<typeof vi.fn>;
   errorSpy: ReturnType<typeof vi.fn>;
   setActiveDb: (db: DatabaseInstance) => void;
   getActiveDb: () => DatabaseInstance;
};

export function createDbosMocks(): DbosMocks {
   let activeDb: DatabaseInstance | null = null;
   return {
      runStepSpy: vi.fn(async (fn: () => unknown) => fn()),
      sleepSpy: vi.fn(async () => undefined),
      startWorkflowSpy: vi.fn<(...args: unknown[]) => void>(),
      infoSpy: vi.fn(),
      warnSpy: vi.fn(),
      errorSpy: vi.fn(),
      setActiveDb: (db) => {
         activeDb = db;
      },
      getActiveDb: () => {
         if (!activeDb) throw new Error("Test DB not initialised in mock-dbos");
         return activeDb;
      },
   };
}

// oxlint-ignore no-explicit-any
export function dbosSdkMockFactory(mocks: DbosMocks) {
   return {
      DBOS: {
         logger: {
            info: mocks.infoSpy,
            warn: mocks.warnSpy,
            error: mocks.errorSpy,
         },
         runStep: mocks.runStepSpy,
         sleepms: mocks.sleepSpy,
         registerWorkflow: <F extends (...args: any[]) => any>(fn: F) => fn,
         startWorkflow: <Args extends unknown[], R>(
            _target: (...args: Args) => Promise<R>,
            params?: unknown,
         ) => {
            return (...args: Args) => {
               mocks.startWorkflowSpy(params, ...args);
               return Promise.resolve(undefined);
            };
         },
      },
      WorkflowQueue: class WorkflowQueue {
         constructor(
            public name: string,
            public options?: unknown,
         ) {}
      },
   };
}

export function drizzleDataSourceMockFactory(mocks: DbosMocks) {
   class DrizzleDataSource {
      constructor(
         public name: string,
         public config: unknown,
         public schema: unknown,
      ) {}
      runTransaction<T>(fn: () => Promise<T>): Promise<T> {
         return fn();
      }
      get client() {
         return mocks.getActiveDb();
      }
      static get client() {
         return mocks.getActiveDb();
      }
      static initializeDBOSSchema() {
         return Promise.resolve();
      }
   }
   return { DrizzleDataSource };
}
