import type { FlueContext } from "@flue/runtime";
import { local } from "@flue/runtime/node";
import { Result, TaggedError } from "better-result";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { z } from "zod";
import { DEFAULT_FLUE_MODEL } from "../lib/model.ts";

export const triggers = {};

const safeRepoSchema = z.string().regex(/^[\w.-]+\/[\w.-]+$/u);
const safeOutputDirSchema = z
   .string()
   .regex(/^(?:\.\/[\w./-]+|\.[\w./-]*|[\w][\w./-]*)$/u)
   .refine((value) => !value.split("/").includes(".."), {
      message: "outputDir não pode conter segmentos '..'.",
   });

const prPayloadSchema = z.object({
   prNumber: z.number().int().nonnegative().optional(),
   repo: safeRepoSchema.optional(),
   outputDir: safeOutputDirSchema.default(".agent-artifacts/pr-review"),
});

const reviewCommentSchema = z.object({
   path: z.string().min(1),
   line: z.number().int().positive(),
   side: z.enum(["RIGHT", "LEFT"]).default("RIGHT"),
   severity: z.enum(["critical", "major", "minor", "trivial", "info"]),
   confidence: z.number().min(0).max(1).default(0.7),
   actionable: z.boolean().default(false),
   suggestion: z.string().min(1).optional(),
   reproSteps: z.string().min(1).optional(),
   title: z.string().min(1),
   body: z.string().min(1),
});

const reviewResultSchema = z.object({
   summary: z.string().min(1),
   comments: z.array(reviewCommentSchema).default([]),
});

type FlueHarness = Awaited<ReturnType<FlueContext["init"]>>;
type FlueSession = Awaited<ReturnType<FlueHarness["session"]>>;

class PrReviewAgentError extends TaggedError("PrReviewAgentError")<{
   message: string;
   cause?: unknown;
}>() {}

function shellQuote(value: string | number) {
   return `'${String(value).replace(/'/gu, `'"'"'`)}'`;
}

function ghCommand(args: Array<string | number>) {
   return ["gh", ...args.map(shellQuote)].join(" ");
}

async function runRequiredCommand(
   session: FlueSession,
   command: string,
   failureMessage: string,
) {
   const commandResult = await Result.tryPromise({
      try: () => Promise.resolve(session.shell(command)),
      catch: (cause) =>
         new PrReviewAgentError({
            message: failureMessage,
            cause,
         }),
   });
   if (Result.isError(commandResult)) return Result.err(commandResult.error);

   if (commandResult.value.exitCode !== 0) {
      return Result.err(
         new PrReviewAgentError({
            message: failureMessage,
            cause: commandResult.value.stderr,
         }),
      );
   }

   return Result.ok(commandResult.value);
}

function parseReviewResult(raw: string) {
   const trimmed = raw.trim();
   const withoutFence = trimmed
      .replace(/^```(?:json)?\s*/u, "")
      .replace(/\s*```$/u, "");

   const jsonResult = Result.try({
      try: () => JSON.parse(withoutFence),
      catch: (cause) =>
         new PrReviewAgentError({
            message: "Resposta do review agent não é JSON válido.",
            cause,
         }),
   });
   if (Result.isError(jsonResult)) return Result.err(jsonResult.error);

   const parsed = reviewResultSchema.safeParse(jsonResult.value);
   if (!parsed.success) {
      return Result.err(
         new PrReviewAgentError({
            message: "Resposta do review agent não segue o schema esperado.",
            cause: parsed.error,
         }),
      );
   }

   return Result.ok(parsed.data);
}

function formatInlineComment(comment: z.infer<typeof reviewCommentSchema>) {
   return `**Severidade:** ${comment.severity}

**${comment.title}**

${comment.body}`;
}

function parseDiffReviewLines(patch: string) {
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

function hasActionableContent(comment: z.infer<typeof reviewCommentSchema>) {
   if (comment.actionable || comment.suggestion || comment.reproSteps)
      return true;

   return /\b(corre[cç][aã]o|sugest[aã]o|reprodu[cç][aã]o|passos?|altere|troque|remova|adicione|valide)\b/iu.test(
      `${comment.title}\n${comment.body}`,
   );
}

function splitValidInlineComments(
   comments: Array<z.infer<typeof reviewCommentSchema>>,
   patch: string,
) {
   const allowed = parseDiffReviewLines(patch);
   const valid: Array<z.infer<typeof reviewCommentSchema>> = [];
   const skipped: Array<
      z.infer<typeof reviewCommentSchema> & { reason: string }
   > = [];

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
      if (!lineSet.has(comment.line)) {
         skipped.push({
            ...comment,
            reason: "Linha não é comentável no diff atual.",
         });
         continue;
      }

      valid.push(comment);
   }

   return { valid, skipped };
}

