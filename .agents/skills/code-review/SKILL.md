---
name: code-review
description: Workflow de code review do Montte para revisar PRs, comments, bugs reportados, diffs e achados de CI. Use ao analisar ou aplicar findings de review em apps, modules, core, packages, tooling, docs ou workflows.
---

# Code Review

Use esta skill para reviews no Montte. O objetivo e separar achado vivo de comentario stale, corrigir so o que ainda vale e fechar com validacao proporcional.

Reviews devem ser adversariais sem virar gerador de ruido: ataque o patch com lentes diferentes, tente refutar cada achado e publique/corrija somente o que sobrevive com evidencia concreta.

## Regra principal

Sempre verifique o codigo atual antes de aceitar um finding. Review comment, log antigo, diff de PR e memoria podem estar stale.

Para cada item:

1. Localize o trecho atual com `rg`, `git diff`, `git show` ou leitura direta.
2. Classifique: `valido`, `stale`, `duplicado`, `nao reproduz`, `parcial` ou `fora de escopo`.
3. Corrija apenas itens `validos` ou a parte validada de itens `parciais`.
4. Mantenha o patch ancorado no arquivo/fluxo citado.
5. Valide com comando focado e `git diff --check`.
6. No fechamento, informe itens corrigidos, itens pulados com motivo curto e validacoes executadas.

## Loop adversarial

Use este loop em PRs, diffs grandes, areas sensiveis ou quando a primeira leitura parecer facil demais:

1. Declare a intencao do patch: que comportamento ele tenta entregar e quais contratos nao pode quebrar.
2. Leia contexto suficiente para revisar interacoes, nao so linhas adicionadas.
3. Rode as lentes em separado:
   - `Quebra producao`: entradas ruins, concorrencia, idempotencia, falhas externas, nulos, datas, dinheiro e estados impossiveis.
   - `Contrato Montte`: ownership, oRPC, Drizzle, TanStack, Better Result, URL state, pt-BR, module boundaries e regras da skill aberta.
   - `Seguranca e dados`: auth, permissao, dados sensiveis em log/UI/API, injection, secrets, escopo de organizacao/time.
   - `Minimalista`: mudanca desnecessaria, helper/barrel/repository novo, fallback silencioso, abstracao ampla, teste que prova pouco.
4. Para cada candidato, faca a pergunta de refutacao: "que evidencia no codigo atual prova que isto e real?".
5. Promova apenas achados confirmados por evidencia forte ou por mais de uma lente. Rebaixe/descarta suposicoes, estilo e preferencias.
6. Quando for `review-fix`, corrija so `critical`, `major` e `minor` validos; disputed/deferred viram observacao curta ou issue separada quando pedido.

Nao force findings. Se uma lente nao achou bug real, registre a premissa mais fragil no summary, nao invente comentario inline.

## Roteamento

Leia somente as referencias envolvidas:

- Review comments, PR diff, stale findings, reports de bug: [review-comments](references/review-comments.md).
- UI, forms, tabelas, rotas, layout, a11y, copy de produto: [frontend-ui](references/frontend-ui.md).
- Routers oRPC, contratos, dominio, banco, Drizzle, financeiro: [backend-domain](references/backend-domain.md).
- Jobs, workflows, filas, CI, release, runtime operacional: [ops-workflows](references/ops-workflows.md).
- Testes unitarios, E2E, fixtures, validacao e flakiness: [tests-validation](references/tests-validation.md).
- AI agents, chat, AG-UI, tool calls, telemetry e PostHog: [ai-runtime](references/ai-runtime.md).
- Review de Pull Request acionado por `/review`, com comentarios inline: [pr-review](references/pr-review.md).
- Loop adversarial, refutacao e promocao de achados: [adversarial-review](references/adversarial-review.md).

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
