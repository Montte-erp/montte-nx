# Deep research — docs/wiki autoatualizadas para o Flue

Data: 2026-05-25

## Objetivo

Entender como cubic e Dosu mantêm documentação/wiki gerada por IA e desenhar uma versão nativa para o **Flue — The Agent Harness Framework**: documentação pública autoatualizada semanalmente, versionada no GitHub, usada como fonte do `/docs` da landing, e também consumível por agentes.

## Contexto do Flue usado neste research

Flue é um framework TypeScript para construir agentes headless/programáveis com agent harness embutido. A DX é parecida com Claude Code/Codex/OpenCode/Pi, mas sem TUI/GUI e sem pressupor operador humano.

Elementos importantes para docs:

- agentes vivem em `.flue/agents/<name>.ts`;
- lógica operacional fica majoritariamente em Markdown: `AGENTS.md`, `.agents/skills/`, roles e contexto;
- `init()` cria harnesses com modelo, sandbox, tools, filesystem e sessões;
- `harness.session()` abre sessões persistentes;
- `session.prompt()`, `session.skill()` e `session.task()` são primitivas centrais;
- `flue run <agent>` executa agentes localmente/CI;
- `local()` é ideal para CI porque dá acesso a git, gh, npm e filesystem do runner;
- Flue é runtime-agnostic: Node.js, Cloudflare, GitHub Actions, GitLab CI/CD etc.;
- MCP é suportado como tool adapter via `connectMcpServer()`;
- sandboxes podem ser virtuais, locais, Cloudflare/cf-shell ou remotas via conectores como Daytona.

Conclusão: a feature de docs deve **dogfoodar Flue**. Em vez de chamar só um bot externo no workflow, criar um agente Flue `docs-refresh` que coleta contexto, invoca skills e escreve Markdown.

## Resumo executivo

- **cubic**: wiki externa/searchable gerada a partir do codebase. Foco em indexação completa, links para código, diagramas, chat e MCP. Atualiza por regeneração manual/semanal/mensal.
- **Dosu**: knowledge base com lifecycle. Gera drafts a partir de código, PRs, issues e conversas; publica com revisão; monitora documentos publicados contra PRs/MRs e atualiza docs relacionadas.
- **Flue deve combinar os dois padrões**, mas com GitHub como fonte auditável e a landing como superfície pública:
  - conteúdo Markdown/MDX versionado no repo;
  - rota `/docs` na landing renderizando esse conteúdo;
  - mesmas docs usadas pelo Montte AI como base confiável para explicar o produto;
  - agente Flue semanal rodando em CI;
  - PR automático para revisão humana;
  - índice LLM-readable tipo `llms.txt`;
  - no futuro, staleness check em PRs e MCP/read API.

Complemento obrigatório: a estratégia editorial para `/docs` está em `docs/research/user-facing-technical-docs-strategy.md`. O agente `docs-refresh` deve seguir esse documento para equilibrar explicações para iniciantes, profundidade técnica para usuários avançados e uso seguro pelo Montte AI em respostas ao usuário.

## Como o cubic parece implementar

Fontes principais:

- `https://docs.cubic.dev/wiki/ai-wiki`
- `https://www.cubic.dev/blog/ai-wiki-and-mcp-support-for-code-review`
- `https://www.cubic.dev/blog/ai-generated-documentation`
- `https://docs.cubic.dev/ide/mcp-server`

Padrões observados:

- indexa o codebase e produz wiki pesquisável;
- páginas têm links para código-fonte e podem incluir diagramas;
- suporta perguntas em linguagem natural;
- permite custom instructions por repositório;
- tem auto-refresh semanal ou mensal;
- expõe a wiki via MCP para IDEs/agentes;
- não promete atualização em tempo real: é necessário regenerar para refletir mudanças recentes.

O que copiar para Flue:

- índice pesquisável/agent-readable;
- páginas com paths reais do código;
- refresh semanal;
- instructions por repo/domínio;
- futuro MCP para consultar docs geradas.

O que não copiar no início:

- knowledge base externa como única fonte;
- regeneração opaca sem PR/diff;
- dependência de UI para gerar ou revisar.

## Como o Dosu parece implementar

Fontes principais:

