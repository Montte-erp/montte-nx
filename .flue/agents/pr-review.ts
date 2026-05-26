import type { FlueContext } from "@flue/runtime";
import { local } from "@flue/runtime/node";
import { Octokit } from "@octokit/core";
import { Result, TaggedError } from "better-result";
import { defineErrorCatalog } from "evlog";
import { mkdir, writeFile } from "node:fs/promises";
import * as v from "valibot";
import {
   formatCause,
   publishIssueComment,
   readPreparedContext,
   resolveGithubToken,
   safePathSchema,
   safeRepoSchema,
   truncateForPrompt,
} from "../lib/agent-utils.ts";
import { DEFAULT_FLUE_MODEL } from "../lib/model.ts";

export const triggers = {};

const prPayloadSchema = v.object({
   prNumber: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
   repo: v.optional(safeRepoSchema),
   outputDir: v.optional(safePathSchema, ".agent-artifacts/pr-review"),
   contextDir: v.optional(safePathSchema, ".agent-artifacts/pr-review/input"),
   dryRun: v.optional(v.boolean(), false),
});

const reviewCommentSchema = v.object({
   path: v.pipe(v.string(), v.minLength(1)),
   line: v.pipe(v.number(), v.integer(), v.minValue(1)),
   side: v.optional(v.picklist(["RIGHT", "LEFT"]), "RIGHT"),
   severity: v.picklist(["critical", "major", "minor", "trivial", "info"]),
   confidence: v.optional(
      v.pipe(v.number(), v.minValue(0), v.maxValue(1)),
      0.7,
   ),
   actionable: v.optional(v.boolean(), false),
   suggestion: v.optional(v.pipe(v.string(), v.minLength(1))),
   reproSteps: v.optional(v.pipe(v.string(), v.minLength(1))),
   title: v.pipe(v.string(), v.minLength(1)),
   body: v.pipe(v.string(), v.minLength(1)),
});

const reviewResultSchema = v.object({
   summary: v.pipe(v.string(), v.minLength(1)),
   comments: v.optional(v.array(reviewCommentSchema), []),
});

export type ReviewComment = v.InferOutput<typeof reviewCommentSchema>;

const prReviewAgentErrors = defineErrorCatalog("flue.pr-review.agent", {
   BAD_PAYLOAD: {
      status: 400,
      message: "Payload inválido para agente de revisão de PR.",
      tags: ["flue", "pr-review"],
   },
   MISSING_INPUT: {
      status: 400,
      message: "Entrada obrigatória ausente para revisão de PR.",
      tags: ["flue", "pr-review"],
   },
   IO_FAILED: {
      status: 500,
      message: "Falha de IO no agente de revisão de PR.",
      tags: ["flue", "pr-review"],
   },
   MODEL_FAILED: {
      status: 500,
      message: "Falha ao executar modelo de revisão de PR.",
      tags: ["flue", "pr-review"],
   },
   GITHUB_FAILED: {
      status: 500,
      message: "Falha ao publicar revisão no GitHub.",
      tags: ["flue", "pr-review", "github"],
   },
});

declare module "evlog" {
   interface RegisteredErrorCatalogs {
      "flue.pr-review.agent": typeof prReviewAgentErrors;
   }
}

type PrReviewAgentCatalogError =
   | ReturnType<typeof prReviewAgentErrors.BAD_PAYLOAD>
   | ReturnType<typeof prReviewAgentErrors.MISSING_INPUT>
   | ReturnType<typeof prReviewAgentErrors.IO_FAILED>
   | ReturnType<typeof prReviewAgentErrors.MODEL_FAILED>
   | ReturnType<typeof prReviewAgentErrors.GITHUB_FAILED>;

class PrReviewAgentError extends TaggedError("PrReviewAgentError")<{
   error: PrReviewAgentCatalogError;
   message: string;
   repo?: string;
   prNumber?: number;
   outputFile?: string;
   detail?: string;
}>() {}

function formatInlineComment(comment: ReviewComment) {
   return `**Severidade:** ${comment.severity}

**${comment.title}**

${comment.body}`;
}

