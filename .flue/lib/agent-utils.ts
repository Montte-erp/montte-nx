import { Octokit } from "@octokit/core";
import { Result } from "better-result";
import { readFile } from "node:fs/promises";
import * as v from "valibot";

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

export type AgentErrorFactory<TError> = (
   message: string,
   cause?: unknown,
) => TError;

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

export async function readPreparedContext<TError>(
   filePath: string,
   failureMessage: string,
   makeError: AgentErrorFactory<TError>,
) {
   return Result.tryPromise({
      try: async () => ({
         stdout: await readFile(filePath, "utf8"),
         stderr: "",
         exitCode: 0,
      }),
      catch: (cause) => makeError(failureMessage, cause),
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

export async function publishIssueComment<TError>({
   repo,
   prNumber,
   body,
   token,
   makeError,
}: {
   repo: string;
   prNumber: number;
   body: string;
   token: string | undefined;
   makeError: AgentErrorFactory<TError>;
}) {
   if (!token) {
      return Result.err(makeError("GH_TOKEN não configurado no ambiente."));
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
         makeError("Falha ao publicar comentário no GitHub.", cause),
   });
}
