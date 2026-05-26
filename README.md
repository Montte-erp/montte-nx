# Montte

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](CONTRIBUTING.md)

**Montte** é a camada de billing e operacao financeira que falta no SaaS brasileiro: recorrencia, cobranca, financeiro, fiscal, estado do cliente e automacao AI-native em uma mesma plataforma.

Mentalmente o produto segue a tese **Autumn + Rillet para o Brasil**:

- o lado **Autumn** inspira as primitivas dev-facing de billing: cliente, contrato, servico/produto, preco, assinatura, uso, entitlement, invoice e customer state;
- o lado **Rillet** inspira o financeiro/ops AI-native: conciliacao continua, inbox operacional, evidencias, auditoria e fechamento assistido;
- o diferencial brasileiro é integrar isso com PIX/boleto, fiscal, CNPJ, Open Finance e workflows locais sem empurrar o founder para um ERP por fora.

O app ainda esta em beta privado. Hoje a superficie ativa e o dashboard web com caixa/financeiro, cartoes, relacionamentos, inbox, relatorios, configuracoes, API keys, workflows e Montte AI. Billing, contratos, pagamentos, fiscal e Open Finance sao direcao de produto/roadmap, nao modulos ativos completos no workspace atual.

> **Status:** beta privado, sem garantia de estabilidade. Espere mudancas de schema, rotas e fluxos.

---

## Primeiros passos

### Requisitos

