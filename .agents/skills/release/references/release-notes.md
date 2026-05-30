# Release Notes

Use para gerar `RELEASE_NOTES.md` semanal do Montte.

## Entrada

`$CHANGES_FILE` contem:

- `## Commits`: `- <subject> (<sha>) by <autor>`
- `## Merged PRs`: `- #<num> <titulo> by @<autor> - <url>` ou equivalente com link

Use PR como unidade canonica quando existir. Consolide commits do mesmo PR. Commits soltos viram itens proprios.

## Saida

Escreva em `$OUTPUT_FILE` somente o Markdown final publicavel. Nao inclua H1 com nome/versao da release, raciocinio, classificacao intermediaria, plano, lista bruta de PRs ou frases de processo como "Let me" / "Now I have".

Estrutura:

```markdown
<Resumo executivo: 2-3 frases em pt-BR, foco em valor para usuario, sem arquitetura, PR, MON ou implementacao.>

## Em destaque

### <Nome curto da feature> ([#PR](url))

<1-2 frases com beneficio concreto e verificavel.>

## Ação necessária

### <O que mudou> ([#PR](url))

**Quem é afetado:** <perfil>
**O que fazer:** <acao concreta>
**Documentação:** <link real, somente se existir>

## Novidades por área

### <Área>

- <beneficio em 1 linha> ([#PR](url))

## Correções

### <Área>

- <efeito visivel em 1 linha> ([#PR](url))

## Melhorias

- <melhoria visivel em 1 linha> ([#PR](url))

<details>
<summary><strong>Notas técnicas</strong> (para o time)</summary>

<refatoracoes, infra, schemas, workflows, dependencias, observabilidade>

</details>

<details>
<summary><strong>Manutenção</strong></summary>

<chore, docs, test, ci>

</details>

---

**Contribuíram nesta release:** @autor1, @autor2
```

Omita secoes vazias inteiras.

## Classificacao

- `feat:` visivel: `Em destaque` se alto impacto, senao `Novidades por área`.
- `fix:` visivel: `Correções`.
- `perf:` e UX visivel: `Melhorias`.
- `refactor:`, `schema`, `router`, `barrel`, `repository`, `DBOS`, `oRPC`, `Drizzle`, `module`, `layer`, `service`: `Notas técnicas`.
- `chore:`, `docs:`, `test:`, `ci:`: `Manutenção`.
- Breaking: titulo com `!`, `BREAKING CHANGE`, remocao de rota/campo/endpoint, migration destrutiva ou remocao de feature.

## Regras de escrita

- pt-BR claro e especifico.
- Corpo publico deve falar de beneficio ou efeito, nao implementacao.
- Sem emojis, badges, SHAs, nomes de autores nos itens ou "estamos animados".
- Sem `TODO`, placeholder, link ficticio ou imagem inventada.
- Use "Montte AI", nao "Rubi", salvo se a mudanca for explicitamente migracao de nome.
- No corpo publico, no maximo uma referencia por item: `([#PR](url))`.
- Normalmente: ate 3 destaques e 6-10 novidades/correcoes no corpo publico; detalhes menores vao para `<details>`.

## Checklist final

- Resumo fala de valor para usuario.
- Corpo nao comeca com `# Montte`.
- Destaques sao visiveis ao usuario final.
- Breaking tem "Quem é afetado" e "O que fazer".
- Notas tecnicas e manutencao estao dentro de `<details>`.
- Nao ha item duplicado entre secoes.
- Secoes vazias foram removidas.
- Nao ha rascunho, analise intermediaria ou comentario do agente antes/depois das notas finais.