- `https://dosu.dev/blog/using-ai-to-generate-and-maintain-documentation`
- `https://app.dosu.dev/9affd04a-e6a9-452c-b927-c639e979994c/documents/a02d84e2-6162-4c9e-bb14-4eeb063c2e40`
- `https://app.dosu.dev/9affd04a-e6a9-452c-b927-c639e979994c/documents/13015099-253a-4ec5-8791-5ac9e17b8379`
- `https://app.dosu.dev/9affd04a-e6a9-452c-b927-c639e979994c/documents/8d46c36e-d383-4738-b8c2-c6b7cd27da8f`

Padrões observados:

- usa código, diffs, PRs, issues, tickets e conversas como sinais;
- gera drafts antes de publicar;
- aplica templates e style guidelines;
- monitora apenas documentos publicados;
- quando PR abre, comenta docs relacionadas;
- quando PR mergeia, atualiza docs relacionadas;
- permite monitored paths/globs;
- permite `/dosu-refresh` manual;
- Self-Documenting PRs atualiza a knowledge base e comenta no PR; não necessariamente abre PR alterando arquivos do repo.

O que copiar para Flue:

- draft/review via PR;
- templates em Markdown/skills;
- monitored paths;
- PR-aware staleness check;
- vínculo entre doc gerada, commit/ref e PRs.

O que adaptar:

- em Flue, a saída principal deve ser arquivo Markdown versionado, não knowledge base fechada;
- o mecanismo deve ser um agente Flue executável por `flue run`, não só um app SaaS.

## Comparação prática

| Dimensão | cubic | Dosu | Flue recomendado |
|---|---|---|---|
| Fonte | Codebase indexado | Code + PRs + issues + docs publicadas | Repo + git diff + PR metadata + skills |
| Saída | Wiki externa | Knowledge base; pode publicar GitHub/Confluence | Conteúdo da landing `/docs` + índice agent-readable |
| Atualização | Manual/semanal/mensal | PR/MR-aware | Semanal primeiro; PR-aware depois |
| Revisão | Não claro nas fontes públicas | Draft/publicação | PR obrigatório no início |
| Agent DX | MCP | Q&A/integrações | `llms.txt` primeiro; MCP depois |
| Guardrails | Custom instructions | Templates/style/paths | `AGENTS.md`, skills, templates, validação |

## Arquitetura recomendada para Flue

### Visão geral

Criar um agente nativo:

```text
.flue/agents/docs-refresh.ts
```

Rodado por GitHub Actions:

```bash
flue run docs-refresh --target node --id weekly-docs --payload '{"mode":"weekly","target":"landing-docs"}'
```

O output principal não é uma wiki interna solta: é o conteúdo que a landing renderiza em `/docs` e que o Montte AI usa como knowledge base canônica para explicar o produto. O diretório exato depende da estrutura da landing, mas o contrato deve ser algo como:

```text
apps/landing/src/content/docs/**/*.mdx
```

ou, se a landing consumir conteúdo compartilhado:

```text
docs/content/**/*.mdx
```

Com sandbox local em CI:

```ts
import { local } from '@flue/runtime/node';

const harness = await init({
  sandbox: local({ env: { GH_TOKEN: process.env.GH_TOKEN } }),
  model: 'anthropic/claude-sonnet-4-6',
});
```

O agente lê o repo, coleta contexto determinístico, chama uma skill de documentação e escreve apenas no diretório de conteúdo público configurado, além do índice `docs/llms.txt`. Artifacts internos como `documentation-context.md` não devem ser publicados em `/docs` nem usados como resposta direta pelo Montte AI.

### Arquivos propostos

```text
.flue/agents/docs-refresh.ts
.agents/skills/docs/SKILL.md
.agents/skills/docs/references/public-docs-pages.md
.agents/skills/docs/references/style.md
.agents/skills/docs/references/validation.md
.github/workflows/docs-refresh.yml
apps/landing/src/content/docs/index.mdx
apps/landing/src/content/docs/quickstart.mdx
apps/landing/src/content/docs/concepts/agents-harness-sessions.mdx
apps/landing/src/content/docs/concepts/sandboxes.mdx
apps/landing/src/content/docs/guides/support-agent.mdx
apps/landing/src/content/docs/guides/issue-triage-ci.mdx
apps/landing/src/content/docs/guides/coding-agent-remote-sandbox.mdx
apps/landing/src/content/docs/guides/mcp-tools.mdx
apps/landing/src/content/docs/reference/runtime.mdx
apps/landing/src/content/docs/reference/cli.mdx
apps/landing/src/content/docs/reference/cloudflare.mdx
apps/landing/src/content/docs/reference/connectors.mdx
docs/llms.txt
```

