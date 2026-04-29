# Plano — Tour onboarding nos serviços

## Escopo

Tour guiado que ensina o leigo a usar Catálogo + Medidores + Benefícios + Cupons como hive mind. Cobre primeira visita em cada tela. AI chat fica fora desse PR.

## Stack

- **Lib:** `driver.js` (`catalog:ui`, ~5kb, sem deps, mantido). Estilo niazmorshed.dev é compatível. Alternativa: `@reactour/tour` se quiser React-native.
- **Persistência:** `createPersistedStore("montte:tour-state")` em `@/lib/store` — `{ completed: string[], dismissed: string[] }`.
- **SSR safety:** wrapper `useTour()` via `createClientOnlyFn`. Driver instancia só no client.
- **Telemetria:** disparar evento PostHog `tour_step_viewed` / `tour_completed` / `tour_dismissed` por tour id.

## Arquitetura

```
apps/web/src/features/tour/
  use-tour.ts          # hook: start(tourId), complete, dismiss
  tour-store.ts        # createPersistedStore — completed/dismissed sets
  tours/
    services-overview.ts   # tour definitions (steps array)
    service-detail.ts
    meters-intro.ts
    benefits-intro.ts
    coupons-intro.ts
  tour-trigger.tsx     # auto-fire na rota, gated por store
```

Cada tour é `{ id, steps: DriveStep[], when: () => boolean }`. Hook `useTourTrigger(tourId)` montado em layout/rota dispara se `!completed.has(id) && !dismissed.has(id)`.

## Tours (5 total)

1. **`services-overview`** (rota `/services`)
   - Sidebar: aponta Catálogo / Medidores / Benefícios / Cupons.
   - Explica papel de cada um em 1 frase.
   - Header: "Crie seu primeiro serviço aqui."
   - Tabs Todos/Ativos/Arquivados: filtro de catálogo.

2. **`service-detail`** (rota `/services/$serviceId`, primeiro acesso)
   - Tabs: Preços (como cobra) → Benefícios (o que vai junto) → Assinantes (quem usa) → Overview (saúde).
   - Toolbar: ações contextuais por tab + ações globais (duplicar/arquivar/excluir).
   - Context panel direita: propriedades editáveis.

3. **`meters-intro`** (rota `/services/meters`)
   - Conceito: "Medidor rastreia consumo (horas, GB, mensagens)".
   - Como conecta: "Use em preços medidos, créditos de benefícios, e cupons por consumo."
   - MeterUsagePanel: ver uso real.

4. **`benefits-intro`** (rota `/services/benefits`)
   - Perks vs Credits: 2 exemplos visuais.
   - Como anexar a serviço.

5. **`coupons-intro`** (rota `/services/coupons`)
   - Direção (desconto/acréscimo), gatilho (auto/código), escopo (preço/medidor/equipe).
   - Exemplo: "Sábado +40% = surcharge auto, scope=meter, dia 6".

## Microcopy strategy

Em cada step, 1 título curto + 1 frase. Sem jargão técnico — substituir:

- "metered" → "preço por consumo"
- "aggregation: sum" → "soma os valores"
- "scope: meter" → "aplicado quando consumir esse medidor"

Botões: "Próximo" / "Pular tour" / "Não mostrar de novo" (último → adiciona em `dismissed`).

## Triggers e re-trigger

- Auto-start na primeira visita à rota.
- Botão `?` (help) no header chama `restart(tourId)` manualmente.
- Após mudança de schema relevante (ex.: nova primitiva), bumpar `tourId` (`services-overview-v2`) força re-fire em quem completou v1.

## Tarefas

1. **Setup lib** — adicionar `driver.js` ao `catalog:ui` no root `package.json`. Declarar em `apps/web/package.json`.
2. **Store** — `tour-store.ts` com `createPersistedStore` (chave `montte:tour-state`).
3. **Hook + trigger** — `use-tour.ts` (start/complete/dismiss) + `tour-trigger.tsx` componente que monta em layouts.
4. **Definir 5 tours** — arquivos por tour com steps + selectors de elementos. Adicionar `data-tour="..."` nos componentes referenciados.
5. **Botão help** — `TourHelpButton` no header de cada rota com `onClick={() => start(tourId)}`.
6. **Telemetria** — chamadas `posthog.capture` em start/complete/dismiss/step.
7. **A11y** — driver.js tem suporte; testar Esc fecha, foco em popover.
8. **Test smoke** — abrir rota com `localStorage.clear()`, confirmar tour fire.

## Decisões abertas

- **Auto-start agressivo vs opt-in?** Default: auto-start na primeira visita. Pular libera vai pra dismissed.
- **Tour por tab interno** (`service-detail`) — multi-step que troca tab? Driver.js permite `onNext` custom; ok mas frágil. Alternativa: tour só na tab Preços (default), help button reabre noutra tab.
- **Mobile?** Driver.js funciona, mas tour fica apertado. Esconder em telas <640px.

## Fora desse PR

- AI chat de configuração.
- Wizard/templates (descartado).
- Tour de fluxos avançados (workflow, billing engine).

## Sequência de execução

1 → 2 → 3 (infra) → 4 (1 tour por vez começando pelo `services-overview`) → 5 → 6 → 7 → 8.
