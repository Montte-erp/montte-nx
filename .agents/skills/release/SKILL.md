---
name: release
description: Workflow de release do Montte para release weekly, release notes, GitHub tag/release, Linear release, recuperacao manual e post de blog pos-release. Use ao alterar .github/workflows/release-weekly.yml, blog-post-from-release.yml, notes, tags vYYYY.MM.DD ou automacoes de release.
---

# Release

Use esta skill para qualquer trabalho de release do Montte. O workflow deve executar; a regra de produto, escrita e recuperacao vive aqui.

## Regra principal

Verifique o estado atual antes de agir: workflow, tag, release no GitHub, branch base e artefatos podem ter mudado.

Para cada tarefa:

1. Leia o workflow ou artefato atual.
2. Confirme a tag CalVer (`vYYYY.MM.DD`) e o range desde a ultima tag.
3. Preserve `dry_run` quando a tarefa for de geracao.
4. Mantenha release notes em pt-BR, orientadas a valor de usuario.
5. Separe corpo publico de notas tecnicas em `<details>`.
6. Valide notes, tags, GitHub release, Linear release e PR de blog conforme o caminho usado.

## Roteamento

Leia somente as referencias envolvidas:

- Workflow semanal, cron, inputs, coleta de commits/PRs, tag e Linear release: [weekly-workflow](references/weekly-workflow.md).
- Prompt e regras para gerar `RELEASE_NOTES.md`: [release-notes](references/release-notes.md).
- Agente/action automatico para gerar, validar e publicar release notes: [automated-release-notes](references/automated-release-notes.md).
- Recuperacao quando notes existem mas tag/release falhou: [manual-recovery](references/manual-recovery.md).
- Post de blog criado a partir da release publicada: use [marketing](../marketing/SKILL.md) com [release-post](../marketing/references/release-post.md).
- Validacoes e checklist antes de fechar release: [release-validation](references/release-validation.md).

Se alterar YAML, scripts ou automacoes em `.github/`, leia tambem [implementation](../implementation/SKILL.md).

## Nao fazer

- Nao deixar prompt longo inline no workflow quando ele pertence a esta skill.
- Nao publicar release notes com `TODO`, link ficticio, imagem placeholder ou H1 duplicando o titulo.
- Nao destacar refactor, barrel, repository, router interno, schema, oRPC, Drizzle, DBOS ou modulo no corpo publico.
- Nao criar tag/release manual sem verificar antes se ela ja existe.
- Nao converter horario de cron silenciosamente quando a decisao esperada e horario observado no Brasil.
- Nao varrer alteracoes nao relacionadas na recuperacao manual.
- Nao manter regra de escrita de blog dentro da skill de release; isso pertence a [marketing](../marketing/SKILL.md).

## Fechamento

Informe:

- arquivos de workflow/skill alterados;
- se o prompt foi movido para referencia;
- validacoes executadas;
- qualquer etapa remota nao executada por falta de rede/credencial.
