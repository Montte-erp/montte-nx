import type { FlueContext } from "@flue/runtime";
import { local } from "@flue/runtime/node";
import { Result, TaggedError } from "better-result";
import { readFile, writeFile } from "node:fs/promises";
import { z } from "zod";
import { runOpenCodeGo } from "../lib/opencode-go.ts";

export const triggers = {};

const prPayloadSchema = z.object({
   prNumber: z.number().optional(),
   repo: z.string().optional(),
   outputFile: z.string().default("PR_REVIEW.md"),
});

type FlueHarness = Awaited<ReturnType<FlueContext["init"]>>;
type FlueSession = Awaited<ReturnType<FlueHarness["session"]>>;

class PrReviewAgentError extends TaggedError("PrReviewAgentError")<{
   message: string;
   cause?: unknown;
}>() {}

async function runRequiredCommand(
   session: FlueSession,
   command: string,
   failureMessage: string,
) {
   const commandResult = await Result.tryPromise({
      try: () => session.shell(command),
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
      outputFile,
   } = parsedPayload.data;
   const prNumber = payloadPrNumber ?? Number(env.PR_NUMBER);
   const repo = payloadRepo ?? env.GITHUB_REPOSITORY;

   if (!prNumber || Number.isNaN(prNumber)) {
      throw new PrReviewAgentError({
         message: "Informe prNumber no payload ou PR_NUMBER no ambiente.",
      });
   }

   if (!repo) {
      throw new PrReviewAgentError({
         message: "repo não informado.",
      });
   }

   const harnessResult = await Result.tryPromise({
      try: () =>
         init({
            sandbox: local({
               env: {
                  GH_TOKEN: process.env.GH_TOKEN,
                  OPENCODE_API_KEY: process.env.OPENCODE_API_KEY,
               },
            }),
         }),
      catch: (cause) =>
         new PrReviewAgentError({
            message: "Falha ao inicializar Flue para revisão de PR.",
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
   const contextResult = await Result.tryPromise({
      try: () =>
         Promise.all([
            runRequiredCommand(
               session,
               `gh pr view ${prNumber} --repo ${repo} --json number,title,author,state,isDraft,reviewDecision,additions,deletions,changedFiles,labels,url,body`,
               "Falha ao coletar metadados da PR.",
            ),
            runRequiredCommand(
               session,
               `gh pr files ${prNumber} --repo ${repo} --json path,additions,deletions --jq '.[] | "- " + .path + " (+" + (.additions|tostring) + " -" + (.deletions|tostring) + ")"'`,
               "Falha ao listar arquivos alterados da PR.",
            ),
            runRequiredCommand(
               session,
               `gh pr diff ${prNumber} --repo ${repo}`,
               "Falha ao coletar diff da PR.",
            ),
            runRequiredCommand(
               session,
               `gh pr view ${prNumber} --repo ${repo} --json commits --jq '.commits[].message'`,
               "Falha ao coletar commits da PR.",
            ),
            runRequiredCommand(
               session,
               `gh pr checks ${prNumber} --repo ${repo} --json name,status,conclusion || true`,
               "Falha ao coletar checks da PR.",
            ),
            runRequiredCommand(
               session,
               `gh pr view ${prNumber} --repo ${repo} --json reviews --jq '.reviews[] | "- " + .state + " - " + .author.login + " - " + .body'`,
               "Falha ao coletar reviews da PR.",
            ),
            runRequiredCommand(
               session,
               `gh api repos/${repo}/pulls/${prNumber}/comments --paginate --jq '.[] | "- " + .path + ":" + ((.line // 0)|tostring) + " - " + .user.login + " - " + .body'`,
               "Falha ao coletar comentários inline da PR.",
            ),
            runRequiredCommand(
               session,
               `gh api repos/${repo}/issues/${prNumber}/comments --paginate --jq '.[] | "- " + .user.login + " - " + .body'`,
               "Falha ao coletar comentários gerais da PR.",
            ),
            readFile("AGENTS.md", "utf8"),
            readFile(".agents/skills/code-review/SKILL.md", "utf8"),
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
Você está rodando dentro de um agente Flue no repositório Montte.
Siga obrigatoriamente o AGENTS.md e a skill correta carregada abaixo.

AGENTS.md:
${agentInstructions}

Skill de code review:
${skillInstruction}

Contexto:
${context}

Escreva em pt-BR:
- bloqueadores claros
- pontos de ajuste
- pontos validados
- riscos
- validação recomendada (comandos reais do repositório)

Retorne somente o Markdown do comentário, sem fences e sem explicações externas.
Seja direto, objetivo e não invente fatos fora do contexto.
`.trim();

   const output = await runOpenCodeGo(prompt);
   if (Result.isError(output)) throw output.error;

   const writeResult = await Result.tryPromise({
      try: () => writeFile(outputFile, output.value),
      catch: (cause) =>
         new PrReviewAgentError({
            message: "Falha ao escrever PR_REVIEW.md.",
            cause,
         }),
   });
   if (Result.isError(writeResult)) throw writeResult.error;

   const commentResult = await runRequiredCommand(
      session,
      `gh pr comment ${prNumber} --repo ${repo} --body-file ${outputFile}`,
      "Falha ao comentar revisão na PR.",
   );
   if (Result.isError(commentResult)) throw commentResult.error;

   return {
      outputFile,
      prNumber,
   };
}
