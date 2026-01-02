import { createDb } from "../client";
import { seedAutomationTemplates } from "./automation-templates";

async function main() {
   console.log("Running database seeds...\n");

   const databaseUrl = process.env.DATABASE_URL;
   if (!databaseUrl) {
      console.error("DATABASE_URL environment variable is required");
      process.exit(1);
   }

   const db = createDb({ databaseUrl });

   try {
      await seedAutomationTemplates(db);
      console.log("\nAll seeds completed successfully!");
      process.exit(0);
   } catch (error) {
      console.error("\nSeed failed:", error);
      process.exit(1);
   }
}

main();
