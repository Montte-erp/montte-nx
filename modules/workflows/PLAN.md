# Workflows Module — Plano v1

Módulo de automação baseado em React Flow, template-first, para usuários leigos. Inspirado em Twenty e PostHog hog flows.

## Escopo v1

- **Trigger único:** schedule (data/cron). Sem event-based, webhook ou manual triggers v1.
- **Action única:** criar relatório (saved report no módulo `insights`). Sem email, export, delivery externo.
- **Sem builder do zero:** todo workflow nasce de template. Canvas é editor de config, não construtor livre.
- **Sem versionamento:** edição mutável direto na linha do `workflows`.

## Não-objetivos v1

- Event-based triggers (`record.created`, `record.updated`, …)
- Webhooks, HTTP actions, email, Slack, qualquer delivery externo
- Branches, condicionais, loops, parallel
- Builder livre (criar workflow sem template)
- Versionamento (histórico de mudanças no graph)
- Multi-step (>1 action por workflow)
- Variáveis entre nodes / templating

---

## Arquitetura

### Módulo: `modules/workflows/`

```
modules/workflows/
├── PLAN.md                  # este doc
├── package.json
├── src/
│   ├── schema.ts            # drizzle: workflows, workflow_runs
│   ├── templates.ts         # 5 templates const, hardcoded
│   ├── router.ts            # oRPC: list, get, createFromTemplate, update, activate, pause, runNow, runs.list
│   ├── compiler.ts          # graph → DBOS step
│   ├── workflows/
│   │   └── execute-workflow.workflow.ts   # DBOS workflow
│   ├── scheduler.ts         # poller (DBOS scheduled + query de workflows devidos)
│   ├── data-source.ts       # workflowsDataSource (segue padrão dos outros módulos)
│   └── setup-workflows.ts   # setupWorkflowsWorkflows(deps) p/ worker
└── __tests__/
```

Aderente às memórias:
- [feedback_no_repositories] — routers usam `context.db`; workflows usam `workflowsDataSource.runTransaction`
- [feedback_module_workflow_setup] — `setupWorkflowsWorkflows(deps)` exposto pro worker
- [feedback_code_style_workflows] — workflows usam DrizzleDataSource, sem repos, sem raw db

### Schema (Drizzle)

```ts
// modules/workflows/src/schema.ts
export const workflows = pgTable("workflows", {
  id: uuid("id").primaryKey().defaultRandom(),
  teamId: uuid("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  templateId: text("template_id").notNull(),         // e.g. "dre-monthly"
  name: text("name").notNull(),
  status: text("status", { enum: ["active", "paused"] }).notNull().default("active"),
  graph: jsonb("graph").notNull().$type<WorkflowGraph>(),
  // graph = { nodes: ReactFlowNode[], edges: ReactFlowEdge[] }
  nextRunAt: timestamp("next_run_at", { withTimezone: true }),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("workflows_team_id_status_idx").on(table.teamId, table.status),
  index("workflows_next_run_at_idx").on(table.nextRunAt),
]);

export const workflowRuns = pgTable("workflow_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  workflowId: uuid("workflow_id").notNull().references(() => workflows.id, { onDelete: "cascade" }),
  status: text("status", { enum: ["pending", "running", "succeeded", "failed"] }).notNull(),
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  reportId: uuid("report_id").references(() => reports.id),
  idempotencyKey: text("idempotency_key").notNull(),
  error: text("error"),
  triggeredBy: text("triggered_by", { enum: ["schedule", "manual"] }).notNull(),
}, (table) => [
  uniqueIndex("workflow_runs_workflow_id_scheduled_for_idempotency_key_uq").on(
    table.workflowId,
    table.scheduledFor,
    table.idempotencyKey,
  ),
  index("workflow_runs_workflow_id_status_idx").on(table.workflowId, table.status),
  index("workflow_runs_scheduled_for_status_idx").on(table.scheduledFor, table.status),
]);
```

### Graph shape (React Flow)

