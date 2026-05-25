# Páginas públicas de documentação

Diretório padrão de docs públicas: `apps/landing/src/content/docs`.

Índice LLM-readable padrão: `docs/llms.txt`.

## Arquitetura inicial recomendada

| Rota                        | Fonte                     | Propósito                                                  |
| --------------------------- | ------------------------- | ---------------------------------------------------------- |
| `/docs`                     | `index.mdx`               | Visão geral, modelo mental e navegação.                    |
| `/docs/primeiros-passos`    | `primeiros-passos.mdx`    | Introdução para usuários novos.                            |
| `/docs/financeiro`          | `financeiro.mdx`          | Contas, categorias, lançamentos e organização financeira.  |
| `/docs/clientes-e-servicos` | `clientes-e-servicos.mdx` | Clientes, serviços, benefícios e contexto comercial.       |
| `/docs/cobrancas`           | `cobrancas.mdx`           | Cobranças recorrentes, assinaturas, invoices e pendências. |
| `/docs/montte-ai`           | `montte-ai.mdx`           | Como o Montte AI usa contexto e ajuda o usuário.           |
| `/docs/configuracoes`       | `configuracoes.mdx`       | Organização, times, permissões e preferências.             |

Gere primeiro as páginas confirmadas pelo contexto. Não crie páginas para áreas que não aparecem nos arquivos coletados.

## Frontmatter obrigatório

Cada página deve incluir apenas campos aceitos por `apps/landing/src/content.config.ts`:

```yaml
---
title: "Título da página"
description: "Descrição clara entre 80 e 240 caracteres."
category: "Comece aqui"
order: 10
updatedAt: "YYYY-MM-DD"
aiSummary: "Resumo curto usado pelo Montte AI para encontrar esta página."
commonQuestions:
   - "Pergunta comum do usuário?"
---
```

## `docs/llms.txt`

O índice deve resumir as docs para retrieval:

```text
# Montte docs

> Documentação pública canônica do Montte para usuários e grounding do Montte AI.

## Comece aqui
- [Primeiros passos](/docs/primeiros-passos) — Entenda o modelo mental do Montte.
```

Não inclua contexto privado de CI, prompts crus ou valores sensíveis em `docs/llms.txt`.
