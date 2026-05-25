import type { FlueContext } from "@flue/runtime";
import { Octokit } from "@octokit/core";
import { Result, TaggedError } from "better-result";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { z } from "zod";
import { DEFAULT_FLUE_MODEL } from "../lib/model.ts";

export const triggers = {};

const severitySchema = z.enum(["medium", "high", "critical"]);
const riskLevelSchema = z.enum(["none", "medium", "high", "critical"]);
const failOnSchema = z.enum(["none", "medium", "high", "critical"]);

const securityAuditPayloadSchema = z.object({
   prNumber: z.number().optional(),
   repo: z
      .string()
      .regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u)
      .optional(),
   outputDir: z.string().default(".security-audit"),
   contextDir: z.string().default(".agent-artifacts/security-audit/input"),
   failOn: failOnSchema.default("high"),
});

const findingSchema = z.object({
   id: z.string().min(1),
   severity: severitySchema,
   title: z.string().min(1),
   path: z.string().min(1),
   line: z.number().int().positive(),
   evidence: z.string().min(1),
   attackerControl: z.string().min(1),
   reachablePath: z.string().min(1),
   trustBoundary: z.string().min(1),
   impact: z.string().min(1),
   fix: z.string().min(1),
   confidence: z.enum(["medium", "high"]),
});

const discardedSchema = z.object({
   title: z.string().min(1),
   reason: z.string().min(1),
});

const securityAuditResultSchema = z.object({
   summary: z.string().min(1),
   riskLevel: riskLevelSchema,
   findings: z.array(findingSchema).max(20).default([]),
   discarded: z.array(discardedSchema).max(30).default([]),
});

type SecurityAuditResult = z.infer<typeof securityAuditResultSchema>;
type Finding = z.infer<typeof findingSchema>;
type FailOn = z.infer<typeof failOnSchema>;

class SecurityAuditAgentError extends TaggedError("SecurityAuditAgentError")<{
   message: string;
   cause?: unknown;
}>() {}

async function readPreparedContext(filePath: string, failureMessage: string) {
   return Result.tryPromise({
      try: async () => ({
         stdout: await readFile(filePath, "utf8"),
         stderr: "",
         exitCode: 0,
      }),
      catch: (cause) =>
         new SecurityAuditAgentError({
            message: failureMessage,
            cause,
         }),
   });
}

function truncateForPrompt(value: string, maxChars: number, label: string) {
   if (value.length <= maxChars) return value;

   return `${value.slice(0, maxChars)}\n\n[${label} truncado: ${value.length} caracteres totais; exibindo primeiros ${maxChars}. Consulte o artefato completo para validação.]`;
}

function formatCause(cause: unknown) {
   if (cause instanceof Error) return cause.stack ?? cause.message;
   if (typeof cause === "string") return cause;

   try {
      return JSON.stringify(cause);
   } catch {
      return String(cause);
   }
}

async function publishIssueComment({
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
         new SecurityAuditAgentError({
            message: "GH_TOKEN não configurado no ambiente.",
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
         new SecurityAuditAgentError({
            message: "Falha ao publicar comentário no GitHub.",
            cause,
         }),
   });
}

function parseSecurityAuditResult(raw: string) {
   const trimmed = raw.trim();
   const withoutFence = trimmed
      .replace(/^```(?:json)?\s*/u, "")
      .replace(/\s*```$/u, "");

   const jsonResult = Result.try({
      try: () => JSON.parse(withoutFence),
      catch: (cause) =>
         new SecurityAuditAgentError({
            message: "Resposta do security audit não é JSON válido.",
            cause,
         }),
   });
   if (Result.isError(jsonResult)) return Result.err(jsonResult.error);

   const parsed = securityAuditResultSchema.safeParse(jsonResult.value);
   if (!parsed.success) {
      return Result.err(
         new SecurityAuditAgentError({
            message: "Resposta do security audit não segue o schema esperado.",
            cause: parsed.error,
         }),
      );
   }

   return Result.ok(parsed.data);
}

function severityRank(severity: FailOn | z.infer<typeof severitySchema>) {
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
   const parsedPayload = securityAuditPayloadSchema.safeParse(payload);
   if (!parsedPayload.success) {
      throw new SecurityAuditAgentError({
         message: "Payload inválido para agente de security audit.",
         cause: parsedPayload.error,
      });
   }

   const {
      prNumber: payloadPrNumber,
      repo: payloadRepo,
      outputDir,
      contextDir,
      failOn,
   } = parsedPayload.data;
   const prNumber = payloadPrNumber ?? Number(env.PR_NUMBER);
   const repo = payloadRepo ?? env.GITHUB_REPOSITORY;
   const githubToken =
      env.GH_TOKEN ??
      env.GITHUB_TOKEN ??
      process.env.GH_TOKEN ??
      process.env.GITHUB_TOKEN;

   if (!prNumber || Number.isNaN(prNumber)) {
      throw new SecurityAuditAgentError({
         message: "Informe prNumber no payload ou PR_NUMBER no ambiente.",
      });
   }

   if (!repo || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(repo)) {
      throw new SecurityAuditAgentError({
         message: "repo inválido ou não informado.",
      });
   }

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
            modelSessionResult.value.prompt(prompt, { thinkingLevel: "off" }),
         ),
      catch: (cause) =>
         new SecurityAuditAgentError({
            message: `Falha ao executar prompt de security audit via Flue: ${formatCause(cause)}`,
            cause,
         }),
   });
   if (Result.isError(outputResult)) throw outputResult.error;

   const auditResult = parseSecurityAuditResult(outputResult.value.text);
   if (Result.isError(auditResult)) throw auditResult.error;

   const jsonOutputFile = `${outputDir}/security-audit.json`;
   const markdownOutputFile = `${outputDir}/SECURITY_AUDIT.md`;
   const markdown = formatMarkdownReport(auditResult.value, failOn);

   await Promise.all([
      writeFile(jsonOutputFile, JSON.stringify(auditResult.value, null, 2)),
      writeFile(markdownOutputFile, markdown),
   ]);

   const commentResult = await publishIssueComment({
      repo,
      prNumber,
      body: markdown,
      token: githubToken,
   });
   if (Result.isError(commentResult)) throw commentResult.error;

   if (shouldFailAudit(auditResult.value.findings, failOn)) {
      throw new SecurityAuditAgentError({
         message: `Security audit encontrou findings >= ${failOn}.`,
      });
   }

   return {
      outputFile: markdownOutputFile,
      jsonOutputFile,
      prNumber,
      findings: auditResult.value.findings.length,
      riskLevel: auditResult.value.riskLevel,
      failOn,
   };
}