export function parseDiffReviewLines(patch: string) {
   const allowed = new Map<string, { left: Set<number>; right: Set<number> }>();
   let currentPath: string | undefined;
   let oldLine = 0;
   let newLine = 0;

   for (const line of patch.split("\n")) {
      if (line.startsWith("diff --git ")) {
         currentPath = undefined;
         continue;
      }

      if (line.startsWith("+++ b/")) {
         currentPath = line.slice("+++ b/".length);
         if (!allowed.has(currentPath)) {
            allowed.set(currentPath, { left: new Set(), right: new Set() });
         }
         continue;
      }

      if (!currentPath) continue;

      const hunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/u.exec(line);
      if (hunk) {
         oldLine = Number(hunk[1]);
         newLine = Number(hunk[2]);
         continue;
      }

      const fileLines = allowed.get(currentPath);
      if (!fileLines) continue;

      if (line.startsWith("+") && !line.startsWith("+++")) {
         fileLines.right.add(newLine);
         newLine += 1;
         continue;
      }

      if (line.startsWith("-") && !line.startsWith("---")) {
         fileLines.left.add(oldLine);
         oldLine += 1;
         continue;
      }

      if (line.startsWith(" ")) {
         fileLines.left.add(oldLine);
         fileLines.right.add(newLine);
         oldLine += 1;
         newLine += 1;
      }
   }

   return allowed;
}

function hasActionableContent(comment: ReviewComment) {
   if (comment.actionable || comment.suggestion || comment.reproSteps)
      return true;

   return /\b(corre[cç][aã]o|sugest[aã]o|reprodu[cç][aã]o|passos?|altere|troque|remova|adicione|valide)\b/iu.test(
      `${comment.title}\n${comment.body}`,
   );
}

const MAX_FALLBACK_LINE_DISTANCE = 30;

function findNearestReviewLine(lines: Set<number>, targetLine: number) {
   let nearestLine: number | undefined;

   for (const line of lines) {
      if (nearestLine === undefined) {
         nearestLine = line;
         continue;
      }

      const currentDistance = Math.abs(line - targetLine);
      const nearestDistance = Math.abs(nearestLine - targetLine);
      if (
         currentDistance < nearestDistance ||
         (currentDistance === nearestDistance && line < nearestLine)
      ) {
         nearestLine = line;
      }
   }

   if (nearestLine === undefined) return undefined;

   const distance = Math.abs(nearestLine - targetLine);
   if (distance > MAX_FALLBACK_LINE_DISTANCE) return undefined;

   return nearestLine;
}

function withFallbackAnchor(comment: ReviewComment, fallbackLine: number) {
   return {
      ...comment,
      line: fallbackLine,
      body: `${comment.body}\n\nObservação: o achado apontava para a linha ${comment.line}, que não está comentável no diff atual; ancorei na linha alterada mais próxima do mesmo arquivo para não perder o comentário inline.`,
   };
}

function severityRank(severity: ReviewComment["severity"]) {
   if (severity === "critical") return 5;
   if (severity === "major") return 4;
   if (severity === "minor") return 3;
   if (severity === "trivial") return 2;
   return 1;
}

function highestSeverity(comments: Array<ReviewComment>) {
   let selected: ReviewComment["severity"] = "info";

   for (const comment of comments) {
      if (severityRank(comment.severity) > severityRank(selected)) {
         selected = comment.severity;
      }
   }

   return selected;
}

function combineAnchoredComments(comments: Array<ReviewComment>) {
   const grouped = new Map<string, Array<ReviewComment>>();

   for (const comment of comments) {
      const key = `${comment.path}\u0000${comment.side}\u0000${comment.line}`;
      const group = grouped.get(key) ?? [];
      group.push(comment);
      grouped.set(key, group);
   }

   const combined: Array<ReviewComment> = [];
   for (const group of grouped.values()) {
      const first = group[0];
      if (!first) continue;

      if (group.length === 1) {
         combined.push(first);
         continue;
      }

      combined.push({
         ...first,
         severity: highestSeverity(group),
         confidence: Math.max(...group.map((comment) => comment.confidence)),
         actionable: group.some((comment) => comment.actionable),
         title: `${group.length} achados nesta linha`,
         body: group
            .map(
               (comment, index) =>
                  `**${index + 1}. ${comment.title}**\n\n${comment.body}`,
            )
            .join("\n\n---\n\n"),
      });
   }

   return combined;
}

