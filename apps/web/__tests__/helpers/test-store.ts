import type { DatabaseInstance } from "@core/database/client";
import type { TestAuth } from "./create-test-auth";

interface TestStore {
   db: DatabaseInstance | null;
   auth: TestAuth | null;
}

export const testStore: TestStore = {
   db: null,
   auth: null,
};
