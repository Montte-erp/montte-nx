import type { FlueContext } from "@flue/runtime";
import { Result, TaggedError } from "better-result";
import { readFile, writeFile } from "node:fs/promises";
import * as v from "valibot";
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

const releaseNotesValidationSchema = v.object({
   valid: v.boolean(),
   errors: v.array(v.string()),
   warnings: v.array(v.string()),
});

class ReleaseNotesAgentError extends TaggedError("ReleaseNotesAgentError")<{
   message: string;
   cause?: unknown;
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
         message: "Payload inválido para agente de release notes.",
         cause: parsedPayload.issues,
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
            sandbox: false,
            model: process.env.FLUE_MODEL ?? DEFAULT_FLUE_MODEL,
         }),
      catch: (cause) =>
         new ReleaseNotesAgentError({
            message: "Falha ao inicializar Flue para release notes.",
            cause,
         }),
   });
   if (Result.isError(initResult)) throw initResult.error;

   const filesResult = await Result.tryPromise({
      try: () =>
         Promise.all([
            readFile("AGENTS.md", "utf8"),
            readFile(changesFile, "utf8"),
            readFile(skillFile, "utf8"),
            readFile(releaseNotesReference, "utf8"),
            readFile(automatedReleaseNotesReference, "utf8"),
            readFile(validationReference, "utf8"),
         ]),
      catch: (cause) =>
         new ReleaseNotesAgentError({
            message:
               "Falha ao carregar AGENTS.md, skill ou referências de release.",
            cause,
         }),
   });
   if (Result.isError(filesResult)) throw filesResult.error;

   const [
      agentInstructions,
      changes,
      skillInstruction,
      notesReference,
      automatedReleaseNotesReferenceContent,
      validationReferenceContent,
   ] = filesResult.value;

   const prompt = `
Você está rodando dentro de um agente Flue no repositório Montte.
Siga obrigatoriamente o AGENTS.md e a skill carregada abaixo.

AGENTS.md:
${agentInstructions}

Skill de release:
${skillInstruction}

Leia também estes arquivos de referência:

## Estrutura da release notes
${notesReference}

## Automação de release notes
${automatedReleaseNotesReferenceContent}

## Diretrizes de validação
${validationReferenceContent}

Agora gere as release notes da versão ${releaseVersion} em Markdown (sem inventar links, números ou funcionalidades).

Arquivo de mudanças:
${changes}

Saida deve ser escrita em pt-BR e obedecer à estrutura esperada pelo arquivo de referência de release notes.
Retorne somente o Markdown do corpo da release, sem fences e sem explicações externas.
`.trim();

   const harness = initResult.value;
   const sessionResult = await Result.tryPromise({
      try: () => harness.session(),
      catch: (cause) =>
         new ReleaseNotesAgentError({
            message: "Falha ao abrir sessão Flue para release notes.",
            cause,
         }),
   });
   if (Result.isError(sessionResult)) throw sessionResult.error;

   const outputResult = await Result.tryPromise({
      try: () =>
         Promise.resolve(
            sessionResult.value.prompt(prompt, { thinkingLevel: "off" }),
         ),
      catch: (cause) =>
         new ReleaseNotesAgentError({
            message: "Falha ao executar prompt de release notes via Flue.",
            cause,
         }),
   });
   if (Result.isError(outputResult)) throw outputResult.error;

   const markdown = outputResult.value.text.trim();

   const writeResult = await Result.tryPromise({
      try: () => writeFile(outputFile, markdown),
      catch: (cause) =>
         new ReleaseNotesAgentError({
            message: "Falha ao escrever RELEASE_NOTES.md.",
            cause,
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
            message: "Falha ao escrever artefato de validação da release.",
            cause,
         }),
   });
   if (Result.isError(validationWriteResult)) throw validationWriteResult.error;

   if (!validation.valid) {
      throw new ReleaseNotesAgentError({
         message: "Release notes falharam na validação estruturada.",
         cause: validation.errors,
      });
   }

   return {
      outputFile,
      validationFile,
      releaseVersion,
      generated: true,
   };
}