- [Bun](https://bun.sh/) >= 1.x
- [Node.js](https://nodejs.org/) >= 22.12
- [Docker](https://docs.docker.com/get-docker/) ou [Podman](https://podman.io/) com Compose

### Setup

```bash
git clone https://github.com/Montte-erp/montte-nx.git
cd montte-nx
bun install
bun run setup
```

Depois do setup inicial, use:

```bash
bun dev
```

`bun dev` roda `scripts/dev-init.ts`, garante `apps/web/.env.local`, instala dependencias quando necessario, tenta subir os containers locais, aplica o schema com `db:push` e inicia `web`, `worker` e `landing` em paralelo.

Para abrir o app desktop local via Tauri, use:

```bash
bun run dev:desktop
```

`bun run dev:desktop` roda o mesmo bootstrap, inicia `worker` e `landing`, e troca o `web:dev` por `web:desktop:dev`. O Tauri abre o shell desktop e sobe o runtime web em `http://localhost:3000`.

- App web: `http://localhost:3000`
- Landing Astro: `http://localhost:3001`
- Worker DBOS: processo separado em `apps/worker`

Veja [CONTRIBUTING.md](CONTRIBUTING.md) para comandos, validacoes e padroes de contribuicao.

---

## Agentes e skills

`AGENTS.md` é a fonte de verdade para agentes trabalhando no repositorio. Antes de alterar uma area, abra o skill correspondente em `.agents/skills/<nome>/SKILL.md`.

| Area | Skill |
| :-- | :-- |
| Implementacao em `apps/`, `modules/`, `core/`, `packages/` ou `tooling/` | [`implementation`](.agents/skills/implementation/SKILL.md) |
| Review comments, PRs, bugs, diffs e CI | [`code-review`](.agents/skills/code-review/SKILL.md) |
| UI, UX, copy de produto, dashboards, forms e surfaces autenticadas | [`design`](.agents/skills/design/SKILL.md) |
| Releases, tags, GitHub Releases, Linear Releases e recuperacao | [`release`](.agents/skills/release/SKILL.md) |
| Documentacao tecnica e `docs/project` | [`docs`](.agents/skills/docs/SKILL.md) |
| Blog, LinkedIn, X e marketing | [`marketing`](.agents/skills/marketing/SKILL.md) |

Ferramentas operacionais: CI via `monitor-ci`; Linear (`MON-*`) via `linear-cli`.

---

## O que existe hoje

### Web app (`apps/web`)

- Dashboard autenticado com TanStack Start, TanStack Router e oRPC.
- Rotas principais para inbox, lancamentos, contas bancarias, cartoes, categorias, centros de custo, relatorios, relacionamentos, chat e configuracoes.
- Agregador oRPC em `apps/web/src/integrations/orpc/router/index.ts`.
- OpenAPI/Scalar em `/api/openapi/docs` quando o app esta rodando.
- Shell desktop local via Tauri em `apps/web/src-tauri`.

### Landing (`apps/landing`)

- Landing publica em Astro.
- Blog, docs publicas, SEO, sitemap, waitlist e PostHog client-side.
- Build separado via `bun run landing:build`.

### Worker (`apps/worker`)

- Runtime DBOS separado do processo web.
- Inicializa observabilidade, Redis, PostHog e workflows dos modulos.

### Caixa e financeiro (`@modules/cashbook`)

- Contas bancarias.
- Lancamentos/transacoes com criacao, listagem, filtros, status, bulk actions e importacao CSV/XLSX/OFX.
- Vinculo opcional com relacionamento (`relationshipId`).
- Pagamentos com metodos como PIX, boleto, cartoes e transferencia no modelo de transacao.

### Cartoes (`@modules/cards`)

- Cartoes de credito.
- Faturas e totais de fatura.
- Guardas de exclusao quando ha uso vinculado.

### Relacionamentos (`@modules/relationships`)

- Cadastro operacional de clientes e fornecedores.
- `relationships.parties` modela `customer | supplier`, `person | company`, nome, documento, e-mail, telefone, arquivamento e vinculo com transacoes.
- Lookup de CNPJ e regras para nao excluir contraparte com transacao vinculada.
- Nao e CRM: funil, atividades comerciais, lead scoring e campanhas ficam fora deste modulo.

### Classificacao (`@modules/classification`)

- Categorias e subcategorias.
- Tags usadas no produto como **Centro de Custo**.
- Workflows de classificacao e derivacao de palavras-chave via DBOS.

### Inbox (`@modules/inbox`)

- Inbox operacional por time.
- Agregacao de pendencias como pagamentos a vencer e transacoes sem categoria.
- SSE para eventos operacionais e acoes de dismiss/snooze.

### Relatorios (`@modules/insights`)

- Relatorios persistidos e telas de detalhe.
- Base para analises financeiras e paineis internos.

### Workflows (`@modules/workflows`)

- Base de automacoes e agendamentos.
- Runtime conectado ao worker DBOS.
- Ainda nao e a espinha dorsal completa de eventos/aprovacoes/receipts prevista no roadmap.

### Conta, times e autenticacao (`@modules/account`, `@core/authentication`)

- Better Auth com Magic Link, Email OTP, 2FA, organizacoes, times e API keys.
- Perfil, sessoes, organizacao, times, onboarding, CNPJ e configuracoes financeiras.
- Dados isolados por organizacao/time.

### Montte AI (`@modules/agents`)

- Chat e threads dentro do dashboard.
- Runtime com TanStack AI, OpenRouter, assistant-ui/AG-UI e PostHog prompts/traces.
- Tools financeiras de leitura e fluxo inicial skill-first.
- Direcao: um Montte AI principal com skills por dominio, lazy tool discovery, approvals, evals e receipts.

### Recorrencia, cobrancas e fiscal

Ainda nao existem modulos fonte ativos para `billing`, `contracts`, `payments`, `vault`, `fiscal`, `open_finance`, `integrations` ou `extensions` no workspace atual. Esses dominios estao no roadmap e devem nascer como modulos proprios, com Postgres/oRPC como fonte de verdade e providers externos apenas como adapters.

### Integracoes oficiais

- PostHog para analytics, surveys, feature flags, prompts e observabilidade.
- Twenty e CRM externo estao planejados para a frente de relacionamento/comercial, via integracao e eventos.

---

## Direcao de produto

A direcao consolidada nos outputs de pesquisa e arquitetura é uma plataforma **deep-integrated e AI-native**, nao um conjunto de modulos isolados com chat em cada tela.

```text
Cliente/fornecedor
  -> contrato/documento/termos
  -> servico/produto/preco
  -> assinatura/uso/entitlement
  -> invoice/cobranca
  -> pagamento
  -> documento fiscal
  -> lancamento financeiro/conciliacao
  -> relatorio/inbox/workflow
  -> auditoria/receipt
  -> contexto para Montte AI
```

Princípios:

- **Postgres e oRPC sao o sistema de verdade.** IA nao escreve direto no banco nem substitui procedures tipadas.
- **Billing é dominio do Montte.** AbacatePay, Stripe, Polar, Autumn ou qualquer provider futuro devem ser adapters, nao fonte de verdade de assinatura, invoice, entitlement ou estado do cliente.
- **Um Montte AI principal.** Novas capacidades entram como skills por dominio; subagents, se existirem, sao detalhe interno de uma skill.
- **Eventos conectam os dominios.** Business events, provider ledgers, audit entries, approvals e receipts devem ser o idioma comum entre contratos, billing, pagamentos, fiscal, financeiro, inbox e automacao.
- **Fiscal brasileiro e dominio proprio.** Relacionamentos continuam simples; dados fiscais entram como satelites/versionamento e documentos fiscais sao snapshots imutaveis com eventos append-only.
- **Postgres-only por padrao.** Retrieval, entity graph, eventos, audit, billing e integracoes devem ficar em Postgres antes de considerar bancos separados.

---

## Roadmap tecnico

Sem datas prometidas; a ordem pode mudar conforme bugs, integridade de dados e demanda real.

1. **Fundacao AI-native e governanca**: events, audit, approval gate, receipts, workflow/action pattern, tool policy e skills/references por dominio.
2. **Relacionamentos -> contratos**: polir clientes/fornecedores, adicionar dados fiscais satelite, criar `modules/contracts` e Contract Writer com IA.
3. **Billing primitives + AbacatePay**: `modules/billing` com servicos/produtos, precos, assinaturas, invoices, entitlements/customer state; `modules/payments` com provider abstraction, PIX/boleto/checkout/webhooks e reconciliacao.
4. **Produto/estoque minimo**: catalogo leve de produto/SKU/unidade/preco/custo apenas ate onde billing e fiscal exigirem.
5. **Vault + fiscal**: certificados, CNPJ, DFe inbound, documentos fiscais, eventos, XML/PDF/protocolos e emissao em homologacao antes de producao.
6. **Open Finance**: consentimento/conexao, external accounts, external transactions, staging import, dedupe e conciliacao assistida.
7. **Integracoes Twenty/PostHog**: kernel de integracoes, sync por eventos, webhooks, DLQ e comunicacoes com audit quando necessario.
8. **Desktop e dispositivos fisicos**: Tauri como bridge para certificado A3, impressora, scanner ou dispositivos reais somente sob demanda.
9. **Extensions + SDK**: manifest, permissions, migrations controladas, workflow templates, UI slots, skill packs e SDK TypeScript para verticalizacoes reais.

Outputs de referencia:

- [`outputs/erp-billing-ai-native-roadmap.md`](outputs/erp-billing-ai-native-roadmap.md)
- [`outputs/montte-deep-integrated-ai-native-platform.md`](outputs/montte-deep-integrated-ai-native-platform.md)
- [`outputs/montte-ai-architecture-consolidated.md`](outputs/montte-ai-architecture-consolidated.md)
- [`outputs/plano-fiscal-nfe-nfce-nfse-montte.md`](outputs/plano-fiscal-nfe-nfce-nfse-montte.md)

---

## Stack

| Area | Tecnologias |
| :-- | :-- |
| Monorepo | Nx, Bun, TypeScript |
| Web | React 19, TanStack Start, TanStack Router, TanStack Query, TanStack DB, shadcn/ui, Tailwind CSS |
| Desktop local | Tauri |
| Landing | Astro, React islands, Starlight/docs, sitemap, RSS/MDX quando aplicavel |
| API | oRPC, OpenAPI, Scalar |
| Banco | Drizzle ORM, PostgreSQL usando imagem local ParadeDB |
| Auth | Better Auth |
| Workflows | DBOS em `apps/worker`, pg-boss catalogado para jobs operacionais |
| IA | TanStack AI, OpenRouter, assistant-ui/AG-UI, PostHog prompts/traces |
| Realtime | Redis + `@core/sse` |
| Arquivos | MinIO via `@core/files` |
| Email | Resend + React Email / Better Notify |
| Observabilidade | PostHog, OpenTelemetry, Pino |
| Qualidade | oxlint, oxfmt, Vitest, Playwright |

---

## Estrutura

```text
montte-nx/
├── apps/
│   ├── landing/         # landing publica Astro
│   ├── web/             # app TanStack Start + agregador oRPC + Tauri
│   ├── web-e2e/         # Playwright E2E
│   └── worker/          # runtime DBOS
├── core/                # infraestrutura compartilhada
│   ├── ai/
│   ├── authentication/
│   ├── database/
│   ├── dbos/
│   ├── environment/
│   ├── files/
│   ├── logging/
│   ├── orpc/
│   ├── posthog/
│   ├── redis/
│   ├── sse/
│   ├── transactional/
│   └── utils/
├── modules/             # dominios de produto
│   ├── account/
│   ├── agents/
│   ├── cards/
│   ├── cashbook/
│   ├── classification/
│   ├── inbox/
│   ├── insights/
│   ├── relationships/
│   └── workflows/
├── packages/
│   └── ui/
└── tooling/
    ├── boundary/
    ├── css/
    ├── oxc/
    └── typescript/
```

`apps/web` hospeda a UI e agrega os routers dos modulos. `apps/worker` registra e executa workflows. `core/*` contem infra e singletons compartilhados. `modules/*` contem regras de dominio, routers, services, workflows e contratos quando existem.

---

## Comandos principais

```bash
bun dev                  # dev-init + web + worker + landing
bun run dev:desktop      # dev-init + desktop Tauri + worker + landing
bun dev:all              # todos os apps e pacotes com target dev
bun run build            # build via Nx cache
bun run typecheck        # typecheck via Nx
bun run check            # oxlint
bun run format           # oxfmt --write
bun run test             # testes via Nx
bun run db:push          # aplica schema local
bun run db:push:prod     # aplica schema producao
bun run db:studio:local  # Drizzle Studio local
bun run db:studio:prod   # Drizzle Studio producao
bun run check-boundaries # valida regras de importacao
bun run clean            # limpeza segura
bun run clean:cache      # limpa cache
bun run auth:generate    # regenera schema do Better Auth
bun run landing:build    # build da landing Astro
bun run landing:start    # preview da landing
bun run doctor           # diagnostico do ambiente
bun run e2e              # Playwright
```

Scripts operacionais ficam em `scripts/`, incluindo `setup.ts`, `dev-init.ts`, `doctor.ts`, `clean.ts`, `db-push.ts`, `ensure-database.ts`, `ensure-schemas.ts`, `check-env.ts`, `env-setup.ts`, `set-bucket-cors.ts` e `backfill-category-icons.ts`.

Gotchas:

- `bun dev` executa `scripts/dev-init.ts`; se containers locais falharem, o script avisa e continua. Confirme o ambiente com `bun run doctor`.
- Erro `Module has no exported member` no typecheck costuma indicar `dist` stale. Rode build do pacote `core/<pkg>` citado.
- Nunca edite `apps/web/src/routeTree.gen.ts`; o arquivo e gerado.
- Nao aumente `NODE_OPTIONS` para contornar memoria; corrija a causa raiz.

---

## API publica

Com o web app rodando, a referencia OpenAPI fica em:

```text
http://localhost:3000/api/openapi/docs
```

Para chamadas programaticas, crie uma chave em Configuracoes do projeto -> API Keys e envie `x-api-key`.

---

## Contribuicao

Leia [CONTRIBUTING.md](CONTRIBUTING.md) antes de abrir PR. O projeto usa padroes fortes para oRPC, Drizzle, TanStack Query, DBOS, UI e boundaries.

Roadmap e trabalho ativo vivem no Linear do Montte. Issues no GitHub sao bem-vindas para bugs e sugestoes publicas.

## Releases

O produto unico (`apps/web`) usa CalVer `YYYY.MM.DD` com tag `vYYYY.MM.DD`. O workflow `.github/workflows/release-weekly.yml` gera release notes em pt-BR, tag, GitHub Release e Linear Release. `.github/workflows/blog-post-from-release.yml` transforma releases publicadas em PR de post. `.github/workflows/project-documentation.yml` atualiza `docs/project`.

## Licenca

Apache-2.0. Veja [LICENSE.md](LICENSE.md).
