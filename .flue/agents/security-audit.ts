import type { FlueContext } from "@flue/runtime";
import { Result, TaggedError } from "better-result";
import { mkdir, readFile, writeFile } from "node:fs/promises";
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

class SecurityAuditAgentError extends TaggedError("SecurityAuditAgentError")<{
   message: string;
   cause?: unknown;
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
         message: "Payload inválido para agente de security audit.",
         cause: parsedPayload.issues,
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
         message: "Informe prNumber no payload ou PR_NUMBER no ambiente.",
      });
   }

   if (!repoResult.success) {
      throw new SecurityAuditAgentError({
         message: "repo inválido ou não informado.",
         cause: repoResult.issues,
      });
   }

   const repo = repoResult.output;

   const outputDirResult = await Result.tryPromise({
      try: () => mkdir(outputDir, { recursive: true }),
      catch: (cause) =>
         new SecurityAuditAgentError({
            message: "Falha ao criar diretório de artefatos de security audit.",
            cause,
         }),
   });
   if (Result.isError(outputDirResult)) throw outputDirResult.error;

   const contextResult = await Result.tryPromise({
      try: () =>
         Promise.all([
            readPreparedContext(
               `${contextDir}/pr-metadata.json`,
               "Falha ao ler metadados preparados da PR.",
               (message, cause) =>
                  new SecurityAuditAgentError({ message, cause }),
            ),
            readPreparedContext(
               `${contextDir}/changed-files.md`,
               "Falha ao ler lista preparada de arquivos da PR.",
               (message, cause) =>
                  new SecurityAuditAgentError({ message, cause }),
            ),
            readPreparedContext(
               `${contextDir}/pr.patch`,
               "Falha ao ler diff preparado da PR.",
               (message, cause) =>
                  new SecurityAuditAgentError({ message, cause }),
            ),
            readPreparedContext(
               `${contextDir}/commits.md`,
               "Falha ao ler commits preparados da PR.",
               (message, cause) =>
                  new SecurityAuditAgentError({ message, cause }),
            ),
            readPreparedContext(
               `${contextDir}/checks.json`,
               "Falha ao ler checks preparados da PR.",
               (message, cause) =>
                  new SecurityAuditAgentError({ message, cause }),
            ),
            readFile("AGENTS.md", "utf8"),
            readFile(".agents/skills/implementation/SKILL.md", "utf8"),
            readFile(".agents/skills/security-audit/SKILL.md", "utf8"),
            readFile(
               ".agents/skills/security-audit/references/methodology.md",
               "utf8",
            ),
            readFile(
               ".agents/skills/security-audit/references/finding-validation.md",
               "utf8",
            ),
            readFile(
               ".agents/skills/security-audit/references/montte-attack-surface.md",
               "utf8",
            ),
            readFile(
               ".agents/skills/security-audit/references/github-actions-security.md",
               "utf8",
            ),
            readFile(
               ".agents/skills/security-audit/references/report-schema.md",
               "utf8",
            ),
         ]),
      catch: (cause) =>
         new SecurityAuditAgentError({
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
      agentInstructions,
      implementationSkill,
      securityAuditSkill,
      methodologyReference,
      findingValidationReference,
      montteAttackSurfaceReference,
      githubActionsSecurityReference,
      reportSchemaReference,
   ] = contextResult.value;

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

   await writeFile(
      `${outputDir}/prompt-context-size.json`,
      JSON.stringify(
         {
            fullDiff: fullDiff.value.stdout.length,
            promptFullDiff: promptFullDiff.length,
         },
         null,
         2,
      ),
   );

   const context = `# PR #${prNumber}

## Metadata
${prMetadata.value.stdout}

## Changed files
${changedFiles.value.stdout}

## Full diff
${promptFullDiff}

## Commits
${commits.value.stdout}

## CI checks
${ciChecks.value.stdout}
`;

   const prompt = `Você é o agente de security audit do Montte.
Siga obrigatoriamente AGENTS.md, implementation skill e security-audit skill/references abaixo.

Objetivo: fazer uma auditoria de segurança CI-friendly da PR #${prNumber}, focada em achados reais Medium+.

AGENTS.md:
${agentInstructions}

Implementation skill:
${implementationSkill}

Security audit skill:
${securityAuditSkill}

Reference: methodology
${methodologyReference}

Reference: finding-validation
${findingValidationReference}

Reference: montte-attack-surface
${montteAttackSurfaceReference}

Reference: github-actions-security
${githubActionsSecurityReference}

Reference: report-schema
${reportSchemaReference}

Contexto da PR:
${context}

Tarefa:
- não use ferramentas/read/bash; o repositório não está disponível no sandbox, use apenas o contexto fornecido neste prompt;
- audite o diff e callers/contratos evidentes;
- procure regressões de authz, isolamento org/team, billing/usage, uploads/files, workers/jobs, AI tools, secrets e GitHub Actions;
- tente refutar cada hipótese antes de reportar;
- descarte Low/Info/teórico;
- não invente arquivos, linhas, APIs ou contexto ausente;
- não recomende mudanças genéricas sem finding concreto;
- retorne no máximo 10 findings.

Retorne JSON válido, sem markdown fences, exatamente no schema da reference report-schema.
`.trim();

   const modelHarnessResult = await Result.tryPromise({
      try: () =>
         init({
            name: "security-audit-model",
            sandbox: false,
            model: process.env.FLUE_MODEL ?? DEFAULT_FLUE_MODEL,
         }),
      catch: (cause) =>
         new SecurityAuditAgentError({
            message: "Falha ao inicializar Flue para modelo de security audit.",
            cause,
         }),
   });
   if (Result.isError(modelHarnessResult)) throw modelHarnessResult.error;

   const modelSessionResult = await Result.tryPromise({
      try: () => modelHarnessResult.value.session(),
      catch: (cause) =>
         new SecurityAuditAgentError({
            message: "Falha ao abrir sessão de modelo para security audit.",
            cause,
         }),
   });
   if (Result.isError(modelSessionResult)) throw modelSessionResult.error;

   const outputResult = await Result.tryPromise({
      try: () =>
         Promise.resolve(
            modelSessionResult.value.prompt(prompt, {
               thinkingLevel: "off",
               result: securityAuditResultSchema,
            }),
         ),
      catch: (cause) =>
         new SecurityAuditAgentError({
            message: `Falha ao executar prompt de security audit via Flue: ${formatCause(cause)}`,
            cause,
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
         makeError: (message, cause) =>
            new SecurityAuditAgentError({ message, cause }),
      });
      if (Result.isError(commentResult)) throw commentResult.error;
   }

   if (!dryRun && shouldFailAudit(auditResult.findings, failOn)) {
      throw new SecurityAuditAgentError({
         message: `Security audit encontrou findings >= ${failOn}.`,
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
