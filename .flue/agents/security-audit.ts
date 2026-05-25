import type { FlueContext } from "@flue/runtime";
import { local } from "@flue/runtime/node";
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

const failOnSchema = v.picklist(["none", "medium", "high", "critical"]);

const securityAuditPayloadSchema = v.object({
   prNumber: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
   repo: v.optional(safeRepoSchema),
   outputDir: v.optional(safePathSchema, ".security-audit"),
   contextDir: v.optional(
      safePathSchema,
      ".agent-artifacts/security-audit/input",
   ),
   failOn: v.optional(failOnSchema, "high"),
   dryRun: v.optional(v.boolean(), false),
});

const findingSchema = v.object({
   id: v.pipe(v.string(), v.minLength(1)),
   severity: v.picklist(["medium", "high", "critical"]),
   title: v.pipe(v.string(), v.minLength(1)),
   path: v.pipe(v.string(), v.minLength(1)),
   line: v.pipe(v.number(), v.integer(), v.minValue(1)),
   evidence: v.pipe(v.string(), v.minLength(1)),
   attackerControl: v.pipe(v.string(), v.minLength(1)),
   reachablePath: v.pipe(v.string(), v.minLength(1)),
   trustBoundary: v.pipe(v.string(), v.minLength(1)),
   impact: v.pipe(v.string(), v.minLength(1)),
   fix: v.pipe(v.string(), v.minLength(1)),
   confidence: v.picklist(["medium", "high"]),
});

const discardedSchema = v.object({
   title: v.pipe(v.string(), v.minLength(1)),
   reason: v.pipe(v.string(), v.minLength(1)),
});

const securityAuditResultSchema = v.object({
   summary: v.pipe(v.string(), v.minLength(1)),
   riskLevel: v.picklist(["none", "medium", "high", "critical"]),
   findings: v.optional(v.pipe(v.array(findingSchema), v.maxLength(20)), []),
   discarded: v.optional(v.pipe(v.array(discardedSchema), v.maxLength(30)), []),
});

type SecurityAuditResult = v.InferOutput<typeof securityAuditResultSchema>;
type Finding = v.InferOutput<typeof findingSchema>;
type FailOn = v.InferOutput<typeof failOnSchema>;

const securityAuditAgentErrors = defineErrorCatalog(
   "flue.security-audit.agent",
   {
      BAD_PAYLOAD: {
         status: 400,
         message: "Payload inválido para agente de security audit.",
         tags: ["flue", "security-audit"],
      },
      MISSING_INPUT: {
         status: 400,
         message: "Entrada obrigatória ausente para security audit.",
         tags: ["flue", "security-audit"],
      },
      IO_FAILED: {
         status: 500,
         message: "Falha de IO no agente de security audit.",
         tags: ["flue", "security-audit"],
      },
      MODEL_FAILED: {
         status: 500,
         message: "Falha ao executar modelo de security audit.",
         tags: ["flue", "security-audit"],
      },
      GATE_FAILED: {
         status: 422,
         message: "Security audit encontrou findings bloqueantes.",
         tags: ["flue", "security-audit"],
      },
   },
);

declare module "evlog" {
   interface RegisteredErrorCatalogs {
      "flue.security-audit.agent": typeof securityAuditAgentErrors;
   }
}

type SecurityAuditAgentCatalogError =
   | ReturnType<typeof securityAuditAgentErrors.BAD_PAYLOAD>
   | ReturnType<typeof securityAuditAgentErrors.MISSING_INPUT>
   | ReturnType<typeof securityAuditAgentErrors.IO_FAILED>
   | ReturnType<typeof securityAuditAgentErrors.MODEL_FAILED>
   | ReturnType<typeof securityAuditAgentErrors.GATE_FAILED>;

class SecurityAuditAgentError extends TaggedError("SecurityAuditAgentError")<{
   error: SecurityAuditAgentCatalogError;
   message: string;
   repo?: string;
   prNumber?: number;
   outputFile?: string;
   detail?: string;
}>() {}

function severityRank(severity: FailOn | Finding["severity"]) {
   return ["none", "medium", "high", "critical"].indexOf(severity);
}

