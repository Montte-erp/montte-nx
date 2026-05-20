---
name: docs
description: Workflow de documentacao tecnica do Montte para gerar e manter docs/project por dominio, atualizar .github/workflows/project-documentation.yml e orientar agentes a criar documentacao verificavel a partir do repositorio atual.
---

# Docs

Use esta skill para documentacao tecnica do Montte e para o workflow automatico de docs.

## Regra principal

Documentacao deve nascer do codigo atual e do contexto coletado pelo workflow. Nao invente dominio, rota, tabela, integracao ou comando.

Para cada tarefa:

1. Leia os arquivos reais citados ou o `$CONTEXT_FILE`.
2. Escreva documentacao por dominio, nao um arquivo gigante.
3. Use caminhos reais e responsabilidades verificaveis.
4. Diferencie fato confirmado de area nao identificada no contexto.
5. Mantenha pt-BR direto, tecnico e util para manutencao.
6. Valide arquivos obrigatorios e schema/build quando aplicavel.

## Roteamento

Leia somente as referencias envolvidas:

- Workflow `.github/workflows/project-documentation.yml`, coleta de contexto e PR automatico: [project-documentation-workflow](references/project-documentation-workflow.md).
- Estrutura dos arquivos em `docs/project`: [domain-docs](references/domain-docs.md).
- Tom, estilo, anti-padroes e checklist de qualidade: [documentation-style](references/documentation-style.md).
- Validacao de docs e fechamento: [docs-validation](references/docs-validation.md).

Se a tarefa envolver codigo em `apps/`, `modules/`, `core/`, `packages/` ou `tooling/`, leia tambem [implementation](../implementation/SKILL.md).

## Nao fazer

- Nao deixar prompt longo inline no workflow quando ele pertence a esta skill.
- Nao criar `docs/project/PROJECT_DOCUMENTATION.md`.
- Nao concentrar todos os dominios em um arquivo.
- Nao incluir segredos, tokens ou valores sensiveis de env.
- Nao documentar feature inexistente para "completar" secao.
- Nao escrever release notes dentro de docs de projeto.

## Fechamento

Informe arquivos criados/alterados, refs usadas pelo workflow e validacoes executadas.
