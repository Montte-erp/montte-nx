import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { Command } from "commander";
import { createJiti } from "jiti";
import { generateDDL } from "../core/ddl";
import type { HyprPayInstance } from "../index";

const program = new Command();

program
   .name("hyprpay")
   .description("HyprPay CLI — generate and apply payment schemas.")
   .version("0.1.0");

program
   .command("generate")
   .description("Generate SQL DDL for the configured HyprPay schemas.")
   .requiredOption(
      "-c, --config <path>",
      "Path to the file that exports the HyprPay instance.",
   )
   .option(
      "-e, --export <name>",
      "Named export of the HyprPay instance.",
      "payments",
   )
   .option("-o, --output <path>", "Write SQL to this file instead of stdout.")
   .action(
      async (opts: { config: string; export: string; output?: string }) => {
         const instance = await loadInstance(opts.config, opts.export);
         const stmts = generateDDL(instance.schema);
         const sql = `${stmts.join("\n\n")}\n`;
         if (opts.output) {
            const target = resolve(process.cwd(), opts.output);
            await mkdir(dirname(target), { recursive: true });
            await writeFile(target, sql, "utf8");
            console.log(`Wrote ${target}`);
            return;
         }
         process.stdout.write(sql);
      },
   );

program
   .command("migrate")
   .description("Apply HyprPay migrations to the configured database.")
   .requiredOption(
      "-c, --config <path>",
      "Path to the file that exports the HyprPay instance.",
   )
   .option(
      "-e, --export <name>",
      "Named export of the HyprPay instance.",
      "payments",
   )
   .action(async (opts: { config: string; export: string }) => {
      const instance = await loadInstance(opts.config, opts.export);
      if (!instance.database.applyMigrations) {
         console.error(
            "Database adapter does not support applyMigrations. Use `generate` to emit SQL and apply it manually.",
         );
         process.exit(1);
      }
      await instance.database.applyMigrations(instance.schema);
      console.log("Migrations applied.");
   });

async function loadInstance(
   configPath: string,
   exportName: string,
): Promise<HyprPayInstance> {
   const absPath = resolve(process.cwd(), configPath);
   const jiti = createJiti(import.meta.url, { interopDefault: true });
   const mod = await jiti.import<Record<string, unknown>>(absPath);
   const candidate = mod[exportName];
   if (!candidate || typeof candidate !== "object") {
      console.error(
         `Export "${exportName}" not found in ${absPath}. Use --export to specify a different name.`,
      );
      process.exit(1);
   }
   const shape = candidate as { schema?: unknown; database?: unknown };
   if (!shape.schema || typeof shape.schema !== "object") {
      console.error(
         `Export "${exportName}" does not look like a HyprPay instance (missing .schema).`,
      );
      process.exit(1);
   }
   if (!shape.database || typeof shape.database !== "object") {
      console.error(
         `Export "${exportName}" is missing .database — was it created with hyprpay()?`,
      );
      process.exit(1);
   }
   return candidate as HyprPayInstance;
}

program.parseAsync(process.argv).catch((err: unknown) => {
   console.error(err);
   process.exit(1);
});
