import type { FlueContext } from "@flue/runtime";
import { local } from "@flue/runtime/node";
import { Result, TaggedError } from "better-result";
import { readFile, writeFile } from "node:fs/promises";
import { z } from "zod";
import { runOpenCodeGo } from "../lib/opencode-go.ts";

export const triggers = {};

const releasePayloadSchema = z.object({
   releaseVersion: z.string(),
   changesFile: z.string().default("changes.md"),
   skillFile: z.string().default(".agents/skills/release/SKILL.md"),
   releaseNotesReference: z
      .string()
      .default(".agents/skills/release/references/release-notes.md"),
   validationReference: z
      .string()
      .default(".agents/skills/release/references/release-validation.md"),
   outputFile: z.string().default("RELEASE_NOTES.md"),
});

class ReleaseNotesAgentError extends TaggedError("ReleaseNotesAgentError")<{
   message: string;
   cause?: unknown;
}>() {}

export default async function ({ init, payload }: FlueContext) {
   const parsedPayload = releasePayloadSchema.safeParse(payload);
   if (!parsedPayload.success) {
      throw new ReleaseNotesAgentError({
         message: "Payload inválido para agente de release notes.",
         cause: parsedPayload.error,
      });
   }

   const {
      releaseVersion,
      changesFile,
      skillFile,
      releaseNotesReference,
      validationReference,
      outputFile,
   } = parsedPayload.data;

   const initResult = await Result.tryPromise({
      try: () =>
         init({
            sandbox: local({
               env: {
                  OPENCODE_API_KEY: process.env.OPENCODE_API_KEY,
               },
            }),
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

## Diretrizes de validação
${validationReferenceContent}

Agora gere as release notes da versão ${releaseVersion} em Markdown (sem inventar links, números ou funcionalidades).

Arquivo de mudanças:
${changes}

Saida deve ser escrita em pt-BR e obedecer à estrutura esperada pelo arquivo de referência de release notes.
Retorne somente o Markdown do corpo da release, sem fences e sem explicações externas.
`.trim();

   const output = await runOpenCodeGo(prompt);
   if (Result.isError(output)) throw output.error;

   const writeResult = await Result.tryPromise({
      try: () => writeFile(outputFile, output.value),
      catch: (cause) =>
         new ReleaseNotesAgentError({
            message: "Falha ao escrever RELEASE_NOTES.md.",
            cause,
         }),
   });
   if (Result.isError(writeResult)) throw writeResult.error;

   return {
      outputFile,
      releaseVersion,
      generated: true,
   };
}