```ts
type WorkflowGraph = {
  nodes: [ScheduleTriggerNode, CreateReportNode];   // tupla fixa v1
  edges: [{ id: "e-trigger-action"; source: "trigger"; target: "action" }];
};

export const reports = pgTable("reports", {
  // ... campos existentes ...
  source: text("source", { enum: ["manual", "workflow"] })
    .notNull()
    .default("manual"),
});

type ScheduleTriggerNode = {
  id: "trigger";
  type: "scheduleTrigger";
  position: { x: number; y: number };
  data: {
    cron: string;                       // "0 9 1 * *"
    timezone: "America/Sao_Paulo";     // hardcoded, with fallback/validation in backend
    humanLabel: string;                 // "Todo dia 1 às 09:00"
  };
};

type CreateReportNode = {
  id: "action";
  type: "createReport";
  position: { x: number; y: number };
  data: {
    reportType: "dre" | "cash-flow" | "cost-centers" | "aging" | "categories";
    period: { kind: "previous-month" | "previous-week" | "current-month" | "current-week" };
    nameTemplate: string;               // "DRE — {month} {year}"
  };
};
```

---

## Templates v1

Hardcoded em `modules/workflows/src/templates.ts`. Refletem os 5 tipos do `insights.reports`.

| ID                      | Nome                              | Tipo relatório  | Cron default        | Período         |
| ----------------------- | --------------------------------- | --------------- | ------------------- | --------------- |
| `dre-monthly`           | DRE mensal                        | `dre`           | `0 9 1 * *`         | previous-month  |
| `cash-flow-weekly`      | Fluxo de caixa semanal            | `cash-flow`     | `0 9 * * 1`         | previous-week   |
| `cost-centers-monthly`  | Centro de Custo mensal            | `cost-centers`  | `0 9 1 * *`         | previous-month  |
| `aging-weekly`          | A receber/pagar semanal           | `aging`         | `0 9 * * 1`         | current-week    |
| `categories-monthly`    | Despesas por categoria mensal     | `categories`    | `0 9 1 * *`         | previous-month  |

Cada template define:
- `id`, `name`, `icon`, `description`
- `defaultGraph` — `{nodes, edges}` pré-preenchido
- `editableFields` — quais campos do graph aparecem no drawer "Ativar" (v1: só horário)

---

## oRPC Router

```
workflows.list                  → Workflow[]
workflows.get({ id })           → Workflow
workflows.createFromTemplate({ templateId, schedule, name? })  → Workflow
workflows.update({ id, graph }) → Workflow
workflows.activate({ id })      → Workflow
workflows.pause({ id })         → Workflow
workflows.remove({ id })        → void
workflows.runNow({ id })        → WorkflowRun
workflows.runs.list({ workflowId, limit?, cursor? }) → WorkflowRun[]
workflows.runs.get({ id })      → WorkflowRun
workflows.templates.list        → Template[]   (static, retorna `templates.ts`)
```

No fluxo manual de criação de relatório (`insights.create`), o `source` deve permanecer `manual` (default).
Workflows sempre devem persistir `source: "workflow"` ao inserir na tabela `reports`.

Middlewares: `teamScopedProcedure` (segue padrão atual). Ownership do workflow via middleware que injeta entity em `context`.

---

## DBOS Runtime

### Scheduled jobs

DBOS suporta `@DBOS.scheduled(cron)`. Mas cron é estático por decorator — precisa registry dinâmico.

**Decisão v1:** usar um único poller com DBOS scheduled workflow a cada minuto (`DBOS.scheduled("* * * * *")`) que consulta `workflows.nextRunAt` e dispara os workflows devidos.

O cálculo de próximo disparo é persistido em `workflows.nextRunAt` via `cron-parser` em `createFromTemplate`, `activate` e ao final de cada execução (inclusive em falha).

Regras operacionais:

- Query do poller deve usar `SELECT ... FOR UPDATE SKIP LOCKED` com `limit` por lote para evitar concorrência entre instâncias em HA.
- Antes de enfileirar execução, o poller cria um registro em `workflow_runs` com idempotency key formatada como `${workflowId}-${scheduledFor.toISOString()}`.
- O `workflow_runs` usa constraint única (`workflowId`, `scheduledFor`, `idempotencyKey`) para garantir idempotência de execução.
- O poller passa `workflowId`, `runId`, `scheduledFor` e `triggeredBy` para a execução de workflow.
- `computePeriod` no runtime usa `scheduledFor` (não `new Date()`) e o timezone do workflow para manter as janelas consistentes com a programação.
- `previous-month` no dia 1/09h gera o mês **completo anterior**.
  Ex.: execução agendada para 01/06 às 09:00 calcula `2026-05`. 


### Workflow body

