# Services / Billing Integration — Roadmap

Plano de evolução das telas Catálogo / Medidores / Benefícios / Cupons após Fase 1.

Fase 1 já implementada nesse PR (branch `services`):
- #14 Duplicar cupom + benefício (botão Copy ao lado de Excluir)
- #15 Empty states com CTA + link cross-tabela
- #16 Bulk actions (selection bar com Ativar/Desativar/Excluir)

Tudo que segue **NÃO está implementado** — cada item é um PR próprio.

---

## Fase 0 — Decisão pendente (bloqueia Fase 3)

### #13 Invoice paga vira `transaction` automática?

**Decisão de produto, não técnica.** Sem resposta, Fase 3 inteira é especulativa.

Opções:
- **Sim** — billing fecha o ciclo no caixa: fatura paga gera lançamento (income) com categoria/tag derivadas do serviço. Reconciliação automática via `transactions.invoiceId`.
- **Não** — billing continua mundo separado. Usuário lança no caixa manualmente quando recebe.

Definir antes de mergear qualquer schema migration de `transactions`.

---

## Fase 2 — Interatividade entre tabelas

### #17 Links navegáveis em células referenciais

**Problema:** combobox de `meterId`/`priceId`/`serviceId` mostra label mas não navega. Usuário precisa abrir nova aba e procurar.

**Escopo:**
- Cupom escopo=meter → célula Medidor vira link para `/services/meters?search=<name>` (ou rota de detail se existir).
- Benefício com meterId → idem.
- Coluna "usadoEm" (benefícios) vira lista de chips clicáveis para `/services/$serviceId`.
- Hover-card opcional com preview (nome + status + 1-2 métricas).

**Arquivos:**
- `apps/web/src/routes/.../services/-coupons/build-coupon-columns.tsx`
- `apps/web/src/routes/.../services/-benefits/build-benefit-columns.tsx`
- `apps/web/src/routes/.../services/-meters/build-meter-columns.tsx`

**Custo:** ~1 dia. Sem migrations.

### #18 Criação inline de dependência

**Problema:** criar cupom escopo=meter exige medidor pré-existente. User sai da tela, cria, volta.

**Escopo:**
- Combobox de medidor recebe prop `onCreate(name) => Promise<id>` (já existe em benefits — replicar em coupons).
- Mesmo padrão para combobox de serviço/preço quando aplicável.

**Arquivos:**
- `packages/ui/src/components/combobox.tsx` — verificar se já suporta `onCreate`.
- `apps/web/src/routes/.../services/-coupons/build-coupon-columns.tsx` — adicionar `onCreateMeter`.
- `coupons.tsx` page — passar handler igual ao benefits.tsx.

**Custo:** ~0.5 dia. Sem migrations.

### #19 Painel de dependências no detail do serviço

**Problema:** detail de serviço não mostra medidores ligados, benefícios ativos, cupons elegíveis.

**Escopo:**
- Sidebar/section em `services/$serviceId.tsx`.
- Listar:
  - Medidores associados a preços do serviço (via `servicePrices.meterId`).
  - Benefícios anexados (via `serviceBenefits` join).
  - Cupons elegíveis (escopo=team OU escopo=price com `priceId` em algum preço do serviço).
- Cada item link clicável.

**Backend:** novo procedure `services.getDependencies(serviceId)` retornando `{ meters, benefits, coupons }`. Single query agregada server-side.

**Arquivos:**
- `modules/billing/src/router/services.ts` — novo procedure.
- `apps/web/src/routes/.../services/$serviceId.tsx` — render.

**Custo:** ~1.5 dia. Sem migrations.

### #20 Indicadores de uso (sparkline / contador)

**Problema:** `usedCount` em cupom existe mas benefícios e medidores não mostram nada equivalente.

**Escopo:**
- Benefício: coluna "em uso por N assinaturas" (count via `benefitGrants`).
- Medidor: sparkline volume últimos 30d (já existe `MeterUsagePanel` — extrair preview pra coluna).
- Cupom: já mostra `usedCount/maxUses` — formalizar com mini-progress-bar.

**Backend:**
- `benefits.list` já retorna `usedInServices` — adicionar `usedInSubscriptions` (count distinct subscriptionId em benefitGrants).
- `meters.getMeters` recebe agregação leve dos últimos 30d (groupBy day, sum quantity).

**Cuidado:** sparkline N+1 — agregar tudo em um query só.

**Custo:** ~2 dias. Migration opcional para view materializada se perf ruim.

### #21 Command palette (Cmd+K) cross-tabela

**Problema:** user lembra "BLACK20" mas não sabe se é cupom ou benefício.

**Escopo:**
- **Antes de implementar:** verificar se `cmdk` ou similar já existe no app (`grep -r "cmdk\|CommandDialog" apps/web/src`). Se sim, estender. Se não, instalar `cmdk`.
- Indexar: services (name+description), meters (name+eventName), benefits (name), coupons (code).
- Resultado navega para o detail/edit correspondente.
- Atalho global Cmd+K registrado no layout `_dashboard.tsx`.

**Backend:** não precisa novo procedure — usa as listas existentes (já carregadas em cache).

**Custo:** ~1.5 dia se precisa instalar cmdk; ~0.5 dia se já existe.

---

## Fase 3 — Linkar com lançamentos (bloqueada por #13=sim)

> Toda Fase 3 só faz sentido se #13 = sim. Se não, **deletar essas tasks**.

### #22 Schema: `services.defaultIncomeCategoryId` + `defaultTagId`

