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

const envStringSchema = v.pipe(v.string(), v.minLength(1));

export const flueProviderEnvSchema = v.object({
   OPENCODE_API_KEY: v.optional(envStringSchema),
   OPENCODE_GO_BASE_URL: v.optional(v.pipe(envStringSchema, v.url())),
   OPENCODE_GO_GATEWAY_KEY: v.optional(envStringSchema),
});

export type FlueProviderEnv = v.InferOutput<typeof flueProviderEnvSchema>;

export function validateFlueProviderEnv(env: Record<string, unknown>) {
   const parsed = v.safeParse(flueProviderEnvSchema, {
      OPENCODE_API_KEY: env.OPENCODE_API_KEY ?? process.env.OPENCODE_API_KEY,
      OPENCODE_GO_BASE_URL:
         env.OPENCODE_GO_BASE_URL ?? process.env.OPENCODE_GO_BASE_URL,
      OPENCODE_GO_GATEWAY_KEY:
         env.OPENCODE_GO_GATEWAY_KEY ?? process.env.OPENCODE_GO_GATEWAY_KEY,
   });

   if (parsed.success) return Result.ok(parsed.output);

   return Result.err(
      new AgentUtilsError({
         error: agentUtilsErrors.INVALID_PROVIDER_ENV(),
         message: "Ambiente de providers Flue inválido.",
         detail: formatCause(parsed.issues),
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
