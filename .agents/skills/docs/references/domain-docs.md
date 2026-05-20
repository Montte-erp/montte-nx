# Domain Docs

Use para gerar arquivos em `docs/project`.

## Arquivos obrigatorios

- `platform.md`: monorepo, apps, core, modules, packages, tooling, oRPC, Drizzle, TanStack Start, PostHog e padroes transversais.
- `auth-organizations.md`: Better Auth, organizacoes, times, sessao, permissoes e onboarding.
- `finance.md`: financeiro, transacoes, categorias, bancos, cartoes, configuracoes financeiras e integracoes.
- `crm-services.md`: contatos, servicos, beneficios, tags/centro de custo, assinaturas e dominio comercial.
- `billing.md`: cobranca, HyprPay, usage events, meters, subscriptions, invoices e regras de billing.
- `ai-agents.md`: Montte AI, agentes, ferramentas, skill catalog, OpenRouter/TanStack AI e analytics de IA.
- `frontend.md`: rotas, loaders, TanStack Query, forms, tabelas, estado, UI conventions, SSR e a11y.
- `workflows.md`: DBOS, worker, filas, workflows existentes, startup, scheduling e testes.
- `operations.md`: setup local, comandos, CI, release weekly, documentacao automatica, troubleshooting e validacoes.
- `recent-changes.md`: mudancas recentes desde a ultima release agrupadas por dominio.

## Estrutura obrigatoria por arquivo

```markdown
# <Domínio> — $PROJECT_NAME

Última atualização: $RELEASE_VERSION

## Escopo
<O que cobre e quais partes do repo pertencem ao dominio.>

## Mapa do código
| Caminho | Responsabilidade | Observações |
|---|---|---|

## Fluxos principais
<Entrada, processamento e saida dos fluxos relevantes.>

## APIs e dados
<Routers, schemas, tabelas, ownership, transacoes e contratos quando existirem.>

## Operação e validação
<Comandos, testes, checks, riscos e troubleshooting especificos.>

## Checklist de manutenção
<Lista objetiva antes de alterar este dominio.>
```

## Regras de conteudo

- Use caminhos reais do repositorio.
- Se uma area nao aparecer no contexto, escreva que nao foi identificada no contexto coletado.
- `recent-changes.md` pode trocar a estrutura padrao por agrupamento de mudancas, mas deve manter data/versao e links/caminhos verificaveis quando existirem.
- Evite repetir o mesmo texto entre dominios; cada arquivo deve ajudar uma alteracao concreta naquele dominio.
