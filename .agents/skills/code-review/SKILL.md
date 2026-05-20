---
name: code-review
description: Workflow de code review do Montte para revisar PRs, comments, bugs reportados, diffs e achados de CI. Use ao analisar ou aplicar findings de review em apps, modules, core, packages, tooling, docs ou workflows.
---

# Code Review

Use esta skill para reviews no Montte. O objetivo e separar achado vivo de comentario stale, corrigir so o que ainda vale e fechar com validacao proporcional.

## Regra principal

Sempre verifique o codigo atual antes de aceitar um finding. Review comment, log antigo, diff de PR e memoria podem estar stale.

Para cada item:

1. Localize o trecho atual com `rg`, `git diff`, `git show` ou leitura direta.
2. Classifique: `valido`, `stale`, `duplicado`, `nao reproduz`, `parcial` ou `fora de escopo`.
3. Corrija apenas itens `validos` ou a parte validada de itens `parciais`.
4. Mantenha o patch ancorado no arquivo/fluxo citado.
5. Valide com comando focado e `git diff --check`.
6. No fechamento, informe itens corrigidos, itens pulados com motivo curto e validacoes executadas.

## Roteamento

Leia somente as referencias envolvidas:

- Review comments, PR diff, stale findings, reports de bug: [review-comments](references/review-comments.md).
- UI, forms, tabelas, rotas, layout, a11y, copy de produto: [frontend-ui](references/frontend-ui.md).
- Routers oRPC, contratos, dominio, banco, Drizzle, financeiro: [backend-domain](references/backend-domain.md).
- Jobs, workflows, filas, CI, release, runtime operacional: [ops-workflows](references/ops-workflows.md).
- Testes unitarios, E2E, fixtures, validacao e flakiness: [tests-validation](references/tests-validation.md).
- AI agents, chat, AG-UI, tool calls, telemetry e PostHog: [ai-runtime](references/ai-runtime.md).

Se a tarefa envolve codigo em `apps/`, `modules/`, `core/`, `packages/` ou `tooling/`, abra tambem [implementation](../implementation/SKILL.md) e suas referencias pertinentes.

Se a tarefa e principalmente visual/produto, abra tambem [design](../design/SKILL.md).

## Nao fazer

- Nao aplicar review comment mecanicamente sem checar o arquivo atual.
- Nao transformar batch de findings em refactor geral.
- Nao criar helper, wrapper, barrel, repository layer ou fallback silencioso para satisfazer nit.
- Nao mudar comportamento/copy alem do item validado.
- Nao editar `apps/web/src/routeTree.gen.ts`, exceto para restaurar ruido gerado quando necessario.
- Nao esconder falha de validacao; se for ambiente/preexistente, separe isso do patch.

## Formato de resposta em reviews

Findings primeiro quando a entrega for review-only. Para review-fix, feche com:

- `Corrigido`: lista curta dos itens vivos.
- `Pulados`: stale/duplicado/nao reproduzido/fora de escopo, com uma frase.
- `Validacao`: comandos executados e resultado.
