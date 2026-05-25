import type { FlueContext } from "@flue/runtime";
import { local } from "@flue/runtime/node";
import { Result, TaggedError } from "better-result";
import { defineErrorCatalog } from "evlog";
import { execFile } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import * as v from "valibot";
import {
   buildLocalSandboxEnv,
   formatCause,
   resolveGithubToken,
   safePathSchema,
   truncateForPrompt,
} from "../lib/agent-utils.ts";
import { DEFAULT_FLUE_MODEL } from "../lib/model.ts";

export const triggers = {};

const execFileAsync = promisify(execFile);

const docsRefreshPayloadSchema = v.object({
   mode: v.optional(v.picklist(["weekly", "manual"]), "manual"),
   target: v.optional(v.picklist(["landing-docs"]), "landing-docs"),
   outputDir: v.optional(safePathSchema, "apps/landing/src/content/docs"),
   llmsFile: v.optional(safePathSchema, "docs/llms.txt"),
   contextFile: v.optional(
      safePathSchema,
      ".agent-artifacts/docs-refresh/documentation-context.md",
   ),
   maxContextChars: v.optional(
      v.pipe(v.number(), v.integer(), v.minValue(20_000), v.maxValue(200_000)),
      80_000,
   ),
   dryRun: v.optional(v.boolean(), false),
});

const generatedPageSchema = v.object({
   path: v.pipe(v.string(), v.minLength(1)),
   status: v.picklist(["created", "updated", "unchanged"]),
   summary: v.pipe(v.string(), v.minLength(1)),
});

const docsRefreshResultSchema = v.object({
   summary: v.pipe(v.string(), v.minLength(1)),
   pages: v.optional(v.array(generatedPageSchema), []),
   gaps: v.optional(v.array(v.string()), []),
   validationNotes: v.optional(v.array(v.string()), []),
});

const docsRefreshValidationSchema = v.object({
   valid: v.boolean(),
   errors: v.array(v.string()),
   warnings: v.array(v.string()),
});

const docsRefreshAgentErrors = defineErrorCatalog("flue.docs-refresh.agent", {
   BAD_PAYLOAD: {
      status: 400,
      message: "Payload inválido para agente de documentação pública.",
      tags: ["flue", "docs-refresh"],
   },
   IO_FAILED: {
      status: 500,
      message: "Falha de IO no agente de documentação pública.",
      tags: ["flue", "docs-refresh"],
   },
   MODEL_FAILED: {
      status: 500,
      message: "Falha ao executar modelo de documentação pública.",
      tags: ["flue", "docs-refresh"],
   },
   VALIDATION_FAILED: {
      status: 422,
      message: "Documentação pública falhou na validação estruturada.",
      tags: ["flue", "docs-refresh"],
   },
});

declare module "evlog" {
   interface RegisteredErrorCatalogs {
      "flue.docs-refresh.agent": typeof docsRefreshAgentErrors;
   }
}

type DocsRefreshAgentCatalogError =
   | ReturnType<typeof docsRefreshAgentErrors.BAD_PAYLOAD>
   | ReturnType<typeof docsRefreshAgentErrors.IO_FAILED>
   | ReturnType<typeof docsRefreshAgentErrors.MODEL_FAILED>
   | ReturnType<typeof docsRefreshAgentErrors.VALIDATION_FAILED>;

class DocsRefreshAgentError extends TaggedError("DocsRefreshAgentError")<{
   error: DocsRefreshAgentCatalogError;
   message: string;
   outputFile?: string;
   detail?: string;
}>() {}

type CommandSpec = {
   title: string;
   command: string;
   args: string[];
   maxChars: number;
};

async function collectCommandSection(spec: CommandSpec) {
   const result = await Result.tryPromise({
      try: () => execFileAsync(spec.command, spec.args, { cwd: process.cwd() }),
      catch: (cause) => formatCause(cause),
   });

   if (Result.isError(result)) {
      return `## ${spec.title}\n\nUnavailable: ${result.error}\n`;
   }

   const stdout = truncateForPrompt(
      result.value.stdout.trim(),
      spec.maxChars,
      spec.title,
   );
   const stderr = result.value.stderr.trim();
   const stderrBlock =
      stderr.length > 0 ? `\n\nStderr:\n\n\`\`\`text\n${stderr}\n\`\`\`` : "";

   return `## ${spec.title}\n\n\`\`\`text\n${stdout}\n\`\`\`${stderrBlock}\n`;
}

