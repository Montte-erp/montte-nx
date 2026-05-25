import { Octokit } from "@octokit/core";
import { Result, TaggedError } from "better-result";
import { defineErrorCatalog } from "evlog";
import { readFile } from "node:fs/promises";
import * as v from "valibot";

export const agentUtilsErrors = defineErrorCatalog("flue.agent-utils", {
   MISSING_GITHUB_TOKEN: {
      status: 401,
      message: "Token do GitHub não configurado.",
      tags: ["flue", "agent-utils", "github"],
   },
   READ_CONTEXT_FAILED: {
      status: 500,
      message: "Falha ao ler contexto preparado do agente.",
      tags: ["flue", "agent-utils", "context"],
   },
   PUBLISH_COMMENT_FAILED: {
      status: 500,
      message: "Falha ao publicar comentário no GitHub.",
      tags: ["flue", "agent-utils", "github"],
   },
   INVALID_PROVIDER_ENV: {
      status: 500,
      message: "Ambiente de providers Flue inválido.",
      tags: ["flue", "agent-utils", "env"],
   },
});

declare module "evlog" {
   interface RegisteredErrorCatalogs {
      "flue.agent-utils": typeof agentUtilsErrors;
   }
}

type AgentUtilsCatalogError =
   | ReturnType<typeof agentUtilsErrors.MISSING_GITHUB_TOKEN>
   | ReturnType<typeof agentUtilsErrors.READ_CONTEXT_FAILED>
   | ReturnType<typeof agentUtilsErrors.PUBLISH_COMMENT_FAILED>
   | ReturnType<typeof agentUtilsErrors.INVALID_PROVIDER_ENV>;

export class AgentUtilsError extends TaggedError("AgentUtilsError")<{
   error: AgentUtilsCatalogError;
   message: string;
   repo?: string;
   prNumber?: number;
   filePath?: string;
   detail?: string;
}>() {}

export const safeRepoSchema = v.pipe(
   v.string(),
   v.regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u),
);

export const safePathSchema = v.pipe(
   v.string(),
   v.regex(/^(?:\.\/[\w./-]+|\.[\w./-]*|[\w][\w./-]*)$/u),
   v.check(
      (value) => !value.split("/").includes(".."),
      "path não pode conter segmentos '..'.",
   ),
);

function nonEmpty(value: unknown): string | undefined {
   return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function resolveEnv(
   env: Record<string, unknown>,
   key: string,
): string | undefined {
   return nonEmpty(env[key]) ?? nonEmpty(process.env[key]);
}

export function requireEnv(env: Record<string, unknown>, key: string) {
   const value = resolveEnv(env, key);
   if (value) return Result.ok(value);

   return Result.err(
      new AgentUtilsError({
         error: agentUtilsErrors.INVALID_PROVIDER_ENV(),
         message: `${key} não configurada.`,
      }),
   );
}

export function formatCause(cause: unknown) {
   if (cause instanceof Error) return cause.stack ?? cause.message;
   if (typeof cause === "string") return cause;

   const jsonResult = Result.try({
      try: () => JSON.stringify(cause),
      catch: () => undefined,
   });

   return Result.isOk(jsonResult) && jsonResult.value
      ? jsonResult.value
      : String(cause);
}

function isDefinedEnvEntry(
   entry: [string, string | undefined],
): entry is [string, string] {
   return typeof entry[1] === "string" && entry[1].length > 0;
}

export function buildLocalSandboxEnv(
   values: Record<string, string | undefined>,
) {
   return Object.fromEntries(Object.entries(values).filter(isDefinedEnvEntry));
}

export function truncateForPrompt(
   value: string,
   maxChars: number,
   label: string,
) {
   if (value.length <= maxChars) return value;

   return `${value.slice(0, maxChars)}\n\n[${label} truncado: ${value.length} caracteres totais; exibindo primeiros ${maxChars}. Consulte o artefato completo para validação.]`;
}

export async function readPreparedContext(
   filePath: string,
   failureMessage: string,
) {
   return Result.tryPromise({
      try: async () => ({
         stdout: await readFile(filePath, "utf8"),
         stderr: "",
         exitCode: 0,
      }),
      catch: (cause) =>
         new AgentUtilsError({
            error: agentUtilsErrors.READ_CONTEXT_FAILED(),
            message: failureMessage,
            filePath,
            detail: formatCause(cause),
         }),
   });
}

export function resolveGithubToken(env: Record<string, unknown>) {
   const envGhToken =
      typeof env.GH_TOKEN === "string" ? env.GH_TOKEN : undefined;
   const envGithubToken =
      typeof env.GITHUB_TOKEN === "string" ? env.GITHUB_TOKEN : undefined;

   return (
      envGhToken ??
      envGithubToken ??
      process.env.GH_TOKEN ??
      process.env.GITHUB_TOKEN
   );
}

export async function publishIssueComment({
   repo,
   prNumber,
   body,
   token,
}: {
   repo: string;
   prNumber: number;
   body: string;
   token: string | undefined;
}) {
   if (!token) {
      return Result.err(
         new AgentUtilsError({
            error: agentUtilsErrors.MISSING_GITHUB_TOKEN(),
            message: "GH_TOKEN não configurado no ambiente.",
            repo,
            prNumber,
         }),
      );
   }

   const [owner, repoName] = repo.split("/");
   const octokit = new Octokit({ auth: token });
   return Result.tryPromise({
      try: async () => {
         await octokit.request(
            "POST /repos/{owner}/{repo}/issues/{num}/comments",
            {
               owner,
               repo: repoName,
               num: prNumber,
               body,
            },
         );
      },
      catch: (cause) =>
         new AgentUtilsError({
            error: agentUtilsErrors.PUBLISH_COMMENT_FAILED(),
            message: "Falha ao publicar comentário no GitHub.",
            repo,
            prNumber,
            detail: formatCause(cause),
         }),
   });
}
