# Project Documentation Workflow

Use para `.github/workflows/project-documentation.yml`.

## Contrato

- Nome do workflow: `Project Documentation`.
- Dispara apos `Release Weekly` bem-sucedido em schedule e manualmente via `workflow_dispatch`.
- `dry_run=true` gera docs sem abrir PR.
- `project_name` default: `Montte`.
- Saida principal: `docs/project/*.md`.

## Coleta de contexto

O workflow deve produzir `documentation-context.md` com:

- repositorio, ref atual e tag base anterior;
- estrutura top-level;
- package/project/config files relevantes;
- arquivos alterados desde a release anterior;
- commits recentes;
- PRs mergeados;
- docs existentes.

Nao inclua segredos, valores de env ou conteudo sensivel.

## Geração via opencode

O prompt inline deve ser curto e mandar o modelo ler:

- `.agents/skills/docs/SKILL.md`
- `.agents/skills/docs/references/domain-docs.md`
- `.agents/skills/docs/references/documentation-style.md`
- `.agents/skills/docs/references/docs-validation.md`

Env esperado:

- `CONTEXT_FILE=documentation-context.md`
- `OUTPUT_DIR=docs/project`
- `PROJECT_NAME`
- `RELEASE_VERSION`

O modelo deve escrever somente arquivos dentro de `$OUTPUT_DIR`.

## PR automatico

- Branch: `automation/project-docs-YYYY.MM.DD`.
- Commit: `docs: update project documentation`.
- PR deve explicar que a documentacao foi gerada junto ao ciclo de release.
- Se nao houver diff staged, sair sem erro.