async function collectOptionalGithubSection(githubToken: string | undefined) {
   if (!githubToken) {
      return "## Recently merged PRs\n\nUnavailable: GH_TOKEN/GITHUB_TOKEN not configured.\n";
   }

   const result = await Result.tryPromise({
      try: () =>
         execFileAsync(
            "gh",
            [
               "pr",
               "list",
               "--state",
               "merged",
               "--limit",
               "40",
               "--json",
               "number,title,url,mergedAt,labels",
            ],
            {
               cwd: process.cwd(),
               env: { ...process.env, GH_TOKEN: githubToken },
            },
         ),
      catch: (cause) => formatCause(cause),
   });

   if (Result.isError(result)) {
      return `## Recently merged PRs\n\nUnavailable: ${result.error}\n`;
   }

   return `## Recently merged PRs\n\n\`\`\`json\n${truncateForPrompt(
      result.value.stdout.trim(),
      30_000,
      "recently merged PRs",
   )}\n\`\`\`\n`;
}

async function collectDocumentationContext({
   contextFile,
   outputDir,
   llmsFile,
   githubToken,
}: {
   contextFile: string;
   outputDir: string;
   llmsFile: string;
   githubToken: string | undefined;
}) {
   const specs: CommandSpec[] = [
      {
         title: "Current ref",
         command: "git",
         args: ["rev-parse", "--short", "HEAD"],
         maxChars: 2_000,
      },
      {
         title: "Current branch",
         command: "git",
         args: ["branch", "--show-current"],
         maxChars: 2_000,
      },
      {
         title: "Latest tags",
         command: "git",
         args: ["tag", "--sort=-version:refname"],
         maxChars: 10_000,
      },
      {
         title: "Top-level structure",
         command: "git",
         args: ["ls-tree", "-d", "--name-only", "HEAD"],
         maxChars: 10_000,
      },
      {
         title: "Relevant package and config files",
         command: "bash",
         args: [
            "-lc",
            "git ls-files | grep -E '(^package.json$|/package.json$|^nx.json$|tsconfig.*json$|astro.config.mjs$|content.config.ts$|project.json$|wrangler.jsonc$|^AGENTS.md$|^README.md$)' | head -n 300",
         ],
         maxChars: 30_000,
      },
      {
         title: "Flue agents, skills and app files",
         command: "bash",
         args: [
            "-lc",
            "git ls-files .flue .agents/skills AGENTS.md README.md | head -n 400",
         ],
         maxChars: 40_000,
      },
      {
         title: "Landing docs and content files",
         command: "bash",
         args: [
            "-lc",
            `git ls-files apps/landing/src/content apps/landing/src/pages apps/landing/src/components ${outputDir} ${llmsFile} | head -n 500`,
         ],
         maxChars: 50_000,
      },
      {
         title: "Changed files in working tree",
         command: "git",
         args: ["status", "--short"],
         maxChars: 20_000,
      },
      {
         title: "Recent commits",
         command: "git",
         args: ["log", "--pretty=format:- %s (%h)", "-n", "80"],
         maxChars: 30_000,
      },
      {
         title: "Existing docs skill files",
         command: "bash",
         args: ["-lc", "find .agents/skills -maxdepth 3 -type f | sort"],
         maxChars: 40_000,
      },
   ];

   const sections: string[] = [];
   sections.push("# Montte public docs refresh context");
   sections.push("");
   sections.push(`- outputDir: ${outputDir}`);
   sections.push(`- llmsFile: ${llmsFile}`);
   sections.push("- public surface: landing /docs");
   sections.push("- AI consumer: Montte AI");
   sections.push("");

   for (const spec of specs) {
      sections.push(await collectCommandSection(spec));
   }

   sections.push(await collectOptionalGithubSection(githubToken));

   const markdown = sections.join("\n");
   const mkdirResult = await Result.tryPromise({
      try: () => mkdir(dirname(contextFile), { recursive: true }),
      catch: (cause) =>
         new DocsRefreshAgentError({
            error: docsRefreshAgentErrors.IO_FAILED(),
            message: "Falha ao criar diretório do contexto de documentação.",
            outputFile: contextFile,
            detail: formatCause(cause),
         }),
   });
   if (Result.isError(mkdirResult)) return mkdirResult;

   const writeResult = await Result.tryPromise({
      try: () => writeFile(contextFile, markdown),
      catch: (cause) =>
         new DocsRefreshAgentError({
            error: docsRefreshAgentErrors.IO_FAILED(),
            message: "Falha ao escrever contexto de documentação.",
            outputFile: contextFile,
            detail: formatCause(cause),
         }),
   });
   if (Result.isError(writeResult)) return writeResult;

   return Result.ok(markdown);
}