function shouldFailAudit(findings: Finding[], failOn: FailOn) {
   if (failOn === "none") return false;
   return findings.some(
      (finding) => severityRank(finding.severity) >= severityRank(failOn),
   );
}

function formatFinding(finding: Finding) {
   return `### ${finding.id} — ${finding.title}

- **Severidade:** ${finding.severity}
- **Local:** \`${finding.path}:${finding.line}\`
- **Confiança:** ${finding.confidence}
- **Evidência:** ${finding.evidence}
- **Controle do atacante:** ${finding.attackerControl}
- **Path alcançável:** ${finding.reachablePath}
- **Boundary:** ${finding.trustBoundary}
- **Impacto:** ${finding.impact}
- **Correção mínima:** ${finding.fix}`;
}

function formatMarkdownReport(result: SecurityAuditResult, failOn: FailOn) {
   const findings =
      result.findings.length > 0
         ? result.findings.map(formatFinding).join("\n\n")
         : "Nenhum achado Medium+ confirmado.";

   const discarded =
      result.discarded.length > 0
         ? result.discarded
              .map((item) => `- **${item.title}:** ${item.reason}`)
              .join("\n")
         : "Nenhuma hipótese relevante descartada.";

   return `## Security Audit

**Risco:** ${result.riskLevel}
**Gate:** falha a partir de ${failOn}

${result.summary}

## Achados

${findings}

## Hipóteses descartadas

${discarded}
`;
}