```ts
// modules/workflows/src/workflows/execute-workflow.workflow.ts
export class ExecuteWorkflowWorkflow {
  @DBOS.workflow()
  static async run(
    workflowId: string,
    runId: string,
    scheduledFor: Date,
    triggeredBy: "schedule" | "manual",
  ) {
    const wf = await workflowsDataSource.runTransaction(async (tx) => /* load */);

    try {
      await markRunRunning(runId);

      const reportNode = wf.graph.nodes.find(
        (n) => n.type === "createReport",
      );
      const period = computePeriod(reportNode.data.period, scheduledFor);
      const reportName = renderName(reportNode.data.nameTemplate, period);

      const report = await ExecuteWorkflowWorkflow.createReportStep({
        teamId: wf.teamId,
        type: reportNode.data.reportType,
        name: reportName,
        period,
      });

      await markRunSucceeded(runId, report.id);
      await updateNextRunAt(wf.id);
    } catch (err) {
      await markRunFailed(runId, err);
      await updateNextRunAt(wf.id);
    }
  }

  @DBOS.step()
  static async createReportStep(input) {
    return insightsDataSource.runTransaction(async (tx) => {
      return tx
        .insert(reports)
        .values({ ...input, source: "workflow" })
        .returning();
    });
  }
}

function computePeriod(kind: WorkflowPeriod, scheduledFor: Date) {
  if (kind.kind === "previous-month") {
    const periodEnd = new Date(
      scheduledFor.getFullYear(),
      scheduledFor.getMonth(),
      1,
    );
    return {
      from: new Date(periodEnd.getFullYear(), periodEnd.getMonth() - 1, 1),
      to: periodEnd,
    };
  }
  // current-month, previous-week, current-week mantem implementacao atual
  // baseado em scheduledFor (timezone de operação já normalizado)
}

```

### Compiler v1

Trivial: 1 trigger + 1 action. `compiler.ts` lê graph, extrai `reportNode.data`, retorna input pro step. v2 vira topo-walk.

---

## Frontend (apps/web)

### Rotas

```
/workflows                       → galeria templates + meus workflows
/workflows/$workflowId           → canvas React Flow + painel config
/workflows/$workflowId/runs      → histórico execuções (tab)
```

### Telas

#### `/workflows` (index)

- Header: "Automações" + descrição
- Seção **Templates** — grid 3 colunas, 5 cards. Cada card: ícone, nome, descrição curta, badge "Mensal"/"Semanal".
- Seção **Meus workflows** — DataTable padrão (segue `data-table-pattern` skill): nome, template, status (active/paused), última execução, próxima execução, ações.

#### Drawer "Ativar template"

Abre ao clicar card. Campos:
- Nome (default = nome do template)
- Horário (picker visual: "Toda [semana/mês] na [segunda/dia X] às [HH:MM]")
- Botão "Ativar" — chama `createFromTemplate`, navega pra `/workflows/$id`

#### `/workflows/$workflowId` (canvas)

Layout:
```
┌─────────────────────────────────────────────────┐
│ ← Voltar    [Nome editável]    [Pausar] [▶ Rodar agora] │
├──────────────────────────────────┬──────────────┤
│                                  │              │
│   ┌─────────────────────┐        │   Config     │
│   │ ⏰ Toda segunda 09h  │        │              │
│   └──────────┬──────────┘        │   [campos    │
│              │                   │    do node   │
│              ↓                   │    selecio-  │
│   ┌─────────────────────┐        │    nado]     │
│   │ 📊 Fluxo de caixa   │        │              │
│   └─────────────────────┘        │              │
│                                  │              │
│   Próxima execução: seg 25/05    │              │
└──────────────────────────────────┴──────────────┘
```

React Flow config:
- `nodesDraggable={false}`
- `nodesConnectable={false}`
- `edgesUpdatable={false}`
- `deleteKeyCode={null}`
- Auto-layout vertical via `dagre` ou posições hardcoded no template
- Zoom/pan livre
- Click no node → painel direito mostra form de config

Custom nodes:
- `ScheduleTriggerNode` — `@xyflow/react` custom; mostra ícone relógio + `humanLabel`
- `CreateReportNode` — ícone dinâmico por `reportType`, mostra "Relatório: {nome}" + "Período: mês anterior"

Painel config:
- Trigger node: cron picker visual (mesmo do drawer ativar)
- Action node: select `reportType` + select `period` + input `nameTemplate`

Salvar: mutation `update` no blur/debounce 500ms.

#### Tab "Execuções" (`/workflows/$id/runs`)

DataTable: data execução, status (badge), relatório gerado (link → `/reports/$reportId`), tempo de execução, erro (se falhou).

