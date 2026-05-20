# Release Validation

Use antes de publicar ou fechar qualquer tarefa de release.

## Release notes

Checks minimos:

```bash
test -s RELEASE_NOTES.md
grep -Eiq '(^|[^[:alnum:]_])TODO([^[:alnum:]_]|$)|!\[Demo\]|\(TODO|link se existir|senão TODO' RELEASE_NOTES.md && exit 1
head -n 1 RELEASE_NOTES.md | grep -Eq '^# +Montte ' && exit 1
```

O regex de `TODO` precisa tratar `TODO` como token. Nao use `TODO` solto, porque falha em palavras como `todos`.

## Workflow edits

Rode:

```bash
git diff --check -- .github/workflows/release-weekly.yml .github/workflows/blog-post-from-release.yml .agents/skills/release
```

Se arquivos novos ainda estiverem untracked, use `git add -N` antes do `git diff --check`.

## Publicacao

Para release publicada:

```bash
gh release view vYYYY.MM.DD --json tagName,name,url,publishedAt
```

Para Linear release, confira que a mutation retornou `.data.releaseCreate.success == true` ou que o workflow registrou falha clara.

## Blog

```bash
bun run landing:build
```

Se o ambiente nao permite install/build, reporte isso separadamente de erros do patch.
