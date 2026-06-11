import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createPromptsClient } from "@core/posthog/server";
import { config as loadDotenv } from "dotenv";

const webEnvDir = join(import.meta.dirname, "..", "..", "..", "apps", "web");
loadDotenv({ path: join(webEnvDir, ".env"), override: true, quiet: true });
loadDotenv({
   path: join(webEnvDir, ".env.local"),
   override: true,
   quiet: true,
});

// Eval/test processes may inject a localhost OpenRouter mock URL. Real evals must
// hit OpenRouter directly unless apps/web explicitly defines another URL.
if (!process.env.OPENROUTER_BASE_URL?.startsWith("https://")) {
   delete process.env.OPENROUTER_BASE_URL;
}

const { extractContractWithAi, initContractsExtractionContext } =
   await import("../src/extraction/contract-ai-extraction");

function requireEnv(name: string) {
   const value = process.env[name];
   if (!value)
      throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
   return value;
}

const fileNames = process.argv.slice(2);
if (fileNames.length === 0) throw new Error("Informe ao menos uma fixture.");

initContractsExtractionContext(
   createPromptsClient({
      personalApiKey: requireEnv("POSTHOG_PERSONAL_API_KEY"),
      projectApiKey: requireEnv("POSTHOG_KEY"),
      host: requireEnv("POSTHOG_HOST"),
   }),
);
requireEnv("OPENROUTER_API_KEY");

const fixtureDir = join(
   import.meta.dirname,
   "..",
   "__tests__",
   "fixtures",
   "contracts",
);

const files = await Promise.all(
   fileNames.map(async (fileName) => {
      const mimeType = fileName.endsWith(".pdf")
         ? "application/pdf"
         : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      const file = await readFile(join(fixtureDir, fileName));

      return {
         fileName,
         mimeType,
         dataBase64: file.toString("base64"),
      };
   }),
);

const output = await extractContractWithAi({ files });

process.stdout.write(JSON.stringify(output));
