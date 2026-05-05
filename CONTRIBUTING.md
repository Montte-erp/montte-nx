# Contribuindo com o Montte

Montte é um ERP com IA em um monorepo Nx. O produto principal roda em `apps/web`, os workflows duráveis rodam em `apps/worker`, a infraestrutura compartilhada fica em `core/` e a lógica de domínio fica em `modules/`.

## Pré-requisitos

- [Bun](https://bun.sh) >= 1.x
- [Node.js](https://nodejs.org) >= 22.12 (engines)
- [Docker](https://www.docker.com) ou [Podman](https://podman.io) com Compose
- [Git](https://git-scm.com)

## Setup Inicial

```bash
git clone https://github.com/Montte-erp/montte-nx.git
cd montte-nx
bun install
bun run setup
```

Na primeira execução, `bun run setup` cria `apps/web/.env.local` a partir de `apps/web/.env.example` e para para você revisar as variáveis. Rode `bun run setup` novamente depois de preencher o arquivo; o script sobe os containers locais e aplica o schema com `bun run db:push`.

Use `bun dev` depois do setup. Ele garante `.env.local`, instala dependências se necessário, tenta subir os containers locais, roda `bun run db:push` e inicia `web` e `worker`.

## Comandos

```bash
bun dev                  # dev-init + web + worker
bun dev:staging          # web em modo staging
bun dev:all              # todos os apps e pacotes com target dev
bun run build            # build via Nx cache
bun run typecheck        # typecheck via Nx
bun run check            # oxlint
bun run format           # oxfmt --write
bun run format:check     # oxfmt --check
bun run test             # testes via Nx
bun run test:coverage    # testes via Nx com coverage
bun run db:push          # aplica schema no banco local
bun run db:push:prod     # aplica schema em produção
bun run db:studio:local  # Drizzle Studio local
bun run db:studio:prod   # Drizzle Studio produção
bun run check-boundaries # valida regras de importação
bun run doctor           # diagnóstico do ambiente
bun run clean            # limpeza segura
bun run clean:cache      # limpa cache
bun run auth:generate    # regenera schema do Better Auth
```

Scripts de workspace ficam em `scripts/`: `setup.ts`, `dev-init.ts`, `doctor.ts`, `clean.ts`, `db-push.ts`, `ensure-schemas.ts`, `check-env.ts`, `env-setup.ts`, `seed-default-dashboard.ts`, `backfill-category-icons.ts`.

Se `bun dev` falhar antes de iniciar os apps, rode `bun run scripts/doctor.ts` e confira `apps/web/.env.local`.

## Estrutura

```text
montte-nx/
├── apps/
│   ├── web/             # TanStack Start SSR + agregador oRPC
│   └── worker/          # runtime DBOS para workflows duráveis
├── core/                # infraestrutura compartilhada, sem regra de domínio
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
├── modules/             # domínios de negócio
│   ├── account/         # perfil, org, times, sessões, API keys, onboarding
│   ├── agents/          # Rubi, threads, tools e skills
│   ├── billing/         # serviços, medidores, preços, assinaturas, uso
│   ├── classification/  # categorias, tags e workflows de categorização
│   ├── finance/         # contas, transações e cartões
│   └── insights/        # dashboards, insights e analytics
├── packages/
│   └── ui/              # componentes de UI compartilhados
└── tooling/             # boundaries, oxc, Tailwind e tsconfigs
```

Novos domínios devem nascer em `modules/<nome>` como pacote `@modules/<nome>`. Cada módulo deve ser dono de seus `router/`, `services/`, `workflows/`, `contracts/` e `sse/` quando existirem.

`apps/web` apenas hospeda a UI e agrega routers em `apps/web/src/integrations/orpc/router/index.ts`. `apps/worker` importa workflows dos módulos e executa DBOS fora do processo web.

## Padrões De Código

- Conteúdo de produto e mensagens visíveis ao usuário devem ser pt-BR.
- oRPC usa `WebAppError`; não use `ORPCError`, `Error` cru ou strings em handlers.
- Queries e schemas de banco ficam em Drizzle; schemas sempre usam namespaces, nunca `pgTable` cru.
- Escritas no banco ficam dentro de `db.transaction(async (tx) => ...)`.
- Não crie repository layer para routers; consulte `context.db` diretamente.
- Use `neverthrow` para erros em TypeScript; evite `try/catch` fora de testes e scripts.
- Não use type casts com `as`; corrija o tipo na origem.
- Datas usam `dayjs`; evite `new Date()` fora das exceções documentadas em `AGENTS.md`.
- Frontend chama oRPC via TanStack Query; componentes não devem chamar `orpc.*` diretamente.
- Modais, sheets e drawers usam `useCredenza`; confirmações destrutivas usam `useAlertDialog`.

## Skills

Antes de mexer em um domínio, abra o skill correspondente. O conteúdo do skill tem precedência sobre instruções antigas.

Skills do repositório ficam em `.agents/skills/<nome>/SKILL.md`. Skills específicos do OpenCode ficam em `.opencode/skills/<nome>/SKILL.md`.

Mapa rápido:

- oRPC handlers e erros: `neverthrow`
- oRPC client e TanStack Query: `tanstack-query`
- Banco, schemas e queries: `postgres-drizzle`
- ParadeDB e busca: `paradedb-skill`
- Redis: `redis-best-practices`
- DBOS e workflows: `dbos-typescript`
- Better Auth: `better-auth-best-practices`
- Formulario: `tanstack-form`
- Rotas e loaders: `tanstack-router`, `tanstack-start`
- Tabelas: `tanstack-table`, `tanstack-virtual`
- shadcn e UI primitives: `shadcn`
- UI/UX e acessibilidade: `ui-ux-expert`, `wcag-audit-patterns`
- Nx workspace: `nx-workspace`
- Geradores Nx: `nx-generate`
- Tarefas Nx: `nx-run-tasks`
- CI Nx Cloud: `monitor-ci`
- Linear: `linear-cli`

Para skills TanStack Intent, siga o bloco de mapeamento em `AGENTS.md` e carregue com `npx @tanstack/intent@latest load <use>`.

## Testes E Verificação

```bash
bun run format
bun run check
bun run typecheck
bun run test
```

Prefira rodar tarefas via Nx (`bun nx run`, `bun nx run-many` ou scripts que já usam Nx). Não chame ferramentas internas diretamente quando houver target Nx equivalente.

Testes vivem em `core/*`, `modules/*`, `packages/*` e `__tests__/` de workspace. Não adicione testes unitários, integração ou snapshots em `apps/*` enquanto o projeto não tiver E2E padronizado.

Para um arquivo específico, use Vitest diretamente quando não houver target Nx mais adequado:

```bash
npx vitest run modules/billing/src/__tests__/exemplo.test.ts
```

## Fluxo De PR

1. Atualize `master` antes de iniciar trabalho novo.
2. Crie branch com o identificador da issue quando existir: `manoelnetocarvalho03/mon-123-descricao-curta`.
3. Trabalhe em uma worktree quando houver outras mudanças locais em andamento.
4. Mantenha o PR pequeno e focado; separe refactors amplos de mudanças comportamentais.
5. Atualize documentação junto com mudanças de fluxo, comandos, arquitetura ou comportamento público.
6. Rode as verificações relevantes antes de abrir o PR.
7. Abra PR contra `master` com título objetivo, resumo do que mudou e validações executadas.
8. Se houver risco conhecido ou validação que não foi rodada, declare isso no PR.

Commits devem ser curtos e descritivos, por exemplo `docs: revisar guia de contribuição`.

## Problemas E Sugestões

- Bugs: inclua passos para reproduzir, comportamento esperado, comportamento atual e ambiente.
- Features: descreva o caso de uso, impacto esperado e qualquer restrição conhecida.
- Dúvidas: verifique `README.md`, `AGENTS.md`, issues e PRs existentes antes de abrir algo novo.