async function publishReview({
   repo,
   prNumber,
   body,
   comments,
}: {
   repo: string;
   prNumber: number;
   body: string;
   comments: Array<z.infer<typeof reviewCommentSchema>>;
}) {
   const token = process.env.GH_TOKEN;
   if (!token) {
      return Result.err(
         new PrReviewAgentError({
            message: "GH_TOKEN não configurado no ambiente.",
         }),
      );
   }

   const payload = {
      body,
      event: "COMMENT",
      comments: comments.map((comment) => ({
         path: comment.path,
         line: comment.line,
         side: comment.side,
         body: formatInlineComment(comment),
      })),
   };

   const responseResult = await Result.tryPromise({
      try: () =>
         fetch(
            `https://api.github.com/repos/${repo}/pulls/${prNumber}/reviews`,
            {
               method: "POST",
               headers: {
                  Accept: "application/vnd.github+json",
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                  "X-GitHub-Api-Version": "2022-11-28",
               },
               body: JSON.stringify(payload),
            },
         ),
      catch: (cause) =>
         new PrReviewAgentError({
            message: "Falha ao publicar review inline no GitHub.",
            cause,
         }),
   });
   if (Result.isError(responseResult)) return Result.err(responseResult.error);

   if (responseResult.value.ok) return Result.ok(undefined);

   const bodyResult = await Result.tryPromise({
      try: () => responseResult.value.text(),
      catch: (cause) =>
         new PrReviewAgentError({
            message: "Falha ao ler erro da API do GitHub.",
            cause,
         }),
   });

   return Result.err(
      new PrReviewAgentError({
         message: `GitHub retornou ${responseResult.value.status} ao publicar review.`,
         cause: Result.isOk(bodyResult) ? bodyResult.value : bodyResult.error,
      }),
   );
}