Se a landing não usar `apps/landing/src/content/docs`, adaptar o path ao content system real. O importante é: **o agente atualiza a fonte renderizada por `/docs`**, não uma documentação paralela.

### IA inicial para `/docs`

Cada página deve servir dois públicos ao mesmo tempo:

- **iniciante**: quer entender o conceito e copiar um exemplo funcional rápido;
- **avançado**: quer saber limites, runtime behavior, trade-offs, APIs e deploy details.

A estrutura recomendada por página:

```mdx
# Title

Short plain-English explanation.

## Quick example

## How it works

## When to use this

## Advanced details

## API/reference

## Next steps
```

| Rota pública | Fonte sugerida | Escopo |
|---|---|---|
| `/docs` | `index.mdx` | overview, mental model e navegação |
| `/docs/quickstart` | `quickstart.mdx` | primeiro agente mínimo com typed result |
| `/docs/concepts/agents-harness-sessions` | `concepts/agents-harness-sessions.mdx` | agent instance, harnesses, sessions, state |
| `/docs/concepts/sandboxes` | `concepts/sandboxes.mdx` | virtual sandbox, `local()`, Cloudflare shell/cf-shell, Daytona/remotos |
| `/docs/guides/support-agent` | `guides/support-agent.mdx` | support agent em Cloudflare/cf-shell |
| `/docs/guides/issue-triage-ci` | `guides/issue-triage-ci.mdx` | agente rodando em CI com `flue run` |
| `/docs/guides/coding-agent-remote-sandbox` | `guides/coding-agent-remote-sandbox.mdx` | coding agent com sandbox remoto |
| `/docs/guides/mcp-tools` | `guides/mcp-tools.mdx` | `connectMcpServer()` e ferramentas remotas |
| `/docs/reference/runtime` | `reference/runtime.mdx` | API de `@flue/runtime` |
| `/docs/reference/cli` | `reference/cli.mdx` | `flue dev`, `flue run`, `flue build`, `flue add` |
| `/docs/reference/cloudflare` | `reference/cloudflare.mdx` | Cloudflare target, Durable Objects, cf-shell |
| `/docs/reference/connectors` | `reference/connectors.mdx` | modelo de conectores |

### Coleta de contexto

O agente deve produzir um arquivo temporário/artifact:

```text
documentation-context.md
```

Conteúdo mínimo:

- repo, branch, commit atual e tag base;
- árvore relevante;
- `package.json`, workspace config, tsconfig, build config;
- arquivos em `.flue/agents/**`;
- arquivos em `.agents/skills/**`;
- roles/context files;
- docs existentes e conteúdo atual da landing `/docs`;
- commits desde última tag;
- PRs mergeados desde última tag via `gh` quando `GH_TOKEN` existir;
- paths alterados agrupados por domínio;
- lista de arquivos ignorados por segurança.

Não incluir:

- `.env`;
- tokens;
- valores reais de secrets;
- arquivos grandes gerados;
- `node_modules`, `dist`, coverage, lockfile gigante salvo integralmente.

### Prompt/skill contract

A skill de docs deve impor:

- usar só fatos presentes no contexto ou em arquivos reais lidos;
- escrever para documentação **user-facing** da landing: fácil para usuários leigos, mas com profundidade suficiente para usuários avançados;
- usar inglês claro e técnico quando necessário, porque o `/docs` da landing é documentação pública de um framework/devtool global;
- organizar cada página em camadas:
  1. explicação simples do conceito;
  2. exemplo mínimo copiável;
  3. detalhes técnicos e trade-offs;
  4. referência/API quando aplicável;
- sempre citar APIs, comandos e paths reais quando o assunto for implementação;
- declarar lacunas como “Not identified in collected context.”;
- não gerar API inexistente;
- não escrever fora do diretório de conteúdo público da landing e `docs/llms.txt`;
- manter páginas pequenas, navegáveis e revisáveis.

### Workflow semanal

