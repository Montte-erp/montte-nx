import type { CAC } from "cac";
import { requireConfig } from "../config";
import { createClient } from "../client";
import { printJson, printTable } from "../output";

export function registerCategoriesCommands(cli: CAC): void {
   cli.command("categories list", "List categories")
      .option("--json", "Output as JSON")
      .option("--type <type>", "Filter by type (income, expense)")
      .option("--archived", "Include archived categories")
      .action(
         async (options: {
            json?: boolean;
            type?: string;
            archived?: boolean;
         }) => {
            const config = requireConfig();
            const client = createClient(config.apiKey, config.host);
            const categories = await client.categories.list({
               type: options.type as any,
               includeArchived: options.archived,
            });
            if (options.json) return printJson(categories);
            printTable(
               categories.map((c) => ({
                  id: c.id,
                  name: c.name,
                  type: c.type,
                  level: c.level,
                  archived: c.isArchived ? "yes" : "no",
               })),
            );
         },
      );

   cli.command("categories create", "Create a category")
      .option("--name <name>", "Category name", { required: true })
      .option("--type <type>", "Type (income, expense)", { required: true })
      .option("--parent <id>", "Parent category ID")
      .option("--color <color>", "Color hex")
      .option("--json", "Output as JSON")
      .action(
         async (options: {
            name: string;
            type: string;
            parent?: string;
            color?: string;
            json?: boolean;
         }) => {
            const config = requireConfig();
            const client = createClient(config.apiKey, config.host);
            const category = await client.categories.create({
               name: options.name,
               type: options.type as any,
               parentId: options.parent,
               color: options.color,
            });
            if (options.json) return printJson(category);
            console.log(`Created category: ${category.name} (${category.id})`);
         },
      );

   cli.command("categories remove <id>", "Delete a category").action(
      async (id: string) => {
         const config = requireConfig();
         const client = createClient(config.apiKey, config.host);
         await client.categories.remove({ id });
         console.log("Category deleted.");
      },
   );

   cli.command("categories archive <id>", "Archive a category")
      .option("--json", "Output as JSON")
      .action(async (id: string, options: { json?: boolean }) => {
         const config = requireConfig();
         const client = createClient(config.apiKey, config.host);
         const category = await client.categories.archive({ id });
         if (options.json) return printJson(category);
         console.log(`Archived: ${category.name}`);
      });
}
