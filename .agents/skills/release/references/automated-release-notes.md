# Automated Release Notes

Use para desenhar, revisar ou operar action/agente que gera release notes automaticamente.

Esta referencia complementa `release-notes.md`: ela define coleta, validacao, publicacao e recuperacao. As regras de escrita continuam em `release-notes.md`.

## Objetivo

Gerar release notes publicaveis em pt-BR sem transformar detalhes internos em marketing:

- calcular range correto desde a ultima tag `vYYYY.MM.DD`;
- consolidar PRs, commits e autores;
- separar corpo publico de notas tecnicas;
- preservar `dry_run`;
- criar artefatos verificaveis para recuperacao manual;
- publicar tag, GitHub Release e Linear Release somente depois da validacao.

## Pipeline

1. `resolve-version`: definir CalVer `vYYYY.MM.DD` e verificar se tag/release ja existe.
2. `collect-changes`: buscar ultima tag, PRs mergeados, commits e autores.
3. `normalize`: consolidar commits por PR, remover duplicados e classificar por tipo.
4. `generate`: produzir `RELEASE_NOTES.md` seguindo `release-notes.md`.
5. `validate`: checar estrutura, links, secoes vazias, placeholders e linguagem publica.
6. `dry-run`: se habilitado, publicar apenas summary/artifact sem tag/release.
7. `publish`: criar tag, GitHub Release e Linear Release.
8. `recover`: se falhar depois da geracao, seguir `manual-recovery.md`.

## Coleta minima

```bash
git fetch --tags --force
git tag --list 'v*' --sort=-version:refname
git log "$LAST_TAG"..HEAD --pretty=format:'- %s (%h) by %an' > "$CHANGES_FILE"
gh pr list --state merged --base "$BASE_BRANCH" --search "merged:>=$LAST_TAG_DATE" \
  --json number,title,url,author,mergedAt,labels \
  > .release/merged-prs.json
gh release view "$VERSION" --json tagName,url,isDraft,isPrerelease
```

Quando a API de PR nao conseguir mapear por data com confianca, prefira merge commits no range e complete com `gh pr view`.

## Artefatos

- `.release/version.txt`: tag final.
- `.release/last-tag.txt`: base usada.
- `.release/changes.md`: entrada normalizada para geracao.
- `.release/merged-prs.json`: PRs usados.
- `.release/release-notes.md`: corpo final.
- `.release/validation.json`: resultado das checagens.

## Schema de validacao

```json
{
  "version": "v2026.05.25",
  "lastTag": "v2026.05.18",
  "dryRun": true,
  "valid": true,
  "errors": [],
  "warnings": [
    {
      "code": "LOW_PUBLIC_SIGNAL",
      "message": "Poucos itens visiveis ao usuario; conferir se a release deve ser tecnica."
    }
  ],
  "counts": {
    "pullRequests": 12,
    "commits": 31,
    "contributors": 4
  }
}
```

## Gates de qualidade

Falhar antes de publicar quando:

- tag ou GitHub Release ja existe e a execucao nao e recuperacao explicita;
- `RELEASE_NOTES.md` contem `TODO`, placeholder, link ficticio ou H1 duplicado;
- corpo publico destaca refactor, schema, router, oRPC, Drizzle, DBOS ou detalhe interno;
- breaking change nao tem `Quem é afetado` e `O que fazer`;
- PR aparece duplicado em secoes diferentes;
- release notes vazias apesar de haver PRs mergeados.

Gerar warning, nao falha, quando:

- a release e quase toda tecnica;
- ha commits sem PR;
- autores nao puderam ser normalizados;
- Linear Release nao puder ser criada por falta de credencial.

## Prompt de geracao

```text
Voce escreve release notes do Montte em pt-BR. Use a referencia release-notes.md.
Entrada: changes normalizados com commits e PRs. Use PR como unidade canonica.
Fale de valor para usuario no corpo publico. Mova detalhes internos para
<details>. Nao invente links, imagens, features ou impacto. Omita secoes vazias.
Retorne somente o Markdown final de RELEASE_NOTES.md.
```

## Prompt de validacao

```text
Revise o RELEASE_NOTES.md contra release-notes.md. Retorne JSON de validacao.
Procure duplicatas, placeholders, H1 indevido, links ficticios, detalhes internos
no corpo publico, breaking change sem acao e secoes vazias. Nao reescreva o texto
nesta etapa; apenas valide e sugira correcoes pontuais.
```

## Publicacao

- `dry_run=true`: nao criar tag/release; anexar artefatos e summary do workflow.
- `dry_run=false`: criar tag anotada ou lightweight conforme workflow atual, criar GitHub Release e Linear Release.
- Depois de publicar, verificar URL da release e tag remota.
- Se falhar depois de criar tag, nao recriar nada sem verificar estado remoto.

## Fechamento esperado

Relatar:

- range usado;
- versao gerada;
- se foi `dry_run`;
- artefatos criados;
- links de release/Linear quando publicados;
- warnings ou etapas puladas por credencial.