### Componentes novos (apps/web)

```
apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/workflows/
├── index.tsx                          # galeria + lista
├── $workflowId/
│   ├── index.tsx                      # canvas
│   └── runs.tsx                       # histórico
└── -workflows/
    ├── template-card.tsx
    ├── activate-template-drawer.tsx
    ├── canvas/
    │   ├── workflow-canvas.tsx        # React Flow wrapper
    │   ├── schedule-trigger-node.tsx
    │   ├── create-report-node.tsx
    │   └── node-config-panel.tsx
    ├── schedule-picker.tsx            # "Toda [X] às [HH:MM]"
    └── workflow-status-badge.tsx
```

### Deps a adicionar

- `@xyflow/react` (React Flow v12)
- `cron-parser` (calcular next run, no servidor)
- `dagre` ou layout manual (canvas vertical fixo dispensa)

---

## Schedule picker (UX leigo)

Em vez de cron expression, dropdowns:

- O frontend sempre grava `timezone: "America/Sao_Paulo"` na trigger.
- O backend valida/fallback para `America/Sao_Paulo` ao persistir/ativar workflow.

```
Repetir: [ Toda semana ▼ ]   ← uma vez / toda semana / todo mês
Dia:     [ Segunda ▼ ]        ← se semanal
Dia:     [ Dia 1 ▼ ]          ← se mensal
Horário: [ 09:00 ▼ ]
```

Converter pra cron internamente. `humanLabel` gerado pra exibição no node.

---

## Permissões / Billing

- Aderir [feedback_payg_gate] se gerar relatório for cost-incurring. Hoje `insights.reports.create` não cobra — workflows herdam mesmo gate.
- Reaproveitar middleware `teamScopedProcedure`.

---

## Testes

- `__tests__/router.test.ts` — createFromTemplate, activate, pause, runNow
- `__tests__/scheduler.test.ts` — next_run_at calc, poller pega due workflows
- `__tests__/execute-workflow.workflow.test.ts` — DBOS workflow gera report e marca run succeeded/failed
- Aderente à skill `orpc-testing`

---

## Plano de execução

### Sprint 1 — Backend foundation
1. Criar `modules/workflows/` (package.json, schema, data-source)
2. Migração drizzle (`workflows`, `workflow_runs`)
3. `templates.ts` com os 5 templates
4. Router oRPC (list, get, createFromTemplate, update, activate, pause, remove, runs.list)
5. Tests do router

### Sprint 2 — Runtime
1. `execute-workflow.workflow.ts` (DBOS workflow + step createReport)
2. `scheduler.ts` poller (DBOS scheduled @ cada minuto)
3. `setupWorkflowsWorkflows(deps)` exposto pro worker
4. Wire no apps/worker
5. `runNow` mutation dispara DBOS workflow ad-hoc
6. Tests do workflow

### Sprint 3 — Frontend
1. Rota `/workflows` (galeria + lista)
2. `activate-template-drawer` + `schedule-picker`
3. Rota `/workflows/$id` com React Flow (read-mostly, click pra editar)
4. Custom nodes + config panel
5. Tab `/workflows/$id/runs`
6. Link "Ver relatório" → `/reports/$reportId`

### Sprint 4 — Polish
1. Empty states
2. Loading/error states
3. Pausar/ativar inline na lista
4. Confirm dialog em remove
5. Docs internas
6. Smoke test E2E (create template → ativa → runNow → vê report)

---

## Riscos & decisões em aberto

1. **Falha em createReport** — retry? **Sugestão v1:** marca run failed, sem retry automático. Usuário usa "Rodar agora".

2. **Deletar workflow com runs históricos** — `ON DELETE CASCADE` apaga runs. **OK v1**, ou soft-delete? **Sugestão:** cascade, ninguém vai auditar histórico de workflow excluído v1.

3. **Saved reports gerados por workflow** — aparecem na lista `/reports` misturados com manuais. **Decisão v1:** coluna `source: "manual" | "workflow"` em `reports`, com badge na listagem.

---

## Pós-v1 (visão)

- Event triggers (record.created/updated)
- Multi-step (várias actions encadeadas)
- Branches (`if` node)
- Delivery actions (email, slack, webhook)
- Builder livre (criar do zero)
- Variáveis entre nodes (templating `{{nodes.X.output.Y}}`)
- Versionamento + rollback
- Multi-tz
- Retry policies por node
- Marketplace de templates user-created
