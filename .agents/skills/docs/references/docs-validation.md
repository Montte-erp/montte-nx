# Docs Validation

Use antes de fechar alteracoes em docs ou no workflow de documentacao.

## Arquivos obrigatorios

```bash
test ! -e docs/project/PROJECT_DOCUMENTATION.md
for file in platform.md auth-organizations.md finance.md crm-services.md billing.md ai-agents.md frontend.md workflows.md operations.md recent-changes.md; do test -s "docs/project/${file}"; done
```

## Workflow edits

Rode:

```bash
git diff --check -- .github/workflows/project-documentation.yml .agents/skills/docs docs/project
```

Se arquivos novos ainda estiverem untracked, use `git add -N` antes do `git diff --check`.

## Build/schema

Quando docs afetam landing/content ou exemplos de comando:

```bash
bun run landing:build
```

Para mudancas apenas no workflow/skill, `git diff --check` e revisao do YAML sao suficientes.

## Fechamento

Reporte:

- arquivos obrigatorios presentes;
- se `PROJECT_DOCUMENTATION.md` nao existe;
- comandos executados;
- qualquer validacao remota nao executada.