export function splitValidInlineComments(
   comments: Array<ReviewComment>,
   patch: string,
) {
   const allowed = parseDiffReviewLines(patch);
   const valid: Array<ReviewComment> = [];
   const skipped: Array<ReviewComment & { reason: string }> = [];

   for (const comment of comments) {
      if (comment.severity === "trivial" || comment.severity === "info") {
         skipped.push({
            ...comment,
            reason:
               "Comentário inline trivial/info não passa nos gates anti-ruído.",
         });
         continue;
      }

      if (comment.confidence < 0.7) {
         skipped.push({
            ...comment,
            reason: "Confidence abaixo do mínimo para comentário inline.",
         });
         continue;
      }

      if (!hasActionableContent(comment)) {
         skipped.push({
            ...comment,
            reason:
               "Comentário sem correção concreta, passos de reprodução ou marcação actionable.",
         });
         continue;
      }

      const fileLines = allowed.get(comment.path);
      if (!fileLines) {
         skipped.push({
            ...comment,
            reason: "Arquivo não aparece no diff atual.",
         });
         continue;
      }

      const lineSet =
         comment.side === "LEFT" ? fileLines.left : fileLines.right;
      if (lineSet.has(comment.line)) {
         valid.push(comment);
         continue;
      }

      const fallbackLine = findNearestReviewLine(lineSet, comment.line);
      if (fallbackLine !== undefined) {
         valid.push(withFallbackAnchor(comment, fallbackLine));
         continue;
      }

      skipped.push({
         ...comment,
         reason:
            "Arquivo aparece no diff, mas não possui linha comentável próxima o suficiente.",
      });
   }

   return { valid: combineAnchoredComments(valid), skipped };
}

async function publishReview({
   repo,
   prNumber,
   body,
   comments,
   token,
}: {
   repo: string;
   prNumber: number;
   body: string;
   comments: Array<ReviewComment>;
   token: string | undefined;
}) {
   if (!token) {
      return Result.err(
         new PrReviewAgentError({
            error: prReviewAgentErrors.MISSING_INPUT(),
            message: "GH_TOKEN não configurado no ambiente.",
            repo,
            prNumber,
         }),
      );
   }

   const commentsPayload = comments.map((comment) => ({
      path: comment.path,
      line: comment.line,
      side: comment.side,
      body: formatInlineComment(comment),
   }));

   const [owner, repoName] = repo.split("/");
   if (!owner || !repoName) {
      return Result.err(
         new PrReviewAgentError({
            error: prReviewAgentErrors.BAD_PAYLOAD(),
            message: "repo inválido. Use owner/repo.",
            repo,
            prNumber,
         }),
      );
   }

   const octokit = new Octokit({ auth: token });
   return Result.tryPromise({
      try: async () => {
         await octokit.request(
            "POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews",
            {
               owner,
               repo: repoName,
               pull_number: prNumber,
               body,
               event: "COMMENT",
               comments: commentsPayload,
            },
         );
      },
      catch: (cause) =>
         new PrReviewAgentError({
            error: prReviewAgentErrors.GITHUB_FAILED(),
            message: "Falha ao publicar review inline no GitHub.",
            repo,
            prNumber,
            detail: formatCause(cause),
         }),
   });
}

