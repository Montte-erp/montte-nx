import type { FlueContext } from "@flue/runtime";
import { local } from "@flue/runtime/node";
import { Result, TaggedError } from "better-result";
import { defineErrorCatalog } from "evlog";
import { readFile, rm, writeFile } from "node:fs/promises";
import * as v from "valibot";
import { formatCause } from "../lib/agent-utils.ts";
import { DEFAULT_FLUE_MODEL } from "../lib/model.ts";

export const triggers = {};

const releasePayloadSchema = v.object({
   releaseVersion: v.pipe(v.string(), v.minLength(1)),
   changesFile: v.optional(v.string(), "changes.md"),
   skillFile: v.optional(v.string(), ".agents/skills/release/SKILL.md"),
   releaseNotesReference: v.optional(
      v.string(),
      ".agents/skills/release/references/release-notes.md",
   ),
   automatedReleaseNotesReference: v.optional(
      v.string(),
      ".agents/skills/release/references/automated-release-notes.md",
   ),
   validationReference: v.optional(
      v.string(),
      ".agents/skills/release/references/release-validation.md",
   ),
   outputFile: v.optional(v.string(), "RELEASE_NOTES.md"),
   validationFile: v.optional(v.string(), "validation.json"),
});

const releaseNotesGenerationSchema = v.object({
   markdown: v.pipe(v.string(), v.minLength(1)),
});

const releaseNotesValidationSchema = v.object({
   valid: v.boolean(),
   errors: v.array(v.string()),
   warnings: v.array(v.string()),
});

const releaseNotesAgentErrors = defineErrorCatalog("flue.release-notes.agent", {
   BAD_PAYLOAD: {
      status: 400,
      message: "Payload inválido para agente de release notes.",
      tags: ["flue", "release-notes"],
   },
   IO_FAILED: {
      status: 500,
      message: "Falha de IO no agente de release notes.",
      tags: ["flue", "release-notes"],
   },
   MODEL_FAILED: {
      status: 500,
      message: "Falha ao executar modelo de release notes.",
      tags: ["flue", "release-notes"],
   },
   VALIDATION_FAILED: {
      status: 422,
      message: "Release notes falharam na validação estruturada.",
      tags: ["flue", "release-notes"],
   },
});

declare module "evlog" {
   interface RegisteredErrorCatalogs {
      "flue.release-notes.agent": typeof releaseNotesAgentErrors;
   }
}

type ReleaseNotesAgentCatalogError =
   | ReturnType<typeof releaseNotesAgentErrors.BAD_PAYLOAD>
   | ReturnType<typeof releaseNotesAgentErrors.IO_FAILED>
   | ReturnType<typeof releaseNotesAgentErrors.MODEL_FAILED>
   | ReturnType<typeof releaseNotesAgentErrors.VALIDATION_FAILED>;

class ReleaseNotesAgentError extends TaggedError("ReleaseNotesAgentError")<{
   error: ReleaseNotesAgentCatalogError;
   message: string;
   releaseVersion?: string;
   outputFile?: string;
   detail?: string;
}>() {}

