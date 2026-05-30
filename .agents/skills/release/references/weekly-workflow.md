# Weekly Release Workflow

Use para `.github/workflows/release-weekly.yml`.

## Contrato

- Nome do workflow: `Release Weekly`.
- Produto unico: `apps/web`.
- Versao CalVer: `YYYY.MM.DD`.
- Tag: `vYYYY.MM.DD`.
- Agendamento atual: sexta-feira com `cron: "0 14 * * 5"`. Antes de mudar, confirme se a intencao e preservar o horario literal observado no Brasil.
- `workflow_dispatch.dry_run` deve continuar gerando notes sem criar tag/release.

## Fluxo esperado

1. Checkout com historico e tags (`fetch-depth: 0`, `fetch-tags: true`).
2. Computa `VERSION`, `TAG`, `LAST_TAG` e `skip` se tag ja existe.
3. Coleta commits e PRs mergeados desde `LAST_TAG` em `changes.md`.
4. Gera `RELEASE_NOTES.md` lendo [release-notes](release-notes.md).
5. Verifica notes com [release-validation](release-validation.md).
6. Cria GitHub release com `gh release create "$TAG" --target "$GITHUB_SHA" --title "Montte $VERSION" --notes-file RELEASE_NOTES.md`.
7. Sobe artefatos (`changes.md`, `RELEASE_NOTES.md`).

## Como implementar prompt no workflow

Mantenha o prompt inline curto. O workflow deve passar:

- `CHANGES_FILE=changes.md`
- `OUTPUT_FILE=RELEASE_NOTES.md`
- `RELEASE_VERSION`
- `SKILL_FILE=.agents/skills/release/SKILL.md`
- `RELEASE_NOTES_REFERENCE=.agents/skills/release/references/release-notes.md`
- `VALIDATION_REFERENCE=.agents/skills/release/references/release-validation.md`

O prompt deve mandar o modelo ler esses arquivos e escrever somente `$OUTPUT_FILE`.

## Riscos conhecidos

- `TODO` solto deve ser detectado, mas palavras portuguesas como `todos` nao podem falhar a validacao.
- Se notes sao geradas e a etapa de tag/release falha, aplique [manual-recovery](manual-recovery.md).
- Falhas de `gh` por DNS/API devem ser tratadas como problema externo e revalidadas depois.