export default async function ({ init, payload, env }: FlueContext) {
   const parsedPayload = prPayloadSchema.safeParse(payload);
   if (!parsedPayload.success) {
      throw new PrReviewAgentError({
         message: "Payload inválido para agente de revisão de PR.",
         cause: parsedPayload.error,
      });
   }

   const {
      prNumber: payloadPrNumber,
      repo: payloadRepo,
      outputDir,
   } = parsedPayload.data;
   const envPrNumber = z.coerce
      .number()
      .int()
      .positive()
      .safeParse(env.PR_NUMBER);
   const prNumber =
      payloadPrNumber ?? (envPrNumber.success ? envPrNumber.data : undefined);
   const repoResult = safeRepoSchema.safeParse(
      payloadRepo ?? env.GITHUB_REPOSITORY,
   );

   if (!prNumber || prNumber <= 0) {
      throw new PrReviewAgentError({
         message:
            "Informe prNumber positivo no payload ou PR_NUMBER no ambiente.",
      });
   }

   if (!repoResult.success) {
      throw new PrReviewAgentError({
         message: "repo inválido ou não informado. Use owner/repo.",
         cause: repoResult.error,
      });
   }

   const repo = repoResult.data;

   const harnessResult = await Result.tryPromise({
      try: () =>
         init({
            name: "pr-review-context",
            sandbox: local({
               env: {
                  GH_TOKEN: process.env.GH_TOKEN,
               },
            }),
            model: false,
         }),
      catch: (cause) =>
         new PrReviewAgentError({
            message:
               "Falha ao inicializar Flue para contexto de revisão de PR.",
            cause,
         }),
   });
   if (Result.isError(harnessResult)) throw harnessResult.error;

   const sessionResult = await Result.tryPromise({
      try: () => harnessResult.value.session(),
      catch: (cause) =>
         new PrReviewAgentError({
            message: "Falha ao abrir sessão Flue para revisão de PR.",
            cause,
         }),
   });
   if (Result.isError(sessionResult)) throw sessionResult.error;

   const session = sessionResult.value;

   const outputDirResult = await Result.tryPromise({
      try: () => mkdir(outputDir, { recursive: true }),
      catch: (cause) =>
         new PrReviewAgentError({
            message: "Falha ao criar diretório de artefatos da revisão.",
            cause,
         }),
   });
   if (Result.isError(outputDirResult)) throw outputDirResult.error;

   const contextResult = await Result.tryPromise({
      try: () =>
         Promise.all([
            runRequiredCommand(
               session,
               ghCommand([
                  "pr",
                  "view",
                  prNumber,
                  "--repo",
                  repo,
                  "--json",
                  "number,title,author,state,isDraft,reviewDecision,additions,deletions,changedFiles,labels,url,body",
               ]),
               "Falha ao coletar metadados da PR.",
            ),
            runRequiredCommand(
               session,
               ghCommand([
                  "pr",
                  "files",
                  prNumber,
                  "--repo",
                  repo,
                  "--json",
                  "path,additions,deletions",
                  "--jq",
                  '.[] | "- " + .path + " (+" + (.additions|tostring) + " -" + (.deletions|tostring) + ")"',
               ]),
               "Falha ao listar arquivos alterados da PR.",
            ),
            runRequiredCommand(
               session,
               ghCommand(["pr", "diff", prNumber, "--repo", repo]),
               "Falha ao coletar diff da PR.",
            ),
            runRequiredCommand(
               session,
               ghCommand([
                  "pr",
                  "view",
                  prNumber,
                  "--repo",
                  repo,
                  "--json",
                  "commits",
                  "--jq",
                  ".commits[].message",
               ]),
               "Falha ao coletar commits da PR.",
            ),
            runRequiredCommand(
               session,
               `${ghCommand([
                  "pr",
                  "checks",
                  prNumber,
                  "--repo",
                  repo,
                  "--json",
                  "name,status,conclusion",
               ])} || true`,
               "Falha ao coletar checks da PR.",
            ),
            runRequiredCommand(
               session,
               ghCommand([
                  "pr",
                  "view",
                  prNumber,
                  "--repo",
                  repo,
                  "--json",
                  "reviews",
                  "--jq",
                  '.reviews[] | "- " + .state + " - " + .author.login + " - " + .body',
               ]),
               "Falha ao coletar reviews da PR.",
            ),
            runRequiredCommand(
               session,
               ghCommand([
                  "api",
                  `repos/${repo}/pulls/${prNumber}/comments`,
                  "--paginate",
                  "--jq",
                  '.[] | "- " + .path + ":" + ((.line // 0)|tostring) + " - " + .user.login + " - " + .body',
               ]),
               "Falha ao coletar comentários inline da PR.",
            ),
            runRequiredCommand(
               session,
               ghCommand([
                  "api",
                  `repos/${repo}/issues/${prNumber}/comments`,
                  "--paginate",
                  "--jq",
                  '.[] | "- " + .user.login + " - " + .body',
               ]),
               "Falha ao coletar comentários gerais da PR.",
            ),
            readFile("AGENTS.md", "utf8"),
            readFile(".agents/skills/code-review/SKILL.md", "utf8"),
            readFile(
               ".agents/skills/code-review/references/pr-review.md",
               "utf8",
            ),
            readFile(
               ".agents/skills/code-review/references/review-comments.md",
               "utf8",
            ),
            readFile(
               ".agents/skills/code-review/references/tests-validation.md",
               "utf8",
            ),
         ]),
      catch: (cause) =>
         new PrReviewAgentError({
            message: "Falha ao coletar contexto da PR ou carregar skill.",
            cause,
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
      agentInstructions,
      skillInstruction,
      automatedReviewReference,
      reviewCommentsReference,
      testsValidationReference,
   ] = contextResult.value;

   const commandResults = [
      prMetadata,
      changedFiles,
      fullDiff,
      commits,
      ciChecks,
      generalReviews,
      inlineReviewComments,
      generalPrComments,
   ];
   const failedCommand = commandResults.find(Result.isError);
   if (failedCommand) throw failedCommand.error;

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

   const context = `
# Revisão PR #${prNumber}

## PR metadata
${prMetadata.value.stdout}

## Changed files (metric)
${changedFiles.value.stdout}

## Full diff
${fullDiff.value.stdout}

## Commits
${commits.value.stdout}

## CI checks
${ciChecks.value.stdout}

## Reviews gerais
${generalReviews.value.stdout}

## Inline review comments
${inlineReviewComments.value.stdout}

## General PR comments
${generalPrComments.value.stdout}
`;

   const prompt = `
Você é o agente automático de code review do Montte.
Siga obrigatoriamente o AGENTS.md, o SKILL.md e as references carregadas abaixo.
O SKILL.md é apenas o organizador; as references guiam o padrão de execução.

AGENTS.md:
${agentInstructions}

SKILL.md de code review:
${skillInstruction}

Reference: pr-review
${automatedReviewReference}

Reference: review-comments
${reviewCommentsReference}

Reference: tests-validation
${testsValidationReference}

Contexto:
${context}

Tarefa:
- revise a PR com foco em bugs reais, regressões, contratos quebrados, segurança, dados incorretos e CI/testes;
- verifique stale/duplicado contra comentários anteriores;
- não faça nits cobertos por formatter/linter;
- não invente fatos fora do contexto;
- se não houver achados acionáveis, diga isso claramente.

Restrição obrigatória:
- cada comentário inline deve apontar para path e line exatos do diff;
- use side "RIGHT" para linha adicionada ou contexto no arquivo novo;
- use side "LEFT" apenas para linha removida no arquivo antigo;
- não comente arquivo/linha fora do patch.

Retorne JSON válido, sem markdown fences, neste formato:
{
  "summary": "Resumo curto do risco, CI/testes relevantes e validação recomendada.",
  "comments": [
    {
      "path": "arquivo alterado",
      "line": 123,
      "side": "RIGHT",
      "severity": "critical|major|minor|trivial|info",
      "confidence": 0.82,
      "actionable": true,
      "suggestion": "Correção pequena opcional, ou omita o campo",
      "reproSteps": "Passos de reprodução opcionais, ou omita o campo",
      "title": "Título curto do achado",
      "body": "Explique por que isso está errado, impacto concreto e correção pequena em pt-BR."
    }
  ]
}

Regras para comments:
- cada comentário precisa estar em arquivo/linha do diff;
- cada comentário precisa explicar por que está errado;
- incluir severidade correta;
- não limite artificialmente a quantidade de comentários; aplique apenas os gates de qualidade;
- não inclua comentários trivial ou info;
- cada comentário precisa ter confidence >= 0.7;
- cada comentário precisa ter sugestão concreta, passos de reprodução ou actionable: true;
- se não houver achados acionáveis, retorne "comments": [].
`.trim();

   const modelHarnessResult = await Result.tryPromise({
      try: () =>
         init({
            name: "pr-review-model",
            sandbox: false,
            model: process.env.FLUE_MODEL ?? DEFAULT_FLUE_MODEL,
         }),
      catch: (cause) =>
         new PrReviewAgentError({
            message: "Falha ao inicializar Flue para modelo de review.",
            cause,
         }),
   });
   if (Result.isError(modelHarnessResult)) throw modelHarnessResult.error;

   const modelSessionResult = await Result.tryPromise({
      try: () => modelHarnessResult.value.session(),
      catch: (cause) =>
         new PrReviewAgentError({
            message: "Falha ao abrir sessão de modelo para review.",
            cause,
         }),
   });
   if (Result.isError(modelSessionResult)) throw modelSessionResult.error;

   const outputResult = await Result.tryPromise({
      try: () =>
         Promise.resolve(
            modelSessionResult.value.prompt(prompt, { thinkingLevel: "off" }),
         ),
      catch: (cause) =>
         new PrReviewAgentError({
            message: "Falha ao executar prompt de review via Flue.",
            cause,
         }),
   });
   if (Result.isError(outputResult)) throw outputResult.error;

   const reviewResult = parseReviewResult(outputResult.value.text);
   if (Result.isError(reviewResult)) throw reviewResult.error;

   const inlineComments = splitValidInlineComments(
      reviewResult.value.comments,
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
      try: () => writeFile(outputFile, reviewResult.value.summary),
      catch: (cause) =>
         new PrReviewAgentError({
            message: "Falha ao escrever summary.md.",
            cause,
         }),
   });
   if (Result.isError(writeResult)) throw writeResult.error;

   const publishResult = await publishReview({
      repo,
      prNumber,
      body: reviewResult.value.summary,
      comments: inlineComments.valid,
   });

   if (Result.isError(publishResult)) {
      await writeFile(
         `${outputDir}/publish-error.txt`,
         String(publishResult.error.cause ?? publishResult.error.message),
      );

      const fallbackCommentResult = await runRequiredCommand(
         session,
         ghCommand([
            "pr",
            "comment",
            prNumber,
            "--repo",
            repo,
            "--body-file",
            outputFile,
         ]),
         "Falha ao comentar revisão fallback na PR.",
      );
      if (Result.isError(fallbackCommentResult))
         throw fallbackCommentResult.error;
   }

   return {
      outputFile,
      prNumber,
      inlineComments: inlineComments.valid.length,
      skippedInlineComments: inlineComments.skipped.length,
   };
}
