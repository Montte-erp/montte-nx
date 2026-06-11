import { defineConfig } from "evalite/config";
import { createInMemoryStorage } from "evalite/in-memory-storage";

export default defineConfig({
   maxConcurrency: 10,
   storage: () => createInMemoryStorage(),
   testTimeout: 600_000,
});