function validateReleaseNotes(markdown: string) {
   const errors: string[] = [];
   const warnings: string[] = [];

   if (markdown.length === 0) errors.push("Release notes vazias.");
   if (
      /(^|[^\p{L}\p{N}_])TODO([^\p{L}\p{N}_]|$)|!\[Demo\]|\(TODO|link se existir|senão TODO/iu.test(
         markdown,
      )
   ) {
      errors.push("Release notes contêm placeholder/TODO.");
   }
   if (/^# +Montte /u.test(markdown.split("\n")[0] ?? "")) {
      errors.push("Release notes repetem o título da GitHub Release no corpo.");
   }
   if (/\b(schema|router|oRPC|Drizzle|DBOS)\b/u.test(markdown)) {
      warnings.push(
         "Corpo pode conter detalhe técnico interno; revisar antes de publicar.",
      );
   }

   return {
      valid: errors.length === 0,
      errors,
      warnings,
   };
}

export default async function ({ init, payload }: FlueContext) {
   const parsedPayload = v.safeParse(releasePayloadSchema, payload);
   if (!parsedPayload.success) {
      throw new ReleaseNotesAgentError({
         error: releaseNotesAgentErrors.BAD_PAYLOAD(),
         message: "Payload inválido para agente de release notes.",
         detail: formatCause(parsedPayload.issues),
      });
   }

   const {
      releaseVersion,
      changesFile,
      skillFile,
      releaseNotesReference,
      automatedReleaseNotesReference,
      validationReference,
      outputFile,
      validationFile,
   } = parsedPayload.output;

   const initResult = await Result.tryPromise({
      try: () =>
         init({
            // local() lets Flue discover AGENTS.md and .agents/skills from cwd.
            // GitHub tokens are intentionally not exposed to the sandbox env.
            sandbox: local({ env: {} }),
            model: process.env.FLUE_MODEL ?? DEFAULT_FLUE_MODEL,
         }),
      catch: (cause) =>
         new ReleaseNotesAgentError({
            error: releaseNotesAgentErrors.MODEL_FAILED(),
            message: "Falha ao inicializar Flue para release notes.",
            releaseVersion,
            detail: formatCause(cause),
         }),
   });
   if (Result.isError(initResult)) throw initResult.error;

   const filesResult = await Result.tryPromise({
      try: async () => ({
         changes: await readFile(changesFile, "utf8"),
         skill: await readFile(skillFile, "utf8"),
         releaseNotes: await readFile(releaseNotesReference, "utf8"),
         automatedReleaseNotes: await readFile(
            automatedReleaseNotesReference,
            "utf8",
         ),
         validation: await readFile(validationReference, "utf8"),
      }),
      catch: (cause) =>
         new ReleaseNotesAgentError({
            error: releaseNotesAgentErrors.IO_FAILED(),
            message: "Falha ao carregar arquivos de contexto da release.",
            releaseVersion,
            detail: formatCause(cause),
         }),
   });
   if (Result.isError(filesResult)) throw filesResult.error;

   const { changes, skill, releaseNotes, automatedReleaseNotes, validation } =
      filesResult.value;

   await Result.tryPromise({
      try: () => rm(outputFile, { force: true }),
      catch: () => undefined,
   });
   await Result.tryPromise({
      try: () => rm(validationFile, { force: true }),
      catch: () => undefined,
   });

   const task = `Gere as release notes da versão ${releaseVersion} em Markdown, em pt-BR, sem inventar links, números ou funcionalidades.

Retorne o Markdown final no campo estruturado markdown. Não coloque checklist, explicações, validações executadas ou resumo operacional no campo markdown. Não use fences.

Regras da skill de release:

${skill}

Referência release-notes.md:

${releaseNotes}

Referência automated-release-notes.md:

${automatedReleaseNotes}

Referência release-validation.md:

${validation}

Mudanças normalizadas:

${changes}`;

   const harness = initResult.value;
   const sessionResult = await Result.tryPromise({
      try: () => harness.session(),
      catch: (cause) =>
         new ReleaseNotesAgentError({
            error: releaseNotesAgentErrors.MODEL_FAILED(),
            message: "Falha ao abrir sessão Flue para release notes.",
            releaseVersion,
            detail: formatCause(cause),
         }),
   });
   if (Result.isError(sessionResult)) throw sessionResult.error;

   const outputResult = await Result.tryPromise({
      try: () =>
         Promise.resolve(
            sessionResult.value.skill("release", {
               args: { task, releaseVersion, changes },
               result: releaseNotesGenerationSchema,
               thinkingLevel: "off",
            }),
         ),
      catch: (cause) =>
         new ReleaseNotesAgentError({
            error: releaseNotesAgentErrors.MODEL_FAILED(),
            message: "Falha ao executar prompt de release notes via Flue.",
            releaseVersion,
            detail: formatCause(cause),
         }),
   });
   if (Result.isError(outputResult)) throw outputResult.error;

   const structuredMarkdown = outputResult.value.data.markdown.trim();
   const markdown = structuredMarkdown;

   const writeResult = await Result.tryPromise({
      try: () => writeFile(outputFile, markdown),
      catch: (cause) =>
         new ReleaseNotesAgentError({
            error: releaseNotesAgentErrors.IO_FAILED(),
            message: "Falha ao escrever RELEASE_NOTES.md.",
            releaseVersion,
            outputFile,
            detail: formatCause(cause),
         }),
   });
   if (Result.isError(writeResult)) throw writeResult.error;

   const validation = v.parse(
      releaseNotesValidationSchema,
      validateReleaseNotes(markdown),
   );
   const validationWriteResult = await Result.tryPromise({
      try: () => writeFile(validationFile, JSON.stringify(validation, null, 2)),
      catch: (cause) =>
         new ReleaseNotesAgentError({
            error: releaseNotesAgentErrors.IO_FAILED(),
            message: "Falha ao escrever artefato de validação da release.",
            releaseVersion,
            outputFile: validationFile,
            detail: formatCause(cause),
         }),
   });
   if (Result.isError(validationWriteResult)) throw validationWriteResult.error;

   if (!validation.valid) {
      throw new ReleaseNotesAgentError({
         error: releaseNotesAgentErrors.VALIDATION_FAILED(),
         message: "Release notes falharam na validação estruturada.",
         releaseVersion,
         outputFile,
         detail: validation.errors.join("\n"),
      });
   }

   return {
      outputFile,
      validationFile,
      releaseVersion,
      generated: true,
   };
}