**Migration:** adicionar duas colunas nullable em `services`, FK para `categories.id` e `tags.id` (set null on delete).

**Arquivos:**
- `core/database/src/schemas/services.ts`

**Custo:** trivial.

### #23 Schema: `transactions.invoiceId`

**Migration:** coluna nullable + index. FK `invoices.id` (set null on delete — preservar histórico mesmo se invoice apagada).

**Arquivos:**
- `core/database/src/schemas/transactions.ts`

**Custo:** trivial.

### #24 Workflow `invoice.paid` → cria transaction (income)

**DBOS workflow** no módulo billing. Disparado pelo evento de pagamento confirmado.

**Steps:**
1. Lê invoice + serviços (subscription_items → service).
2. Para cada item: deriva `categoryId`/`tagId` do `service.defaultIncomeCategoryId/defaultTagId` (fallback: null).
3. Cria UMA `transaction` (income) com:
   - `amount = invoice.totalPaid`
   - `date = invoice.paidAt`
   - `status = "paid"`
   - `invoiceId` (link)
   - `categoryId`/`tagId` do primeiro item (ou null se múltiplos serviços com defaults divergentes — decidir: primeiro? null? maior valor?).
4. Cria `transactionItems` por item da invoice.

**Idempotência:** chave `invoice:${invoiceId}` no workflow ID. Se rodar 2x não duplica.

**Arquivos:**
- `modules/billing/src/workflows/invoice-to-transaction.ts` (novo)
- `modules/billing/src/workflows/index.ts` — registrar setup.

**Cuidado:**
- `runTransaction` por step.
- Logs via `DBOS.logger`.
- Falha de criação não rollback no pagamento — só log + retry.

**Custo:** ~2 dias.

### #25 Item negativo "Descontos concedidos" quando cupom/benefício aplicou

Continuação de #24. No workflow, se invoice teve `couponId` ou benefício aplicado:

- Criar `transactionItem` adicional com `quantity = -1`, `unitPrice = valor_desconto`.
- `categoryId` aponta para categoria default "Descontos concedidos" (criada via seed).

**Pré-requisito:** seed da categoria. Adicionar em `scripts/seed-default-categories.ts` (verificar se existe; se não, criar e adicionar).

**Custo:** ~0.5 dia além de #24.

### #26 UI: vincular serviço a categoria/tag default

**Form:**
- Em `services/$serviceId.tsx` (edit) e draft-row de criação:
  - Combobox "Categoria padrão de receita" (filtra categories type=income).
  - Combobox "Centro de Custo padrão" (filtra tags).
- Inline-create disponível em ambos.

**Arquivos:**
- `apps/web/src/routes/.../services/$serviceId.tsx`
- `apps/web/src/routes/.../services/-services/services-columns.tsx` (se criação inline)

**Custo:** ~1 dia.

### #27 services-bills ↔ catálogo (custo / margem)

**Problema:** catálogo não mostra "este serviço tem custo X / margem Y" mesmo com `services-bills` registrando custos.

**Escopo:**
- Coluna "Custo médio" e "Margem" no catálogo (se `getAllStats` ainda não inclui — verificar antes).
- Tooltip com breakdown (últimos 30d? trimestre?).

**Cuidado:** decisão de produto se entra agora ou depois. Custo/margem é alta-frequência de pedido em ERPs — provavelmente vale.

**Custo:** ~1 dia.

---

## Fase 4 — Deferir (não fazer até pedido explícito)

### #28 Filtros cross-tabela + simulador de impacto

- Filtrar catálogo por "tem cupom ativo".
- Filtrar medidores por "usado em algum preço".
- Simulador "quanto cupom 20% custaria no mês" baseado em uso histórico.

**Por quê deferir:**
- Filtros cross-tabela exigem joins não-triviais — manter `getAll*` rápidos é prioridade.
- Simulador é feature-creep em modo "talvez útil". ROI incerto.
- Esperar 3+ pedidos diretos do usuário antes de priorizar.

---

## Resumo de PRs

| # | Tarefa | Estimativa | Bloqueado por | Migration |
|---|--------|-----------|---------------|-----------|
| 17 | Links navegáveis | 1d | — | não |
| 18 | Inline-create de medidor | 0.5d | — | não |
| 19 | Painel de dependências | 1.5d | — | não |
| 20 | Indicadores de uso | 2d | — | opcional |
| 21 | Command palette | 0.5–1.5d | — | não |
| **#13** | **Decisão produto** | — | — | — |
| 22 | Schema service defaults | 0.2d | #13 | sim |
| 23 | Schema transactions.invoiceId | 0.2d | #13 | sim |
| 24 | Workflow invoice→transaction | 2d | #13, #22, #23 | sim |
| 25 | Item negativo Descontos | 0.5d | #24 | seed |
| 26 | UI service defaults | 1d | #22 | não |
| 27 | services-bills no catálogo | 1d | — | não |
| 28 | Filtros cross / simulador | — | (deferir) | — |

**Total Fase 2 + Fase 3 (assumindo #13=sim):** ~12 dias-dev.

## Ordem sugerida de execução

1. **Resolver #13** (decisão).
2. **Sprint A:** #18 (inline-create) + #17 (links) — UX rápida.
3. **Sprint B:** #19 (painel deps) + #20 (uso).
4. **Sprint C** (se #13=sim): #22 + #23 + #26 (schema + UI defaults).
5. **Sprint D** (se #13=sim): #24 + #25 (workflow).
6. **Sprint E:** #21 (command palette) + #27 (custos).
7. **Backlog:** #28.