export default async function ({ init, payload, env }: FlueContext) {
   const parsedPayload = v.safeParse(securityAuditPayloadSchema, payload);
   if (!parsedPayload.success) {
      throw new SecurityAuditAgentError({
         error: securityAuditAgentErrors.BAD_PAYLOAD(),
         message: "Payload inválido para agente de security audit.",
         detail: formatCause(parsedPayload.issues),
      });
   }

   const {
      prNumber: payloadPrNumber,
      repo: payloadRepo,
      outputDir,
      contextDir,
      failOn,
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
   const githubToken = resolveGithubToken(env);

   if (!prNumber || Number.isNaN(prNumber)) {
      throw new SecurityAuditAgentError({
         error: securityAuditAgentErrors.MISSING_INPUT(),
         message: "Informe prNumber no payload ou PR_NUMBER no ambiente.",
      });
   }

   if (!repoResult.success) {
      throw new SecurityAuditAgentError({
         error: securityAuditAgentErrors.BAD_PAYLOAD(),
         message: "repo inválido ou não informado.",
         prNumber,
         detail: formatCause(repoResult.issues),
      });
   }

   const repo = repoResult.output;

   const outputDirResult = await Result.tryPromise({
      try: () => mkdir(outputDir, { recursive: true }),
      catch: (cause) =>
         new SecurityAuditAgentError({
            error: securityAuditAgentErrors.IO_FAILED(),
            message: "Falha ao criar diretório de artefatos de security audit.",
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
         ]),
      catch: (cause) =>
         new SecurityAuditAgentError({
            error: securityAuditAgentErrors.IO_FAILED(),
            message: "Falha ao coletar contexto da PR ou carregar skill.",
            detail: formatCause(cause),
         }),
   });
   if (Result.isError(contextResult)) throw contextResult.error;

   const [prMetadata, changedFiles, fullDiff, commits, ciChecks] =
      contextResult.value;

   const commandResults = [
      prMetadata,
      changedFiles,
      fullDiff,
      commits,
      ciChecks,
   ];
   const failedCommand = commandResults.find(Result.isError);
   if (failedCommand) throw failedCommand.error;

   await Promise.all([
      writeFile(`${outputDir}/pr-metadata.json`, prMetadata.value.stdout),
      writeFile(`${outputDir}/changed-files.md`, changedFiles.value.stdout),
      writeFile(`${outputDir}/pr.patch`, fullDiff.value.stdout),
      writeFile(`${outputDir}/commits.md`, commits.value.stdout),
      writeFile(`${outputDir}/checks.json`, ciChecks.value.stdout),
   ]);

   const promptFullDiff = truncateForPrompt(
      fullDiff.value.stdout,
      180_000,
      "Full diff",
   );

   const promptContextSize = {
      fullDiff: fullDiff.value.stdout.length,
      promptFullDiff: promptFullDiff.length,
   };

   await writeFile(
      `${outputDir}/prompt-context-size.json`,
      JSON.stringify(promptContextSize, null, 2),
   );

   const task = `Audite a PR #${prNumber} usando a skill de security audit do Montte. Use apenas o contexto pré-coletado em args. Não rode comandos nem colete dados pelo GitHub. Foque em achados reais Medium+ e tente refutar hipóteses antes de reportar.`;

   const modelHarnessResult = await Result.tryPromise({
      try: () =>
         init({
            name: "security-audit-model",
            // local() lets Flue discover AGENTS.md and .agents/skills from cwd.
            // GitHub writes stay on the host through Octokit; tokens are not
            // exposed to the sandbox env and we do not collect context with gh.
            sandbox: local({ env: {} }),
            model: process.env.FLUE_MODEL ?? DEFAULT_FLUE_MODEL,
         }),
      catch: (cause) =>
         new SecurityAuditAgentError({
            error: securityAuditAgentErrors.MODEL_FAILED(),
            message: "Falha ao inicializar Flue para modelo de security audit.",
            repo,
            prNumber,
            detail: formatCause(cause),
         }),
   });
   if (Result.isError(modelHarnessResult)) throw modelHarnessResult.error;

   const modelSessionResult = await Result.tryPromise({
      try: () => modelHarnessResult.value.session(),
      catch: (cause) =>
         new SecurityAuditAgentError({
            error: securityAuditAgentErrors.MODEL_FAILED(),
            message: "Falha ao abrir sessão de modelo para security audit.",
            repo,
            prNumber,
            detail: formatCause(cause),
         }),
   });
   if (Result.isError(modelSessionResult)) throw modelSessionResult.error;

   const outputResult = await Result.tryPromise({
      try: () =>
         Promise.resolve(
            modelSessionResult.value.skill("security-audit", {
               args: {
                  task,
                  repo,
                  prNumber,
                  failOn,
                  prMetadata: prMetadata.value.stdout,
                  changedFiles: changedFiles.value.stdout,
                  patch: promptFullDiff,
                  commits: commits.value.stdout,
                  checks: ciChecks.value.stdout,
                  promptContextSize,
               },
               thinkingLevel: "off",
               result: securityAuditResultSchema,
            }),
         ),
      catch: (cause) =>
         new SecurityAuditAgentError({
            error: securityAuditAgentErrors.MODEL_FAILED(),
            message: `Falha ao executar skill de security audit via Flue: ${formatCause(cause)}`,
            repo,
            prNumber,
            detail: formatCause(cause),
         }),
   });
   if (Result.isError(outputResult)) throw outputResult.error;

   const auditResult = outputResult.value.data;

   const jsonOutputFile = `${outputDir}/security-audit.json`;
   const markdownOutputFile = `${outputDir}/SECURITY_AUDIT.md`;
   const markdown = formatMarkdownReport(auditResult, failOn);

   await Promise.all([
      writeFile(jsonOutputFile, JSON.stringify(auditResult, null, 2)),
      writeFile(markdownOutputFile, markdown),
   ]);

   if (!dryRun) {
      const commentResult = await publishIssueComment({
         repo,
         prNumber,
         body: markdown,
         token: githubToken,
      });
      if (Result.isError(commentResult)) throw commentResult.error;
   }

   if (!dryRun && shouldFailAudit(auditResult.findings, failOn)) {
      throw new SecurityAuditAgentError({
         error: securityAuditAgentErrors.GATE_FAILED(),
         message: `Security audit encontrou findings >= ${failOn}.`,
         repo,
         prNumber,
      });
   }

   return {
      outputFile: markdownOutputFile,
      jsonOutputFile,
      prNumber,
      findings: auditResult.findings.length,
      riskLevel: auditResult.riskLevel,
      failOn,
      dryRun,
   };
}
