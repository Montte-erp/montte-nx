---
name: security-audit
description: Guia auditorias de segurança source-code e PR/diff no Montte, inspiradas em Piolium/Vigolium, com foco em evidência, explorabilidade real e baixa taxa de falso positivo. Use quando o usuário pedir security audit, auditoria de segurança, análise de vulnerabilidades, revisar PR por segurança, threat model, SAST triage, authz/tenant isolation, secrets, GitHub Actions security ou CI security gate.
---

# Security Audit

Use esta skill para auditoria de segurança objetiva. O resultado deve ser pequeno, verificável e acionável.

## Quick start

1. Defina o escopo: PR diff, repo inteiro, workflow GitHub Actions, authz, billing, uploads, AI tools ou worker/jobs.
2. Carregue as referências necessárias:
   - Metodologia geral: `references/methodology.md`
   - Validação/FP/severidade: `references/finding-validation.md`
   - Superfícies específicas do Montte: `references/montte-attack-surface.md`
   - GitHub Actions/CI: `references/github-actions-security.md`
   - JSON/Markdown de saída: `references/report-schema.md`
3. Colete evidência direta: `arquivo:linha`, diff, caller, rota/procedure/job, schema, config e runtime.
4. Mantenha apenas achados Medium/Critical com caminho explorável em produção.

## Regras obrigatórias

- Evidência vence volume. Não reporte hipótese sem `arquivo:linha` e cadeia de execução plausível.
- Todo finding precisa demonstrar: controle do atacante, path alcançável, trust boundary cruzada, impacto e ausência de controle bloqueador.
- Dependência vulnerável só vira finding se o caminho afetado roda no runtime do Montte.
- Não promova robustez, data-loss, DX, observabilidade, admin-only ou test-only para segurança sem quebra real de boundary.
- Descarte Low/Info/teórico no relatório final; cite no máximo como nota interna se útil.
- Antes de reportar, tente refutar o finding usando framework, middleware, ownership checks, DB constraints e validação Zod.
- Mensagens e relatório em pt-BR.

## Modos

### PR/diff audit

Foque linhas alteradas, callers imediatos e contratos tocados. Não audite o mundo inteiro. Priorize regressões de authz, tenant isolation, secrets e workflows.

### Repo/deep audit

Use a sequência Piolium-lite adaptada: recon → threat model → SAST/grep focado → probe manual → FP check → relatório.

### CI gate

Retorne JSON válido conforme `references/report-schema.md`. Falhe apenas a partir do limiar configurado (`high` por padrão). Sempre publique resumo mesmo sem achados.
