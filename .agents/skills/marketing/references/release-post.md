# Blog Post From Release

Use para transformar uma GitHub Release publicada em post canônico no blog do Montte.

## Quando usar

- Workflow `.github/workflows/blog-post-from-release.yml`.
- Posts em `apps/landing/src/content/blog/montte-YYYY-MM-DD.md`.
- Conteudo derivado de release notes ja publicadas.

## Fonte de fato

Release notes sao a unica fonte factual. Nao invente numeros, PRs, prazos, features, nomes, cicatrizes ou metricas que nao estejam na release.

Leia tambem [blog](blog.md) para voz, anti-AI-tells, frontmatter, SEO/AEO/GEO e humanizacao.

## Contrato do workflow

- Dispara em `release.published` ou `workflow_dispatch` com `tag`.
- Aceita apenas tags `vYYYY.MM.DD`.
- Busca notes com `gh release view "$TAG" --json body --jq .body`.
- Gera post em `apps/landing/src/content/blog/montte-YYYY-MM-DD.md`.
- Gera capa placeholder apenas como artefato inicial; PR deve pedir revisao/substituicao quando necessario.
- Abre PR `blog/post-montte-YYYY-MM-DD`.

## Frontmatter obrigatorio

```yaml
---
title: "<ate 60 chars, verbo presente, sem travessao, sem emoji>"
description: "<40 a 60 palavras, 1a frase TL;DR>"
publishedAt: YYYY-MM-DD
author: "Manoel Neto"
tags: ["release", "<2 a 3 tags adicionais>"]
category: "Notas de release"
coverImage: "../../assets/blog/montte-YYYY-MM-DD.svg"
featured: true
releaseUrl: "<url>"
releaseVersion: "vYYYY.MM.DD"
readingMinutes: <3 a 8>
keyTakeaways:
   - "<feature e beneficio>"
faq:
   - question: "<pergunta literal>"
     answer: "<resposta direta>"
---
```

## Corpo

- Sem H1; renderer usa frontmatter.
- 3 a 6 H2, mais `Bastidores` opcional.
- Ultima H2: `O que vem por aí`.
- Incluir cicatriz somente se ela aparecer nas release notes.
- Usar "no Montte", "do Montte" e "Montte AI".
- Não usar em dash (U+2014) nem en dash (U+2013).
- Ultima frase deve ser acao ou afirmacao, nunca despedida formal.

## Validacao

- Arquivo existe e nao esta vazio.
- Sem em dash (U+2014) nem en dash (U+2013).
- Frontmatter contem campos obrigatorios.
- H1 ausente nos primeiros 30 lines.
- `bun run landing:build` passa antes do PR.
