import type { DatabaseInstance } from "@core/database/client";
import { vi } from "vitest";

// Consumer pattern (vi.mock must appear literally in the test file so vitest
// hoists it above imports):
//
//    import { vi } from "vitest";
//    import {
//       createDbosMocks,
//       dbosSdkMockFactory,
//       drizzleDataSourceMockFactory,
//    } from "@core/dbos/testing/mock-dbos";
//
//    const mocks = vi.hoisted(() => createDbosMocks());
//    vi.mock("@dbos-inc/dbos-sdk", () => dbosSdkMockFactory(mocks));
//    vi.mock("@dbos-inc/drizzle-datasource", () => drizzleDataSourceMockFactory(mocks));
//
//    // workflow imports go here

export type DbosMocks = {
   runStepSpy: ReturnType<typeof vi.fn>;
   sleepSpy: ReturnType<typeof vi.fn>;
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
      static get client() {
         return mocks.getActiveDb();
      }
   }
   return { DrizzleDataSource };
}