async function listMarkdownFiles(dir: string) {
   const result = await Result.tryPromise({
      try: () => readdir(dir, { recursive: true, withFileTypes: true }),
      catch: (cause) =>
         new DocsRefreshAgentError({
            error: docsRefreshAgentErrors.IO_FAILED(),
            message: "Falha ao listar páginas geradas de documentação.",
            outputFile: dir,
            detail: formatCause(cause),
         }),
   });
   if (Result.isError(result)) return result;

   const files: string[] = [];
   for (const entry of result.value) {
      if (!entry.isFile()) continue;
      if (!entry.name.endsWith(".md") && !entry.name.endsWith(".mdx")) continue;

      files.push(join(entry.parentPath, entry.name));
   }

   return Result.ok(files.sort());
}

async function validateGeneratedDocs({
   outputDir,
   llmsFile,
}: {
   outputDir: string;
   llmsFile: string;
}) {
   const errors: string[] = [];
   const warnings: string[] = [];

   const filesResult = await listMarkdownFiles(outputDir);
   if (Result.isError(filesResult)) return filesResult;

   if (filesResult.value.length === 0) {
      errors.push(`Nenhuma página Markdown/MDX encontrada em ${outputDir}.`);
   }

   const llmsResult = await Result.tryPromise({
      try: () => readFile(llmsFile, "utf8"),
      catch: (cause) =>
         new DocsRefreshAgentError({
            error: docsRefreshAgentErrors.IO_FAILED(),
            message: "Falha ao ler índice LLM-readable de documentação.",
            outputFile: llmsFile,
            detail: formatCause(cause),
         }),
   });
   if (Result.isError(llmsResult)) return llmsResult;

   if (llmsResult.value.trim().length === 0) {
      errors.push(`${llmsFile} está vazio.`);
   }

   const scannedFiles = [...filesResult.value, llmsFile];
   for (const file of scannedFiles) {
      const readResult = await Result.tryPromise({
         try: () => readFile(file, "utf8"),
         catch: (cause) =>
            new DocsRefreshAgentError({
               error: docsRefreshAgentErrors.IO_FAILED(),
               message: "Falha ao ler arquivo de documentação gerado.",
               outputFile: file,
               detail: formatCause(cause),
            }),
      });
      if (Result.isError(readResult)) return readResult;

      if (
         /TODO|CHANGE_ME|INSERT_|not implemented yet/iu.test(readResult.value)
      ) {
         warnings.push(`${file} contém possível placeholder.`);
      }
      if (
         /sk_live_|sk_test_|BEGIN PRIVATE KEY|GITHUB_TOKEN|OPENCODE_API_KEY/iu.test(
            readResult.value,
         )
      ) {
         errors.push(`${file} contém possível segredo ou nome de secret.`);
      }
   }

   return Result.ok(
      v.parse(docsRefreshValidationSchema, {
         valid: errors.length === 0,
         errors,
         warnings,
      }),
   );
}

