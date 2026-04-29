# Plano — Tour onboarding nos serviços

## Escopo

Tour guiado ensina leigo usar Catálogo + Medidores + Benefícios + Cupons como hive mind. Cobre primeira visita cada tela. AI chat fora desse PR.

## Stack

- **Componente:** `packages/ui/src/components/tour.tsx` (já adicionado). Implementação própria — `TourProvider` + `useTour` + `TourAlertDialog`. SVG mask spotlight, Framer Motion, sem deps externas tipo driver.js.
- **API:** `<TourProvider tours={[{id, steps}]} onStart onComplete onSkip onStepChange>` envolve árvore. Hook `useTour()` expõe `startTour(id)`, `endTour`, `currentStep`, `isActive`, `isTourCompleted`, `setIsTourCompleted`.
- **Selectors:** `step.selectorId` casa com `id="..."` no DOM (não `data-tour`). Adicionar `id` nos elementos alvo.
- **Persistência:** `createPersistedStore("montte:tour-state")` em `@/lib/store` — `{ completed: string[], dismissed: string[] }`. Sync com `setIsTourCompleted` no provider.
- **SSR safety:** componente já marcado `"use client"`. Trigger via `createClientOnlyFn` se loader tocar.
- **Telemetria:** PostHog `tour_step_viewed` / `tour_completed` / `tour_dismissed` nos callbacks `onStart/onComplete/onSkip/onStepChange`.

## Arquitetura — sem features folder

Colocação por rota (TanStack ignora prefixo `-`):

```
apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/services/
  index.tsx
  -tour/
    store.ts                  # createPersistedStore montte:tour-state
    use-tour-trigger.ts       # gating: completed/dismissed → startTour
    tour-help-button.tsx      # botão ? no header → restart(tourId)
    services-overview.tour.ts # steps array
  -services/
    service-detail.tour.ts
  -meters/
    meters-intro.tour.ts
  -benefits/
    benefits-intro.tour.ts
  -coupons/
    coupons-intro.tour.ts
```

`TourProvider` montado no layout `_dashboard.tsx` (ou layout services). Cada rota chama `useTourTrigger(tourId)` que dispara `startTour(id)` se `!completed.has(id) && !dismissed.has(id)`.

Definição de tour:
```ts
export const servicesOverviewTour: TourDefinition = {
   id: "services-overview",
   steps: [{ selectorId: "services-sidebar-catalog", content: <>…</>, position: "right" }, …],
};
```

## Tours (5 total)

1. **`services-overview`** (`/services`)
   - Sidebar: Catálogo / Medidores / Benefícios / Cupons (1 frase cada).
   - Header: "Crie seu primeiro serviço aqui."
   - Tabs Todos/Ativos/Arquivados.

2. **`service-detail`** (`/services/$serviceId` primeiro acesso)
   - Tabs Preços → Benefícios → Assinantes → Overview.
   - Toolbar contextual + ações globais.
   - Context panel direita.

3. **`meters-intro`** (`/services/meters`)
   - Conceito medidor.
   - Conexão preços/benefícios/cupons.
   - MeterUsagePanel.

4. **`benefits-intro`** (`/services/benefits`)
   - Perks vs Credits.
   - Anexar a serviço.

5. **`coupons-intro`** (`/services/coupons`)
   - Direção / gatilho / escopo.
   - Exemplo Sábado +40%.

## Microcopy

Step = título curto + 1 frase. Sem jargão:
- "metered" → "preço por consumo"
- "aggregation: sum" → "soma os valores"
- "scope: meter" → "aplicado quando consumir esse medidor"

Botões nativos do componente já em pt-BR: Voltar / Próximo / Concluir / Pular tour. `TourAlertDialog` também pt-BR.

## Triggers e re-trigger

- Auto-start primeira visita rota via `useTourTrigger`.
- `TourHelpButton` no header chama `startTour(id)` manual (precisa resetar `isTourCompleted` antes).
- Bump `tourId` (`services-overview-v2`) força re-fire pós mudança schema.

## Tarefas

1. **Store** — `services/-tour/store.ts` com `createPersistedStore("montte:tour-state", { completed: [], dismissed: [] })`.
2. **Trigger hook** — `use-tour-trigger.ts`: lê store + chama `startTour` se elegível. Sync `onComplete` → push `completed`, `onSkip` → push `dismissed`.
3. **Provider mount** — montar `<TourProvider tours={[…]} onStart onComplete onSkip onStepChange>` no layout services. Tours array agrega 5 definições.
4. **Definir 5 tours** — arquivos `*.tour.ts` colocados por rota. Adicionar `id="..."` nos elementos referenciados.
5. **TourHelpButton** — header de cada rota services, `onClick={() => { setIsTourCompleted(false); startTour(id); }}`.
6. **Telemetria** — `posthog.capture` nos 4 callbacks do provider.
7. **A11y** — Esc fecha (já implementado), foco no popover, `aria-live` no content.
8. **Test smoke** — `localStorage.removeItem("montte:tour-state")`, abrir rota, confirmar fire.

## Decisões abertas

- **Auto-start vs opt-in?** Default auto. Skip → dismissed.
- **Tour multi-tab no service-detail** — componente atual não troca tab automático. Opções: (a) só Preços + help button reabre noutra; (b) `onClickWithinArea` step para guiar usuário a clicar tab.
- **Mobile?** Spotlight SVG funciona mas apertado. Esconder <640px via `useMediaQuery`.

## Fora desse PR

- AI chat config.
- Wizard/templates.
- Tour fluxos avançados (workflow/billing).

## Sequência

1 → 2 (infra) → 3 (provider) → 4 (1 tour por vez começando `services-overview`) → 5 → 6 → 7 → 8.