export default async function ({ init, payload, env }: FlueContext) {
   const parsedPayload = v.safeParse(prPayloadSchema, payload);
   if (!parsedPayload.success) {
      throw new PrReviewAgentError({
         error: prReviewAgentErrors.BAD_PAYLOAD(),
         message: "Payload inválido para agente de revisão de PR.",
         detail: formatCause(parsedPayload.issues),
      });
   }

   const {
      prNumber: payloadPrNumber,
      repo: payloadRepo,
      outputDir,
      contextDir,
      dryRun,
   } = parsedPayload.output;
   const envPrNumber = Number(env.PR_NUMBER);
   const prNumber =
      payloadPrNumber ??
      (Number.isInteger(envPrNumber) && envPrNumber > 0
         ? envPrNumber
         : undefined);
   const repoResult = v.safeParse(
      safeRepoSchema,
      payloadRepo ?? env.GITHUB_REPOSITORY,
   );

   if (!prNumber || prNumber <= 0) {
      throw new PrReviewAgentError({
         error: prReviewAgentErrors.MISSING_INPUT(),
         message:
            "Informe prNumber positivo no payload ou PR_NUMBER no ambiente.",
      });
   }

   if (!repoResult.success) {
      throw new PrReviewAgentError({
         error: prReviewAgentErrors.BAD_PAYLOAD(),
         message: "repo inválido ou não informado. Use owner/repo.",
         prNumber,
         detail: formatCause(repoResult.issues),
      });
   }

   const repo = repoResult.output;
   const githubToken = resolveGithubToken(env);

   const outputDirResult = await Result.tryPromise({
      try: () => mkdir(outputDir, { recursive: true }),
      catch: (cause) =>
         new PrReviewAgentError({
            error: prReviewAgentErrors.IO_FAILED(),
            message: "Falha ao criar diretório de artefatos da revisão.",
            outputFile: outputDir,
            detail: formatCause(cause),
         }),
   });
   if (Result.isError(outputDirResult)) throw outputDirResult.error;

   const contextResult = await Result.tryPromise({
      try: () =>
         Promise.all([
            readPreparedContext(
               `${contextDir}/pr-metadata.json`,
               "Falha ao ler metadados preparados da PR.",
            ),
            readPreparedContext(
               `${contextDir}/changed-files.md`,
               "Falha ao ler lista preparada de arquivos da PR.",
            ),
            readPreparedContext(
               `${contextDir}/pr.patch`,
               "Falha ao ler diff preparado da PR.",
            ),
            readPreparedContext(
               `${contextDir}/commits.md`,
               "Falha ao ler commits preparados da PR.",
            ),
            readPreparedContext(
               `${contextDir}/checks.json`,
               "Falha ao ler checks preparados da PR.",
            ),
            readPreparedContext(
               `${contextDir}/reviews.md`,
               "Falha ao ler reviews preparados da PR.",
            ),
            readPreparedContext(
               `${contextDir}/inline-review-comments.md`,
               "Falha ao ler comentários inline preparados da PR.",
            ),
            readPreparedContext(
               `${contextDir}/general-pr-comments.md`,
               "Falha ao ler comentários gerais preparados da PR.",
            ),
         ]),
      catch: (cause) =>
         new PrReviewAgentError({
            error: prReviewAgentErrors.IO_FAILED(),
            message: "Falha ao coletar contexto da PR ou carregar skill.",
            detail: formatCause(cause),
         }),
   });
   if (Result.isError(contextResult)) throw contextResult.error;

   const [
      prMetadata,
      changedFiles,
      fullDiff,
      commits,
      ciChecks,
      generalReviews,
      inlineReviewComments,
      generalPrComments,
   ] = contextResult.value;

   if (Result.isError(prMetadata)) throw prMetadata.error;
   if (Result.isError(changedFiles)) throw changedFiles.error;
   if (Result.isError(fullDiff)) throw fullDiff.error;
   if (Result.isError(commits)) throw commits.error;
   if (Result.isError(ciChecks)) throw ciChecks.error;
   if (Result.isError(generalReviews)) throw generalReviews.error;
   if (Result.isError(inlineReviewComments)) throw inlineReviewComments.error;
   if (Result.isError(generalPrComments)) throw generalPrComments.error;

   await Promise.all([
      writeFile(`${outputDir}/pr-metadata.json`, prMetadata.value.stdout),
      writeFile(`${outputDir}/changed-files.md`, changedFiles.value.stdout),
      writeFile(`${outputDir}/pr.patch`, fullDiff.value.stdout),
      writeFile(`${outputDir}/commits.md`, commits.value.stdout),
      writeFile(`${outputDir}/checks.json`, ciChecks.value.stdout),
      writeFile(`${outputDir}/reviews.md`, generalReviews.value.stdout),
      writeFile(
         `${outputDir}/inline-review-comments.md`,
         inlineReviewComments.value.stdout,
      ),
      writeFile(
         `${outputDir}/general-pr-comments.md`,
         generalPrComments.value.stdout,
      ),
   ]);

   const promptFullDiff = truncateForPrompt(
      fullDiff.value.stdout,
      180_000,
      "Full diff",
   );
   const promptGeneralReviews = truncateForPrompt(
      generalReviews.value.stdout,
      12_000,
      "Reviews gerais",
   );
   const promptInlineReviewComments = truncateForPrompt(
      inlineReviewComments.value.stdout,
      18_000,
      "Inline review comments",
   );
   const promptGeneralPrComments = truncateForPrompt(
      generalPrComments.value.stdout,
      18_000,
      "General PR comments",
   );

   const promptContextSize = {
      fullDiff: fullDiff.value.stdout.length,
      promptFullDiff: promptFullDiff.length,
      generalReviews: generalReviews.value.stdout.length,
      promptGeneralReviews: promptGeneralReviews.length,
      inlineReviewComments: inlineReviewComments.value.stdout.length,
      promptInlineReviewComments: promptInlineReviewComments.length,
      generalPrComments: generalPrComments.value.stdout.length,
      promptGeneralPrComments: promptGeneralPrComments.length,
   };

   await writeFile(
      `${outputDir}/prompt-context-size.json`,
      JSON.stringify(promptContextSize, null, 2),
   );

   const task = `Revise a PR #${prNumber} usando a skill de code review do Montte. Use apenas o contexto pré-coletado em args. Não rode comandos nem colete dados pelo GitHub. Todo achado acionável citado no summary também deve aparecer em comments[]; summary não substitui comentário inline. Retorne comentários inline com severidade, confiança >= 0.7 e correção concreta. Se a linha exata não estiver disponível, use a linha numérica comentável mais próxima no mesmo arquivo.`;

   const modelHarnessResult = await Result.tryPromise({
      try: () =>
         init({
            name: "pr-review-model",
            // local() lets Flue discover AGENTS.md and .agents/skills from cwd.
            // GitHub writes stay on the host through Octokit; tokens are not
            // exposed to the sandbox env and we do not collect context with gh.
            sandbox: local({ env: {} }),
            model: process.env.FLUE_MODEL ?? DEFAULT_FLUE_MODEL,
         }),
      catch: (cause) =>
         new PrReviewAgentError({
            error: prReviewAgentErrors.MODEL_FAILED(),
            message: "Falha ao inicializar Flue para modelo de review.",
            repo,
            prNumber,
            detail: formatCause(cause),
         }),
   });
   if (Result.isError(modelHarnessResult)) throw modelHarnessResult.error;

   const modelSessionResult = await Result.tryPromise({
      try: () => modelHarnessResult.value.session(),
      catch: (cause) =>
         new PrReviewAgentError({
            error: prReviewAgentErrors.MODEL_FAILED(),
            message: "Falha ao abrir sessão de modelo para review.",
            repo,
            prNumber,
            detail: formatCause(cause),
         }),
   });
   if (Result.isError(modelSessionResult)) throw modelSessionResult.error;

   const outputResult = await Result.tryPromise({
      try: () =>
         Promise.resolve(
            modelSessionResult.value.skill("code-review", {
               args: {
                  task,
                  repo,
                  prNumber,
                  prMetadata: prMetadata.value.stdout,
                  changedFiles: changedFiles.value.stdout,
                  patch: promptFullDiff,
                  commits: commits.value.stdout,
                  checks: ciChecks.value.stdout,
                  reviews: promptGeneralReviews,
                  inlineReviewComments: promptInlineReviewComments,
                  generalPrComments: promptGeneralPrComments,
                  promptContextSize,
               },
               thinkingLevel: "off",
               result: reviewResultSchema,
            }),
         ),
      catch: (cause) =>
         new PrReviewAgentError({
            error: prReviewAgentErrors.MODEL_FAILED(),
            message: `Falha ao executar skill de review via Flue: ${formatCause(cause)}`,
            repo,
            prNumber,
            detail: formatCause(cause),
         }),
   });
   if (Result.isError(outputResult)) throw outputResult.error;

   const reviewResult = outputResult.value.data;

   const inlineComments = splitValidInlineComments(
      reviewResult.comments,
      fullDiff.value.stdout,
   );

   await writeFile(
      `${outputDir}/inline-comments.json`,
      JSON.stringify(inlineComments.valid, null, 2),
   );
   await writeFile(
      `${outputDir}/inline-comments-skipped.json`,
      JSON.stringify(inlineComments.skipped, null, 2),
   );

   const outputFile = `${outputDir}/summary.md`;
   const writeResult = await Result.tryPromise({
      try: () => writeFile(outputFile, reviewResult.summary),
      catch: (cause) =>
         new PrReviewAgentError({
            error: prReviewAgentErrors.IO_FAILED(),
            message: "Falha ao escrever summary.md.",
            outputFile,
            detail: formatCause(cause),
         }),
   });
   if (Result.isError(writeResult)) throw writeResult.error;

   if (dryRun) {
      return {
         outputFile,
         prNumber,
         inlineComments: inlineComments.valid.length,
         skippedInlineComments: inlineComments.skipped.length,
         dryRun,
      };
   }

   const publishResult = await publishReview({
      repo,
      prNumber,
      body: reviewResult.summary,
      comments: inlineComments.valid,
      token: githubToken,
   });

   if (Result.isError(publishResult)) {
      await writeFile(
         `${outputDir}/publish-error.txt`,
         publishResult.error.detail ?? publishResult.error.message,
      );

      const fallbackCommentResult = await publishIssueComment({
         repo,
         prNumber,
         body: reviewResult.summary,
         token: githubToken,
      });
      if (Result.isError(fallbackCommentResult))
         throw fallbackCommentResult.error;
   }

   return {
      outputFile,
      prNumber,
      inlineComments: inlineComments.valid.length,
      skippedInlineComments: inlineComments.skipped.length,
      dryRun,
   };
}