export default async function ({ init, payload, env }: FlueContext) {
   const parsedPayload = v.safeParse(docsRefreshPayloadSchema, payload);
   if (!parsedPayload.success) {
      throw new DocsRefreshAgentError({
         error: docsRefreshAgentErrors.BAD_PAYLOAD(),
         message: "Payload inválido para agente de documentação pública.",
         detail: formatCause(parsedPayload.issues),
      });
   }

   const { mode, outputDir, llmsFile, contextFile, maxContextChars, dryRun } =
      parsedPayload.output;
   const githubToken = resolveGithubToken(env);

   const dirsResult = await Result.tryPromise({
      try: () =>
         Promise.all([
            mkdir(outputDir, { recursive: true }),
            mkdir(dirname(llmsFile), { recursive: true }),
         ]),
      catch: (cause) =>
         new DocsRefreshAgentError({
            error: docsRefreshAgentErrors.IO_FAILED(),
            message: "Falha ao preparar diretórios de documentação pública.",
            detail: formatCause(cause),
         }),
   });
   if (Result.isError(dirsResult)) throw dirsResult.error;

   const contextResult = await collectDocumentationContext({
      contextFile,
      outputDir,
      llmsFile,
      githubToken,
   });
   if (Result.isError(contextResult)) throw contextResult.error;

   const initResult = await Result.tryPromise({
      try: () =>
         init({
            sandbox: local({
               env: buildLocalSandboxEnv({
                  GH_TOKEN: githubToken,
                  GITHUB_REPOSITORY: process.env.GITHUB_REPOSITORY,
               }),
            }),
            model: process.env.FLUE_MODEL ?? DEFAULT_FLUE_MODEL,
         }),
      catch: (cause) =>
         new DocsRefreshAgentError({
            error: docsRefreshAgentErrors.MODEL_FAILED(),
            message: "Falha ao inicializar Flue para documentação pública.",
            detail: formatCause(cause),
         }),
   });
   if (Result.isError(initResult)) throw initResult.error;

   const sessionResult = await Result.tryPromise({
      try: () => initResult.value.session(),
      catch: (cause) =>
         new DocsRefreshAgentError({
            error: docsRefreshAgentErrors.MODEL_FAILED(),
            message: "Falha ao abrir sessão Flue para documentação pública.",
            detail: formatCause(cause),
         }),
   });
   if (Result.isError(sessionResult)) throw sessionResult.error;

   const task = `Update the public Montte documentation for landing /docs.

Mode: ${mode}
Output directory: ${outputDir}
LLM index file: ${llmsFile}
Context file: ${contextFile}
Dry run: ${dryRun ? "yes" : "no"}

Use the public-docs skill and its references. Write in pt-BR. The docs have two consumers: humans reading /docs and Montte AI using the same content as grounding. Keep pages beginner-friendly at the start, production-useful by the end, and safe for AI retrieval.

Read the collected context below. Use only confirmed facts from the context and files you inspect. Do not publish private CI metadata or secrets. Write only inside ${outputDir} and ${llmsFile}. Do not write raw context into public docs.

Collected context:

${truncateForPrompt(contextResult.value, maxContextChars, "documentation context")}`;

   const generationResult = await Result.tryPromise({
      try: () =>
         Promise.resolve(
            sessionResult.value.skill("public-docs", {
               args: {
                  task,
                  contextFile,
                  outputDir,
                  llmsFile,
                  dryRun,
               },
               result: docsRefreshResultSchema,
               thinkingLevel: "off",
            }),
         ),
      catch: (cause) =>
         new DocsRefreshAgentError({
            error: docsRefreshAgentErrors.MODEL_FAILED(),
            message: "Falha ao gerar documentação pública via Flue.",
            detail: formatCause(cause),
         }),
   });
   if (Result.isError(generationResult)) throw generationResult.error;

   if (dryRun) {
      return {
         contextFile,
         outputDir,
         llmsFile,
         dryRun,
         result: generationResult.value.data,
      };
   }

   const validationResult = await validateGeneratedDocs({
      outputDir,
      llmsFile,
   });
   if (Result.isError(validationResult)) throw validationResult.error;

   if (!validationResult.value.valid) {
      throw new DocsRefreshAgentError({
         error: docsRefreshAgentErrors.VALIDATION_FAILED(),
         message: "Documentação pública falhou na validação estruturada.",
         detail: validationResult.value.errors.join("\n"),
      });
   }

   return {
      contextFile,
      outputDir,
      llmsFile,
      dryRun,
      result: generationResult.value.data,
      validation: validationResult.value,
   };
}
