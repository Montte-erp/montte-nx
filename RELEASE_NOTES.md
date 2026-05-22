Esta release traz o novo chat do Montte AI com interface AG-UI, relatórios empresariais e blog público. No financeiro, chegam parcelamento e lançamentos recorrentes, além do módulo de cartões com fechamento automático de faturas.

## Em destaque

### Novo chat do Montte AI ([#966](https://github.com/Montte-erp/montte-nx/pull/966))

Interface completamente reconstruída com exibição de ferramentas, indicadores e badges, streaming mais confiável e suporte a ferramentas de leitura financeira.

### Relatórios empresariais ([#937](https://github.com/Montte-erp/montte-nx/pull/937))

Nova seção de relatórios com tipos monetários precisos, detalhamento por rota e interface redesenhada.

### Blog do Montte ([#933](https://github.com/Montte-erp/montte-nx/pull/933))

Blog público no site com RSS, imagens OG e SEO.

## Ação necessária

### Remoção do módulo de contatos ([#938](https://github.com/Montte-erp/montte-nx/pull/938), [#962](https://github.com/Montte-erp/montte-nx/pull/962))

**Quem é afetado:** Usuários que utilizavam o módulo de contatos
**O que fazer:** O módulo de contatos foi removido do produto.

## Novidades por área

### Financeiro

- Lançamentos parcelados ([#934](https://github.com/Montte-erp/montte-nx/pull/934))
- Lançamentos recorrentes ([#935](https://github.com/Montte-erp/montte-nx/pull/935))

### Cartões

- Módulo de cartões extraído com rota de faturas ([#959](https://github.com/Montte-erp/montte-nx/pull/959))
- Fechamento manual de fatura ([#961](https://github.com/Montte-erp/montte-nx/pull/961))
- Fechamento automático de faturas ([#960](https://github.com/Montte-erp/montte-nx/pull/960))

### Landing Page

- Hero refinado para operações recorrentes ([#965](https://github.com/Montte-erp/montte-nx/pull/965))
- Proteção da waitlist com ArcJet contra abuso ([#967](https://github.com/Montte-erp/montte-nx/pull/967))

### Montte AI

- Ferramentas de leitura financeira ([#972](https://github.com/Montte-erp/montte-nx/pull/972))

### Categorias e Tags

- Categorias migradas para TanStack DB ([#975](https://github.com/Montte-erp/montte-nx/pull/975))
- Tags migradas para TanStack DB com validação de conflito ([#974](https://github.com/Montte-erp/montte-nx/pull/974))

### Cashbook

- Cashbook extraído do módulo de finance ([#963](https://github.com/Montte-erp/montte-nx/pull/963))

## Correções

### Web

- Ordenação dos cartões corrigida ([#976](https://github.com/Montte-erp/montte-nx/pull/976))
- Popover de edição em massa não abre mais atrás da interface ([#936](https://github.com/Montte-erp/montte-nx/pull/936))
- Toasts de carregamento em fluxos de auth corrigidos ([#944](https://github.com/Montte-erp/montte-nx/pull/944))
- Mapeamento de logos de bancos corrigido ([#951](https://github.com/Montte-erp/montte-nx/pull/951))

### Montte AI

- Compilação do prompt do advisor corrigida ([#953](https://github.com/Montte-erp/montte-nx/pull/953))
- Agente não tentava atualizar thread vazia ([#957](https://github.com/Montte-erp/montte-nx/pull/957))

## Melhorias

- Mensagens de erro do Montte AI agora em pt-BR ([#954](https://github.com/Montte-erp/montte-nx/pull/954))

<details>
<summary><strong>Notas técnicas</strong> (para o time)</summary>

- Refactor(account): substitui neverthrow por better-result ([#970](https://github.com/Montte-erp/montte-nx/pull/970))
- Refactor(insights): migra error handling para better-result e evlog ([#969](https://github.com/Montte-erp/montte-nx/pull/969))
- Refactor(inbox): migra para better-result ([#968](https://github.com/Montte-erp/montte-nx/pull/968))
- Remove schemas não utilizados e migra para better-result ([#948](https://github.com/Montte-erp/montte-nx/pull/948))
- Refactor agents runtime jobs ([#950](https://github.com/Montte-erp/montte-nx/pull/950))
- Remove pacote SSE do core ([#949](https://github.com/Montte-erp/montte-nx/pull/949))
- Desacopla AgentRuntimeError dos payloads de job ([#958](https://github.com/Montte-erp/montte-nx/pull/958))
- Lock transacional explícito no chat ([#955](https://github.com/Montte-erp/montte-nx/pull/955))
- Refactor agents resultgen flows ([#956](https://github.com/Montte-erp/montte-nx/pull/956))
- Observabilidade de AI migrada para TanStack OTEL middleware ([#939](https://github.com/Montte-erp/montte-nx/pull/939))
- Logging migrado para evlog ([#942](https://github.com/Montte-erp/montte-nx/pull/942))
- Integra better-notify como camada unificada de notificações ([#943](https://github.com/Montte-erp/montte-nx/pull/943))
- Runtime DBOS isolado no worker ([#941](https://github.com/Montte-erp/montte-nx/pull/941))
- Limpeza e melhoria do core utils ([#947](https://github.com/Montte-erp/montte-nx/pull/947))
- Refactor dos forms de configuração da organização ([#945](https://github.com/Montte-erp/montte-nx/pull/945))
- Refactor classification result boundaries ([#952](https://github.com/Montte-erp/montte-nx/pull/952))
- Remove schema de contacts e referências ([#962](https://github.com/Montte-erp/montte-nx/pull/962))
- Adiciona suporte Tauri para desktop ([#973](https://github.com/Montte-erp/montte-nx/pull/973))
- Cashbook: refactors de erro para better-result e evlog, extração de finance ([#963](https://github.com/Montte-erp/montte-nx/pull/963))

</details>

<details>
<summary><strong>Manutenção</strong></summary>

- docs: atualiza skills de marketing, design, code-review, docs e release
- docs: atualiza CONTRIBUTING.md e README
- docs(better-result): atualiza documentação do padrão de erros
- chore: atualiza TanStack AI packages
- chore: sync lockfile para ag-ui core
- ci: adiciona workflow para auto-gerar blog posts a partir de releases
- refactor(landing): migra para variáveis de ambiente tipadas do Astro

</details>

---

**Contribuíram nesta release:** @Yorizel