```yaml
name: Docs Refresh

on:
  schedule:
    - cron: '0 9 * * 1'
  workflow_dispatch:
    inputs:
      dry_run:
        type: boolean
        default: false

permissions:
  contents: write
  pull-requests: write

jobs:
  docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: bunx flue run docs-refresh --target node --id weekly-docs --payload '{"mode":"weekly","target":"landing-docs"}'
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
      - run: git diff --check -- apps/landing docs .agents .flue
      - run: bun run landing:build
      - name: Open PR
        if: inputs.dry_run != true
        run: |
          # criar branch automation/docs-refresh-YYYY.MM.DD
          # commit docs/wiki docs/llms.txt
          # abrir/atualizar PR
```

## PR-aware staleness check

Depois do semanal estar estável, criar segundo agente:

```text
.flue/agents/docs-staleness.ts
```

Disparos:

- `pull_request opened/synchronize/ready_for_review`;
- comentário `/docs-refresh`.

Comportamento:

1. ler arquivos alterados no PR;
2. mapear paths para páginas de docs;
3. comentar links das páginas relacionadas;
4. opcionalmente label `docs-needed`;
5. não editar docs automaticamente no PR até a acurácia estar boa.

Exemplo:

```text
This PR changes `.flue/agents/**` and `@flue/runtime` session behavior.
Likely public docs to review:
- /docs/concepts/agents-harness-sessions
- /docs/reference/runtime
```

## Guardrails contra documentação falsa

- Docs geradas via PR, não commit direto.
- Cada página inclui “Last generated from: `<commit>`”.
- Cada seção técnica aponta paths reais.
- Lacunas ficam explícitas.
- Validação bloqueia criação de arquivos fora do allowlist.
- O agente não recebe secrets além do necessário (`GH_TOKEN` para metadata).
- `local()` sandbox em CI herda env mínimo; passar secrets explicitamente.
- Ignorar `.env`, logs, artifacts, fixtures sensíveis.

## Estratégia de dogfooding

Essa feature é uma vitrine perfeita do Flue:

- mostra `flue run` em CI;
- usa `local()` sandbox;
- usa skills como lógica principal;
- usa `session.task()` para pesquisa paralela por domínio;
- usa typed result para resumo/estatísticas;
- pode evoluir para Cloudflare/Node deploy se virar produto;
- pode usar MCP depois para publicar/consultar docs.

Exemplo de decomposição interna:

```ts
const runtimeResearch = await session.task('Research @flue/runtime docs and changed files.', {
  role: 'docs-researcher',
});

const cliResearch = await session.task('Research @flue/cli docs and changed files.', {
  role: 'docs-researcher',
});

await session.skill('docs', {
  args: { contextFile: 'documentation-context.md', outputDir: 'docs/wiki' },
});
```

## Plano de implementação

### Fase 1 — MVP semanal

- Criar `.flue/agents/docs-refresh.ts`.
- Criar skill `.agents/skills/docs/SKILL.md`.
- Criar templates/regras para docs públicas.
- Criar `.github/workflows/docs-refresh.yml`.
- Gerar/atualizar conteúdo MDX usado pela landing em `/docs` e `docs/llms.txt` usado pelo Montte AI.
- Rodar build da landing.
- Abrir PR semanal.

### Fase 2 — Melhor contexto

- Adicionar PR metadata via `gh`.
- Agrupar diffs por domínio.
- Gerar changelog técnico em `recent-changes.md`.
- Incluir citações/paths por seção.

### Fase 3 — Staleness em PR

- Criar `docs-staleness`.
- Comentar docs relacionadas no PR.
- Adicionar comando `/docs-refresh`.

### Fase 4 — Wiki/API para agentes

- Publicar `/docs` na landing e manter `docs/llms.txt` como índice para agentes.
- Adicionar endpoint ou MCP server para consultar páginas.
- Opcional: sincronizar com site público.

## Decisão recomendada

Implementar primeiro como **Flue agent + GitHub Action semanal + PR de conteúdo da landing `/docs`**.

Isso entrega o valor central de cubic/Dosu sem criar uma knowledge base paralela:

- auditável no Git;
- revisável por PR;
- publicado automaticamente pela landing;
- dogfooda Flue;
- útil para usuários humanos e para o Montte AI;
- fácil de estender para staleness/MCP depois.

## Perguntas abertas

- Qual será o content system da landing: Astro content collections, MDX direto, ou outro?
- O diretório final será `apps/landing/src/content/docs` ou um pacote compartilhado de conteúdo?
- Qual modelo será padrão no CI?
- O workflow deve rodar só semanalmente ou também após release?
- PR de docs pode auto-mergear após checks ou sempre precisa review humano?
