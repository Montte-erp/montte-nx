import type { DatabaseInstance } from "@core/database/client";
import { vi } from "vitest";

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

export function registerDbosMocks(mocks: DbosMocks) {
   vi.mock("@dbos-inc/dbos-sdk", () => ({
      DBOS: {
         logger: {
            info: mocks.infoSpy,
            warn: mocks.warnSpy,
            error: mocks.errorSpy,
         },
         runStep: mocks.runStepSpy,
         sleepms: mocks.sleepSpy,
         // oxlint-ignore no-explicit-any
         registerWorkflow: <F extends (...args: any[]) => any>(fn: F) => fn,
      },
      WorkflowQueue: class WorkflowQueue {
         constructor(
            public name: string,
            public options?: unknown,
         ) {}
      },
   }));

   vi.mock("@dbos-inc/drizzle-datasource", () => {
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
   });
}
