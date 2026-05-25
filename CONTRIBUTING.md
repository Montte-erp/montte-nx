# Contribuindo com o Montte

Montte e uma plataforma operacional com IA em um monorepo Nx. O produto principal roda em `apps/web`, a landing publica roda em `apps/landing`, os workflows duraveis rodam em `apps/worker`, a infraestrutura compartilhada fica em `core/` e os dominios de produto ficam em `modules/`.

Este guia descreve o estado atual do repositorio. Para detalhes de implementacao e regras de agente, leia tambem `AGENTS.md`.

## Pre-requisitos

- [Bun](https://bun.sh) >= 1.x
- [Node.js](https://nodejs.org) >= 22.12
- [Docker](https://www.docker.com) ou [Podman](https://podman.io) com Compose
- [Git](https://git-scm.com)

## Setup inicial

```bash
git clone https://github.com/Montte-erp/montte-nx.git
cd montte-nx
bun install
bun run setup
```

`bun run setup` cria `apps/web/.env.local`, sobe containers locais e aplica o schema quando o ambiente ja esta preenchido. Depois disso, o comando diario e:

```bash
bun dev
```

`bun dev` roda `scripts/dev-init.ts`, garante `.env.local`, instala dependencias se necessario, tenta subir os containers, roda `db:push` e inicia `web`, `worker` e `landing`.

Se o ambiente falhar antes de iniciar os apps, rode:

```bash
bun run doctor
```

Gotchas do workspace:

- `bun dev` executa `scripts/dev-init.ts`; se containers locais falharem, ele avisa e continua.
- Erro `Module has no exported member` no typecheck geralmente indica `dist` stale. Rode build do pacote `core/<pkg>` citado.
- Nunca edite `apps/web/src/routeTree.gen.ts`; ele e gerado.
- Nao aumente `NODE_OPTIONS` para contornar memoria; corrija a causa raiz.

## Comandos

```bash
bun dev                  # dev-init + web + worker + landing
bun dev:staging          # web em modo staging
bun dev:all              # todos os apps e pacotes com target dev
bun run build            # build via Nx cache
bun run typecheck        # typecheck via Nx
bun run check            # oxlint
bun run format           # oxfmt --write
bun run format:check     # oxfmt --check
bun run test             # testes via Nx
bun run test:coverage    # testes via Nx com coverage
bun run e2e              # Playwright
bun run e2e:ui           # Playwright UI
bun run db:push          # aplica schema no banco local
bun run db:push:prod     # aplica schema em producao
bun run db:studio:local  # Drizzle Studio local
bun run db:studio:prod   # Drizzle Studio producao
bun run check-boundaries # valida regras de importacao
bun run doctor           # diagnostico do ambiente
bun run clean            # limpeza segura
bun run clean:cache      # limpa cache
bun run auth:generate    # regenera schema do Better Auth
bun run landing:build    # build da landing Astro
bun run landing:start    # preview da landing em host/port compativel com Railway
```

Scripts de workspace ficam em `scripts/`: `setup.ts`, `dev-init.ts`, `doctor.ts`, `clean.ts`, `db-push.ts`, `ensure-database.ts`, `ensure-schemas.ts`, `check-env.ts`, `env-setup.ts`, `set-bucket-cors.ts`, `backfill-category-icons.ts` e scripts auxiliares similares.

## Estrutura

```text
montte-nx/
├── apps/
│   ├── landing/         # Astro publico: site, blog, waitlist e PostHog
│   ├── web/             # TanStack Start SSR + agregador oRPC
│   ├── web-e2e/         # Playwright E2E
│   └── worker/          # runtime DBOS para workflows duraveis
├── core/                # infraestrutura compartilhada, sem regra de dominio
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
├── modules/             # dominios de produto atuais
│   ├── account/         # perfil, org, times, sessoes, API keys, onboarding
│   ├── agents/          # Montte AI, threads, tools e workflows de chat
│   ├── classification/  # categorias, centros de custo e classificacao
│   ├── finance/         # contas, transacoes, cartoes, parcelas, recorrencias
│   ├── inbox/           # inbox operacional e SSE
│   └── insights/        # relatorios
├── packages/
│   └── ui/              # shadcn primitives e componentes compartilhados
└── tooling/             # boundaries, oxc, Tailwind e tsconfigs
```

Novos dominios devem nascer em `modules/<nome>` como pacote `@modules/<nome>`. Cada modulo e dono de seus `router/`, `services/`, `workflows/`, `contracts/` e `sse/` quando existirem.

`apps/web` hospeda a UI e agrega routers em `apps/web/src/integrations/orpc/router/index.ts`. `apps/worker` importa workflows dos modulos e executa DBOS fora do processo web. Hoje o worker registra workflows de `classification` e `agents`.

## Produto atual

O app web tem telas para inbox, transacoes, contas bancarias, cartoes, categorias, centros de custo, relatorios, chat do Montte AI e configuracoes.

O repositorio tambem contem schemas para servicos, medidores, precos, assinaturas, itens de assinatura, cupons, beneficios, invoices e uso. Isso representa a base de recorrencia/cobrancas, mas ainda nao existe `@modules/billing` no workspace atual.

As integracoes oficiais sao PostHog e Twenty. Nao adicione outra integracao oficial sem decisao explicita de produto.

## Padroes de codigo

- Conteudo de produto e mensagens visiveis ao usuario devem ser pt-BR.
- Montte e masculino: use "o Montte", "do Montte" e "no Montte".
- oRPC usa `WebAppError`; nao use `ORPCError`, `Error` cru ou strings em handlers.
- Queries e schemas de banco ficam em Drizzle; schemas sempre usam namespaces, nunca `pgTable` cru.
- Escritas no banco ficam dentro de `db.transaction(async (tx) => ...)`.
- Nao crie repository layer para routers; consulte `context.db` diretamente.
- Em codigo novo de dominio, prefira `better-result` para erros esperados. Modulos legados que ja usam `neverthrow` podem continuar com ele, mas nao misture os dois no mesmo modulo.
- Evite `try/catch` fora de testes e scripts.
- Nao use casts com `as`; corrija o tipo na origem.
- Datas usam `dayjs`; evite `new Date()` fora das excecoes documentadas em `AGENTS.md`.
- Frontend chama oRPC via TanStack Query; componentes nao devem chamar `orpc.*` diretamente.
- Componentes usam `QueryBoundary` com `useSuspenseQuery` por padrao.
- Modais, sheets e drawers de formulario usam `useSheet`; confirmacoes destrutivas usam `useAlertDialog`.
- Tags no produto sao sempre chamadas de **Centro de Custo**.
- `apps/web/src/routeTree.gen.ts` e gerado; nao edite manualmente.

## Skills e agentes

`AGENTS.md` e a fonte de verdade para agentes. Antes de mexer em uma area, abra o skill correspondente; o conteudo do skill tem precedencia sobre instrucoes antigas.

Skills do repositorio ficam em `.agents/skills/<nome>/SKILL.md`.

| Area | Abra este skill |
| :-- | :-- |
| Implementacao em `apps/`, `modules/`, `core/`, `packages/` ou `tooling/` | [`implementation`](.agents/skills/implementation/SKILL.md) |
| Review comments, PR findings, bugs reportados, diffs e CI | [`code-review`](.agents/skills/code-review/SKILL.md) |
| UI, UX, copy de produto, layout, dashboards, forms, sheets e surfaces autenticadas | [`design`](.agents/skills/design/SKILL.md) |
| Release workflows, release notes, tags, GitHub Releases, Linear Releases e recuperacao | [`release`](.agents/skills/release/SKILL.md) |
| Documentacao tecnica, `docs/project` e automacao de docs | [`docs`](.agents/skills/docs/SKILL.md) |
| Blog, LinkedIn, X, release blog posts e marketing drafts | [`marketing`](.agents/skills/marketing/SKILL.md) |

Quando uma tarefa cruzar areas, abra todos os skills relevantes. Exemplo: bug visual usa `code-review`, `implementation` e `design`; automacao de post de release usa `release`, `marketing` e `implementation`.

Ferramentas operacionais:

- CI checks: `monitor-ci`
- Linear (`MON-*`): `linear-cli`

Skills especificos de framework ou biblioteca podem existir, mas siga primeiro o roteamento de `AGENTS.md`.

## Testes e verificacao

Use Nx ou os scripts que ja chamam Nx:

```bash
bun run format
bun run check
bun run typecheck
bun run test
```

Para validacao focada:

```bash
bun nx run @modules/finance:test
bun nx run @modules/finance:typecheck
bun nx run web:typecheck
bun nx run landing:build
```

Testes unitarios e de integracao vivem em `core/*`, `modules/*`, `packages/*` e `__tests__/` de workspace. E2E vive em `apps/web-e2e/tests/`.

Nao adicione testes unitarios, integracao ou snapshots em `apps/*`. Para UI e fluxos reais, use Playwright em `apps/web-e2e`.

## Fluxo de PR

1. Atualize `master` antes de iniciar trabalho novo.
2. Crie branch com o identificador da issue quando existir: `manoelnetocarvalho03/mon-123-descricao-curta`.
3. Use worktree quando houver outras mudancas locais em andamento.
4. Mantenha o PR pequeno e focado.
5. Atualize documentacao junto com mudancas de fluxo, comandos, arquitetura ou comportamento publico.
6. Rode as verificacoes relevantes antes de abrir o PR.
7. Abra PR contra `master` com titulo objetivo, resumo do que mudou e validacoes executadas.
8. Declare riscos conhecidos e validacoes que nao foram rodadas.

Commits devem ser curtos e descritivos, por exemplo:

```text
docs: atualizar readme e contributing
```

## Releases

O produto unico (`apps/web`) usa CalVer `YYYY.MM.DD` com tag `vYYYY.MM.DD`. O workflow `.github/workflows/release-weekly.yml` coleta commits e PRs desde a ultima tag, gera release notes em pt-BR e cria GitHub Release + Linear Release. O workflow `.github/workflows/blog-post-from-release.yml` gera PR de post a partir de releases publicadas, e `.github/workflows/project-documentation.yml` atualiza `docs/project`.

Alteracoes nesses fluxos devem seguir os skills `release`, `marketing`, `docs` e/ou `implementation`, conforme a area tocada.

## Problemas e sugestoes

- Bugs: inclua passos para reproduzir, comportamento esperado, comportamento atual e ambiente.
- Features: descreva o caso de uso, impacto esperado e restricoes conhecidas.
- Duvidas: verifique `README.md`, `CONTRIBUTING.md`, `AGENTS.md`, issues e PRs existentes antes de abrir algo novo.
