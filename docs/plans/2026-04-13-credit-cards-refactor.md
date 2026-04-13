# Credit Cards Refactor — UI/UX Parity with Transactions

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refatorar a feature de cartões de crédito para ter a mesma UI/UX de lançamentos (Transactions), incluindo DataTable com paginação e filtros, importar/exportar CSV/XLSX, e componentes extraídos corretamente.

**Architecture:** Extrai o `CreditCardsList` inline para componente separado; adiciona paginação e filtros ao repositório e router; adiciona credenzas de import/export seguindo o padrão de transactions. Todo estado de filtros/paginação vive em URL search params via `validateSearch`.

**Tech Stack:** TanStack Router, TanStack Query (useSuspenseQuery), oRPC, Drizzle ORM, @f-o-t/csv, xlsx (já instalados no projeto), @tanstack/react-form, Maskito, foxact createLocalStorageState.

---

## Arquitetura — o que muda

| Camada | Hoje | Depois |
|--------|------|--------|
| Route `credit-cards.tsx` | inline `CreditCardsList()` fn, sem paginação | `validateSearch` com page/pageSize/search/status, `loaderDeps`, `prefetchQuery` paginado |
| oRPC `credit-cards.ts` | `getAll` sem paginação, sem filtros | `getAll` com page/pageSize/search/status, novo `getSummary` |
| Repo `credit-cards-repository.ts` | `listCreditCards(db, teamId)` simples | `listCreditCards` com filtros + paginação + totalCount |
| `CreditCardsList` | inline no route | `features/credit-cards/ui/credit-cards-list.tsx` |
| Colunas | 4 colunas, sem status/brand | + status + brand + utilization |
| Import | não existe | credenza multi-step CSV/XLSX (mesmo padrão de transactions) |
| Export | não existe | credenza CSV/XLSX com date range |
| Summary bar | não existe | barra com totalLimit / totalUsed / qtd cards |

---

## Task 1 — Repositório: paginação + filtros

**Files:**
- Modify: `core/database/src/repositories/credit-cards-repository.ts`

### Step 1: Ler o arquivo atual
```bash
cat core/database/src/repositories/credit-cards-repository.ts
```

### Step 2: Atualizar `listCreditCards` com filtros + paginação

Substitua a assinatura e implementação de `listCreditCards`:

```typescript
export type ListCreditCardsFilter = {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: "active" | "blocked" | "cancelled";
};

export async function listCreditCards(
  db: DatabaseClient,
  teamId: string,
  filter: ListCreditCardsFilter = {},
) {
  const { page = 1, pageSize = 20, search, status } = filter;
  const offset = (page - 1) * pageSize;

  try {
    const where = and(
      eq(creditCards.teamId, teamId),
      status ? eq(creditCards.status, status) : undefined,
      search
        ? or(ilike(creditCards.name, `%${search}%`))
        : undefined,
    );

    const [data, [{ count }]] = await Promise.all([
      db
        .select()
        .from(creditCards)
        .where(where)
        .orderBy(asc(creditCards.name))
        .limit(pageSize)
        .offset(offset),
      db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(creditCards)
        .where(where),
    ]);

    return {
      data,
      totalCount: count,
      page,
      pageSize,
      totalPages: Math.ceil(count / pageSize),
    };
  } catch (err) {
    propagateError(err);
    throw AppError.database("Falha ao listar cartões de crédito");
  }
}
```

Adicione os imports necessários no topo: `and`, `or`, `ilike`, `asc`, `sql` de `drizzle-orm`.

### Step 3: Adicionar `getCreditCardsSummary`

```typescript
export async function getCreditCardsSummary(db: DatabaseClient, teamId: string) {
  try {
    const [row] = await db
      .select({
        totalCards: sql<number>`cast(count(*) as int)`,
        totalLimit: sql<string>`coalesce(sum(credit_limit), 0)`,
        activeCards: sql<number>`cast(count(*) filter (where status = 'active') as int)`,
      })
      .from(creditCards)
      .where(eq(creditCards.teamId, teamId));

    return {
      totalCards: row?.totalCards ?? 0,
      totalLimit: row?.totalLimit ?? "0",
      activeCards: row?.activeCards ?? 0,
    };
  } catch (err) {
    propagateError(err);
    throw AppError.database("Falha ao carregar resumo de cartões");
  }
}
```

### Step 4: Commit
```bash
git add core/database/src/repositories/credit-cards-repository.ts
git commit -m "feat(credit-cards): add pagination, filters and summary to repository"
```

---

## Task 2 — oRPC Router: paginação + getSummary

**Files:**
- Modify: `apps/web/src/integrations/orpc/router/credit-cards.ts`

### Step 1: Ler o arquivo atual
```bash
cat apps/web/src/integrations/orpc/router/credit-cards.ts
```

### Step 2: Atualizar `getAll` com paginação e filtros

```typescript
const listCreditCardsSchema = z.object({
  page: z.number().int().positive().catch(1).default(1),
  pageSize: z.number().int().positive().max(100).catch(20).default(20),
  search: z.string().max(100).optional(),
  status: z.enum(["active", "blocked", "cancelled"]).optional(),
});

export const getAll = protectedProcedure
  .input(listCreditCardsSchema)
  .handler(async ({ context, input }) => {
    return listCreditCards(context.db, context.teamId, input);
  });
```

### Step 3: Adicionar `getSummary`

```typescript
export const getSummary = protectedProcedure.handler(async ({ context }) => {
  return getCreditCardsSummary(context.db, context.teamId);
});
```

Atualize o import do repositório para incluir `getCreditCardsSummary` e `ListCreditCardsFilter`.

### Step 4: Verificar que `getSummary` está registrado no router principal

Verifique se `apps/web/src/integrations/orpc/router/index.ts` (ou similar) exporta `creditCards`. Se `getSummary` não aparecer automaticamente, adicione-o ao objeto exportado.

### Step 5: Commit
```bash
git add apps/web/src/integrations/orpc/router/credit-cards.ts
git commit -m "feat(credit-cards): add pagination, search filter and getSummary procedure"
```

---

## Task 3 — Colunas: adicionar status, brand, utilization

**Files:**
- Modify: `apps/web/src/features/credit-cards/ui/credit-cards-columns.tsx`

### Step 1: Ler o arquivo atual
```bash
cat apps/web/src/features/credit-cards/ui/credit-cards-columns.tsx
```

### Step 2: Atualizar o tipo `CreditCardRow`

```typescript
import type { Outputs } from "@/integrations/orpc/client";
export type CreditCardRow = Outputs["creditCards"]["getAll"]["data"][number];
```

(Remova a definição manual se existir — derive do tipo do oRPC.)

### Step 3: Adicionar colunas de `status` e `brand`

Após a coluna `dueDay`, adicione:

```typescript
columnHelper.accessor("status", {
  header: "Status",
  cell: ({ getValue }) => {
    const status = getValue();
    const labelMap = {
      active: "Ativo",
      blocked: "Bloqueado",
      cancelled: "Cancelado",
    } as const;
    const variantMap = {
      active: "default",
      blocked: "warning",
      cancelled: "destructive",
    } as const;
    return (
      <Badge variant={variantMap[status]}>{labelMap[status]}</Badge>
    );
  },
  meta: { label: "Status", filterVariant: "select" },
}),
columnHelper.accessor("brand", {
  header: "Bandeira",
  cell: ({ getValue }) => {
    const brand = getValue();
    if (!brand) return <span className="text-muted-foreground">—</span>;
    const labelMap = {
      visa: "Visa",
      mastercard: "Mastercard",
      elo: "Elo",
      amex: "Amex",
      hipercard: "Hipercard",
      other: "Outra",
    } as const;
    return <span>{labelMap[brand] ?? brand}</span>;
  },
  meta: { label: "Bandeira" },
}),
```

### Step 4: Commit
```bash
git add apps/web/src/features/credit-cards/ui/credit-cards-columns.tsx
git commit -m "feat(credit-cards): add status and brand columns"
```

---

## Task 4 — Extrair `CreditCardsList` para componente separado

**Files:**
- Create: `apps/web/src/features/credit-cards/ui/credit-cards-list.tsx`
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/credit-cards.tsx`

### Step 1: Ler a route atual completa
```bash
cat "apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/credit-cards.tsx"
```

### Step 2: Criar `credit-cards-list.tsx`

Extraia o bloco `CreditCardsList` inline da route para o arquivo novo. O componente recebe props de estado de paginação, sorting e columnFilters:

```typescript
import type { OnChangeFn, SortingState, ColumnFiltersState } from "@tanstack/react-table";
import type { Outputs } from "@/integrations/orpc/client";
import { useSuspenseQuery, useMutation } from "@tanstack/react-query";
import { orpc } from "@/integrations/orpc/client";
import { DataTable } from "@packages/ui/components/data-table";
import { createLocalStorageState } from "foxact/create-local-storage-state";
import type { DataTableStoredState } from "@packages/ui/components/data-table";
import { useMemo, useState } from "react";
import { buildCreditCardsColumns } from "./credit-cards-columns";
import { useCredenza } from "@/hooks/use-credenza";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { toast } from "sonner";

const [useTableState, setTableState] = createLocalStorageState<DataTableStoredState | null>(
  "montte:datatable:credit-cards",
  null,
);

interface CreditCardsListProps {
  search?: string;
  status?: "active" | "blocked" | "cancelled";
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
  columnFilters: ColumnFiltersState;
  onColumnFiltersChange: OnChangeFn<ColumnFiltersState>;
  page: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
}

export function CreditCardsList({
  search,
  status,
  sorting,
  onSortingChange,
  columnFilters,
  onColumnFiltersChange,
  page,
  onPageChange,
  pageSize,
  onPageSizeChange,
}: CreditCardsListProps) {
  const { data } = useSuspenseQuery(
    orpc.creditCards.getAll.queryOptions({
      input: { page, pageSize, search, status },
    }),
  );

  const [tableState, setTableStateVal] = useTableState();
  const [rowSelection, setRowSelection] = useState({});
  const openCredenza = useCredenza();
  const openAlertDialog = useAlertDialog();

  const removeMutation = useMutation(orpc.creditCards.remove.mutationOptions());
  const bulkRemoveMutation = useMutation(orpc.creditCards.bulkRemove.mutationOptions());

  const columns = useMemo(() => buildCreditCardsColumns({
    onEdit: (card) => openCredenza({ children: <CreditCardForm id={card.id} defaultValues={card} /> }),
    onDelete: (card) =>
      openAlertDialog({
        title: "Remover cartão",
        description: `Deseja remover o cartão "${card.name}"? Esta ação não pode ser desfeita.`,
        onConfirm: () =>
          removeMutation.mutateAsync({ id: card.id }).then(() => toast.success("Cartão removido.")),
      }),
  }), [openCredenza, openAlertDialog, removeMutation]);

  const selectedIds = Object.keys(rowSelection).filter((k) => rowSelection[k as keyof typeof rowSelection]);

  return (
    <div className="flex flex-col gap-4">
      {selectedIds.length > 0 && (
        <SelectionActionBar
          count={selectedIds.length}
          onClear={() => setRowSelection({})}
          onBulkDelete={() =>
            openAlertDialog({
              title: `Remover ${selectedIds.length} cartão(ões)`,
              description: "Esta ação não pode ser desfeita.",
              onConfirm: () =>
                bulkRemoveMutation.mutateAsync({ ids: selectedIds }).then(() => {
                  toast.success("Cartões removidos.");
                  setRowSelection({});
                }),
            })
          }
        />
      )}
      <DataTable
        data={data.data}
        columns={columns}
        getRowId={(row) => row.id}
        sorting={sorting}
        onSortingChange={onSortingChange}
        columnFilters={columnFilters}
        onColumnFiltersChange={onColumnFiltersChange}
        tableState={tableState}
        onTableStateChange={setTableStateVal}
        manualSorting
        manualFiltering
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
        pagination={{
          page,
          pageSize,
          totalPages: data.totalPages,
          totalCount: data.totalCount,
          onPageChange,
          onPageSizeChange,
        }}
      />
    </div>
  );
}
```

**Nota:** Importe `CreditCardForm` e `SelectionActionBar` corretamente (use os imports já existentes no route atual como referência).

### Step 3: Atualizar a route para usar o componente novo

Na route `credit-cards.tsx`, substitua a inline function por:

```typescript
import { CreditCardsList } from "@/features/credit-cards/ui/credit-cards-list";

// No componente da page:
const { sorting, columnFilters, page, pageSize, search, status } = Route.useSearch();

return (
  <QueryBoundary fallback={<CreditCardsSkeleton />}>
    <CreditCardsList
      search={search}
      status={status}
      sorting={sorting}
      onSortingChange={(v) => navigate({ search: (p) => ({ ...p, sorting: typeof v === "function" ? v(p.sorting) : v }), replace: true })}
      columnFilters={columnFilters}
      onColumnFiltersChange={(v) => navigate({ search: (p) => ({ ...p, columnFilters: typeof v === "function" ? v(p.columnFilters) : v }), replace: true })}
      page={page}
      onPageChange={(p) => navigate({ search: (prev) => ({ ...prev, page: p }), replace: true })}
      pageSize={pageSize}
      onPageSizeChange={(s) => navigate({ search: (prev) => ({ ...prev, pageSize: s, page: 1 }), replace: true })}
    />
  </QueryBoundary>
);
```

### Step 4: Commit
```bash
git add apps/web/src/features/credit-cards/ui/credit-cards-list.tsx
git add "apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/credit-cards.tsx"
git commit -m "refactor(credit-cards): extract CreditCardsList to standalone component"
```

---

## Task 5 — Route: validateSearch com paginação + loaderDeps

**Files:**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/credit-cards.tsx`

### Step 1: Atualizar `validateSearch`

Substitua o schema atual pelo completo:

```typescript
const creditCardsSearchSchema = z.object({
  sorting: z.array(z.object({ id: z.string(), desc: z.boolean() })).catch([]).default([]),
  columnFilters: z.array(z.object({ id: z.string(), value: z.unknown() })).catch([]).default([]),
  search: z.string().max(100).catch("").default(""),
  status: z.enum(["active", "blocked", "cancelled"]).optional().catch(undefined),
  page: z.number().int().min(1).catch(1).default(1),
  pageSize: z.number().int().catch(20).default(20),
});
```

### Step 2: Adicionar `loaderDeps` e loader paginado

```typescript
loaderDeps: ({ search: { page, pageSize, search, status } }) => ({ page, pageSize, search, status }),
loader: ({ context, deps }) => {
  context.queryClient.prefetchQuery(
    orpc.creditCards.getAll.queryOptions({
      input: { page: deps.page, pageSize: deps.pageSize, search: deps.search, status: deps.status },
    }),
  );
  context.queryClient.prefetchQuery(orpc.creditCards.getSummary.queryOptions({}));
},
pendingMs: 300,
pendingComponent: CreditCardsSkeleton,
```

### Step 3: Commit
```bash
git add "apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/credit-cards.tsx"
git commit -m "feat(credit-cards): add pagination URL params, loaderDeps and prefetch"
```

---

## Task 6 — Summary Bar: total de limite, qtd cartões ativos

**Files:**
- Create: `apps/web/src/features/credit-cards/ui/credit-cards-summary.tsx`

### Step 1: Criar o componente

```typescript
import { useSuspenseQuery } from "@tanstack/react-query";
import { orpc } from "@/integrations/orpc/client";
import { format } from "@f-o-t/money";
import { of } from "@f-o-t/money";

export function CreditCardsSummary() {
  const { data } = useSuspenseQuery(orpc.creditCards.getSummary.queryOptions({}));

  return (
    <div className="flex gap-4 rounded-lg border px-4 py-2 text-sm">
      <div className="flex flex-col">
        <span className="text-muted-foreground">Cartões ativos</span>
        <span className="font-medium tabular-nums">{data.activeCards}</span>
      </div>
      <div className="flex flex-col">
        <span className="text-muted-foreground">Limite total</span>
        <span className="font-medium tabular-nums">
          {format(of(data.totalLimit, "BRL"), "pt-BR")}
        </span>
      </div>
      <div className="flex flex-col">
        <span className="text-muted-foreground">Total de cartões</span>
        <span className="font-medium tabular-nums">{data.totalCards}</span>
      </div>
    </div>
  );
}
```

### Step 2: Adicionar no `CreditCardsList` acima da tabela

```tsx
<QueryBoundary fallback={null}>
  <CreditCardsSummary />
</QueryBoundary>
```

### Step 3: Commit
```bash
git add apps/web/src/features/credit-cards/ui/credit-cards-summary.tsx
git add apps/web/src/features/credit-cards/ui/credit-cards-list.tsx
git commit -m "feat(credit-cards): add summary bar with total limit and active card count"
```

---

## Task 7 — Export: credenza CSV/XLSX

**Files:**
- Create: `apps/web/src/features/credit-cards/ui/credit-cards-export-credenza.tsx`

### Step 1: Ver como transaction-export-credenza.tsx é implementado (referência)
```bash
cat apps/web/src/features/transactions/ui/transaction-export-credenza.tsx
```

### Step 2: Criar credenza de export para cartões

O componente exporta todos os cartões (sem filtro de data, já que cartões não são time-series). Formatos: CSV, XLSX.

Headers CSV (em português):
```
nome, limite_credito, dia_fechamento, dia_vencimento, status, bandeira, conta_bancaria, criado_em
```

```typescript
"use client";

import { useState } from "react";
import {
  Credenza,
  CredenzaHeader,
  CredenzaTitle,
  CredenzaDescription,
  CredenzaBody,
  CredenzaFooter,
} from "@packages/ui/components/credenza";
import { Button } from "@packages/ui/components/button";
import { RadioGroup, RadioGroupItem } from "@packages/ui/components/radio-group";
import { Label } from "@packages/ui/components/label";
import { useSuspenseQuery } from "@tanstack/react-query";
import { orpc } from "@/integrations/orpc/client";
import { generate } from "@f-o-t/csv";
import * as XLSX from "xlsx";
import dayjs from "dayjs";

type ExportFormat = "csv" | "xlsx";

const CSV_HEADERS = [
  "nome",
  "limite_credito",
  "dia_fechamento",
  "dia_vencimento",
  "status",
  "bandeira",
  "conta_bancaria_id",
  "criado_em",
];

function toRows(cards: { name: string; creditLimit: string; closingDay: number; dueDay: number; status: string; brand?: string | null; bankAccountId?: string | null; createdAt: Date }[]) {
  return cards.map((c) => [
    c.name,
    c.creditLimit,
    String(c.closingDay),
    String(c.dueDay),
    c.status,
    c.brand ?? "",
    c.bankAccountId ?? "",
    dayjs(c.createdAt).format("YYYY-MM-DD"),
  ]);
}

export function CreditCardsExportCredenza({ onClose }: { onClose: () => void }) {
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [isExporting, setIsExporting] = useState(false);

  const { data } = useSuspenseQuery(
    orpc.creditCards.getAll.queryOptions({ input: { pageSize: 100 } }),
  );

  async function handleExport() {
    setIsExporting(true);
    const rows = toRows(data.data);
    const filename = `cartoes-${dayjs().format("YYYY-MM-DD")}`;

    if (format === "csv") {
      const csv = generate({ headers: CSV_HEADERS, rows });
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const ws = XLSX.utils.aoa_to_sheet([CSV_HEADERS, ...rows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Cartões");
      XLSX.writeFile(wb, `${filename}.xlsx`);
    }

    setIsExporting(false);
    onClose();
  }

  return (
    <Credenza>
      <CredenzaHeader>
        <CredenzaTitle>Exportar cartões de crédito</CredenzaTitle>
        <CredenzaDescription>Escolha o formato de exportação</CredenzaDescription>
      </CredenzaHeader>
      <CredenzaBody>
        <RadioGroup
          value={format}
          onValueChange={(v) => setFormat(v as ExportFormat)}
          className="flex flex-col gap-2"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="csv" id="csv" />
            <Label htmlFor="csv">CSV</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="xlsx" id="xlsx" />
            <Label htmlFor="xlsx">Excel (XLSX)</Label>
          </div>
        </RadioGroup>
      </CredenzaBody>
      <CredenzaFooter>
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button onClick={handleExport} disabled={isExporting}>
          {isExporting ? "Exportando..." : "Exportar"}
        </Button>
      </CredenzaFooter>
    </Credenza>
  );
}
```

### Step 3: Adicionar botão de export no header da route

Na route `credit-cards.tsx`, adicione no `panelActions` do `DefaultHeader`:

```typescript
import { Download } from "lucide-react";
import { CreditCardsExportCredenza } from "@/features/credit-cards/ui/credit-cards-export-credenza";

// Em panelActions:
{
  icon: Download,
  label: "Exportar",
  onClick: () => openCredenza({ children: <CreditCardsExportCredenza onClose={closeCredenza} /> }),
}
```

### Step 4: Commit
```bash
git add apps/web/src/features/credit-cards/ui/credit-cards-export-credenza.tsx
git add "apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/credit-cards.tsx"
git commit -m "feat(credit-cards): add export credenza with CSV and XLSX support"
```

---

## Task 8 — Import: credenza multi-step CSV/XLSX

**Files:**
- Create: `apps/web/src/features/credit-cards/ui/credit-cards-import-credenza.tsx`

### Step 1: Ver referência de transactions import
```bash
cat apps/web/src/features/transactions/ui/transaction-import-credenza.tsx
```

### Step 2: Criar credenza de import com stepper

O import de cartões é mais simples que transactions (sem duplicatas, sem OFX). Passos:
1. **Upload** — usuário faz upload de CSV/XLSX
2. **Mapeamento** — usuário mapeia colunas do arquivo para campos do cartão
3. **Preview** — tabela de preview com validação inline
4. **Confirmar** — chama `bulkCreate` (criar no oRPC — ver Task 9)

Campos mapeáveis:
- `nome` (obrigatório)
- `limite_credito` (obrigatório, número)
- `dia_fechamento` (obrigatório, 1-31)
- `dia_vencimento` (obrigatório, 1-31)
- `status` (opcional — default "active")
- `bandeira` (opcional)

```typescript
"use client";

import { useState } from "react";
import {
  Credenza,
  CredenzaHeader,
  CredenzaTitle,
  CredenzaDescription,
  CredenzaBody,
  CredenzaFooter,
} from "@packages/ui/components/credenza";
import { Button } from "@packages/ui/components/button";
import { useCsvFile } from "@/hooks/use-csv-file";
import { useXlsxFile } from "@/hooks/use-xlsx-file";
import { useMutation } from "@tanstack/react-query";
import { orpc } from "@/integrations/orpc/client";
import { toast } from "sonner";
import { Stepper, StepperStep } from "@packages/ui/components/stepper"; // use o mesmo componente de transactions

type Step = "upload" | "map" | "preview" | "confirm";

const REQUIRED_FIELDS = ["nome", "limite_credito", "dia_fechamento", "dia_vencimento"] as const;

interface MappedCard {
  name: string;
  creditLimit: string;
  closingDay: number;
  dueDay: number;
  status?: string;
  brand?: string;
}

export function CreditCardsImportCredenza({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<Step>("upload");
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnMap, setColumnMap] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<MappedCard[]>([]);

  const { parse: parseCsv } = useCsvFile();
  const { parse: parseXlsx } = useXlsxFile();

  const importMutation = useMutation(orpc.creditCards.bulkCreate.mutationOptions());

  // Step 1: Handle file upload
  async function handleFile(file: File) {
    const ext = file.name.split(".").pop()?.toLowerCase();
    let result: { headers: string[]; rows: string[][] };

    if (ext === "csv") {
      result = await parseCsv(file);
    } else if (ext === "xlsx") {
      result = await parseXlsx(file);
    } else {
      toast.error("Formato não suportado. Use CSV ou XLSX.");
      return;
    }

    setHeaders(result.headers);
    setRawRows(result.rows);

    // Auto-map by name similarity
    const autoMap: Record<string, string> = {};
    for (const field of REQUIRED_FIELDS) {
      const match = result.headers.find(
        (h) => h.toLowerCase().includes(field) || field.includes(h.toLowerCase()),
      );
      if (match) autoMap[field] = match;
    }
    setColumnMap(autoMap);
    setStep("map");
  }

  // Step 2: Build preview from mapping
  function buildPreview() {
    const mapped = rawRows.map((row) => {
      const get = (field: string) => {
        const col = columnMap[field];
        if (!col) return "";
        const idx = headers.indexOf(col);
        return idx >= 0 ? (row[idx] ?? "") : "";
      };

      return {
        name: get("nome"),
        creditLimit: get("limite_credito").replace(",", "."),
        closingDay: Number(get("dia_fechamento")),
        dueDay: Number(get("dia_vencimento")),
        status: get("status") || "active",
        brand: get("bandeira") || undefined,
      } satisfies MappedCard;
    });

    setPreview(mapped);
    setStep("preview");
  }

  // Step 3: Import
  async function handleImport() {
    setStep("confirm");
    const result = await importMutation.mutateAsync({ cards: preview });
    toast.success(`${result.created} cartão(ões) importado(s).`);
    onClose();
  }

  // Render steps conditionally — follow transactions pattern for Stepper component usage

  return (
    <Credenza>
      <CredenzaHeader>
        <CredenzaTitle>Importar cartões de crédito</CredenzaTitle>
        <CredenzaDescription>CSV ou XLSX — siga os passos abaixo</CredenzaDescription>
      </CredenzaHeader>
      <CredenzaBody>
        {/* Stepper + step content — see transactions import for exact Stepper API */}
        {step === "upload" && (
          <DropzoneInput
            accept=".csv,.xlsx"
            onFile={handleFile}
            label="Arraste ou selecione um arquivo CSV ou XLSX"
          />
        )}
        {step === "map" && (
          <ColumnMapper
            headers={headers}
            fields={REQUIRED_FIELDS}
            columnMap={columnMap}
            onMapChange={setColumnMap}
            sampleRow={rawRows[0]}
          />
        )}
        {step === "preview" && (
          <PreviewTable cards={preview} />
        )}
        {step === "confirm" && (
          <div className="flex items-center justify-center py-4 text-muted-foreground">
            Importando...
          </div>
        )}
      </CredenzaBody>
      <CredenzaFooter>
        {step !== "confirm" && (
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
        )}
        {step === "map" && (
          <Button onClick={buildPreview} disabled={REQUIRED_FIELDS.some((f) => !columnMap[f])}>
            Pré-visualizar
          </Button>
        )}
        {step === "preview" && (
          <Button onClick={handleImport} disabled={preview.length === 0}>
            Importar {preview.length} cartão(ões)
          </Button>
        )}
      </CredenzaFooter>
    </Credenza>
  );
}
```

**Nota:** Os sub-componentes `DropzoneInput`, `ColumnMapper`, `PreviewTable` devem ser baseados nos equivalentes de transactions. Verifique se já existem em `@packages/ui` ou colocate neste arquivo.

### Step 3: Adicionar botão de import no header da route

```typescript
import { Upload } from "lucide-react";
import { CreditCardsImportCredenza } from "@/features/credit-cards/ui/credit-cards-import-credenza";

// panelActions:
{
  icon: Upload,
  label: "Importar",
  onClick: () => openCredenza({ children: <CreditCardsImportCredenza onClose={closeCredenza} /> }),
}
```

### Step 4: Commit
```bash
git add apps/web/src/features/credit-cards/ui/credit-cards-import-credenza.tsx
git add "apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/credit-cards.tsx"
git commit -m "feat(credit-cards): add import credenza with CSV/XLSX column mapping"
```

---

## Task 9 — oRPC + Repositório: `bulkCreate`

**Files:**
- Modify: `core/database/src/repositories/credit-cards-repository.ts`
- Modify: `apps/web/src/integrations/orpc/router/credit-cards.ts`

### Step 1: Adicionar `bulkCreateCreditCards` no repositório

```typescript
export type BulkCreateCreditCardInput = {
  name: string;
  creditLimit: string;
  closingDay: number;
  dueDay: number;
  color?: string;
  status?: "active" | "blocked" | "cancelled";
  brand?: "visa" | "mastercard" | "elo" | "amex" | "hipercard" | "other";
};

export async function bulkCreateCreditCards(
  db: DatabaseClient,
  teamId: string,
  cards: BulkCreateCreditCardInput[],
) {
  try {
    const rows = cards.map((c) => ({
      teamId,
      name: c.name,
      creditLimit: c.creditLimit,
      closingDay: c.closingDay,
      dueDay: c.dueDay,
      color: c.color ?? "#6366f1",
      status: (c.status as "active" | "blocked" | "cancelled") ?? "active",
      brand: c.brand,
    }));

    const created = await db.insert(creditCards).values(rows).returning({ id: creditCards.id });

    return { created: created.length };
  } catch (err) {
    propagateError(err);
    throw AppError.database("Falha ao importar cartões");
  }
}
```

### Step 2: Adicionar procedure `bulkCreate` no router

```typescript
const bulkCreateSchema = z.object({
  cards: z
    .array(
      z.object({
        name: z.string().min(2).max(80),
        creditLimit: z.string(),
        closingDay: z.number().int().min(1).max(31),
        dueDay: z.number().int().min(1).max(31),
        status: z.enum(["active", "blocked", "cancelled"]).optional(),
        brand: z.enum(["visa", "mastercard", "elo", "amex", "hipercard", "other"]).optional(),
        color: z.string().optional(),
      }),
    )
    .min(1)
    .max(500),
});

export const bulkCreate = protectedProcedure
  .input(bulkCreateSchema)
  .handler(async ({ context, input }) => {
    return bulkCreateCreditCards(context.db, context.teamId, input.cards);
  });
```

### Step 3: Commit
```bash
git add core/database/src/repositories/credit-cards-repository.ts
git add apps/web/src/integrations/orpc/router/credit-cards.ts
git commit -m "feat(credit-cards): add bulkCreate procedure and repository function"
```

---

## Task 10 — Typecheck + ajustes finais

### Step 1: Rodar typecheck
```bash
bun run typecheck
```

Corrigir todos os erros de tipo. Os mais comuns serão:
- `Outputs["creditCards"]["getAll"]` mudou de formato (adicionou `data`, `totalCount`, etc.) — qualquer lugar que usava `getAll` diretamente precisa usar `.data`
- Imports faltando
- `variant` de Badge com valor não existente (verifique quais variants existem em `@packages/ui/components/badge`)

### Step 2: Verificar todos os usos de `creditCards.getAll` no frontend
```bash
grep -r "creditCards.getAll" apps/web/src --include="*.tsx" --include="*.ts" -n
```

Atualizar todos para usar `.data` se consumiam array direto.

### Step 3: Rodar oxlint
```bash
bun run check
```

Corrigir todos os erros.

### Step 4: Commit final
```bash
git add -p
git commit -m "fix(credit-cards): resolve typecheck and lint errors after refactor"
```

---

## Task 11 — Teste de integração: `getAll` paginado + `getSummary`

**Files:**
- Create: `apps/web/__tests__/integrations/orpc/router/credit-cards.test.ts`

### Step 1: Ver um teste de router existente como referência
```bash
ls apps/web/__tests__/integrations/orpc/router/
cat apps/web/__tests__/integrations/orpc/router/bank-accounts.test.ts  # ou similar
```

### Step 2: Escrever os testes

```typescript
describe("credit-cards router", () => {
  describe("getAll", () => {
    it("returns paginated results", async () => {
      // arrange: create 25 credit cards
      // act: call getAll with page=1, pageSize=10
      // assert: data.length === 10, totalCount === 25, totalPages === 3
    });

    it("filters by search", async () => {
      // arrange: create cards "Nubank", "Inter", "Bradesco"
      // act: call getAll with search="nub"
      // assert: data.length === 1, data[0].name === "Nubank"
    });

    it("filters by status", async () => {
      // arrange: create 1 active, 1 blocked
      // act: call getAll with status="blocked"
      // assert: data.length === 1
    });
  });

  describe("getSummary", () => {
    it("returns correct totalCards and activeCards", async () => {
      // arrange: create 2 active + 1 cancelled
      // act: call getSummary
      // assert: totalCards === 3, activeCards === 2
    });
  });
});
```

### Step 3: Rodar o teste
```bash
npx vitest run apps/web/__tests__/integrations/orpc/router/credit-cards.test.ts
```

### Step 4: Commit
```bash
git add apps/web/__tests__/integrations/orpc/router/credit-cards.test.ts
git commit -m "test(credit-cards): add integration tests for paginated getAll and getSummary"
```

---

## Checklist Final

- [ ] `listCreditCards` aceita `page`, `pageSize`, `search`, `status` e retorna `{ data, totalCount, totalPages, page, pageSize }`
- [ ] `getCreditCardsSummary` retorna `{ totalCards, activeCards, totalLimit }`
- [ ] `bulkCreateCreditCards` funciona com array de cartões
- [ ] oRPC `getAll` procedure aceita e repassa filtros
- [ ] oRPC `getSummary` procedure existe e está no router principal
- [ ] oRPC `bulkCreate` procedure existe
- [ ] `CreditCardsList` é componente separado em `features/credit-cards/ui/`
- [ ] Route `credit-cards.tsx` usa `validateSearch` com `page`, `pageSize`, `search`, `status`
- [ ] Route tem `loaderDeps` e `prefetchQuery` reativos à paginação
- [ ] Summary bar mostra total de limite + cartões ativos
- [ ] Colunas `status` e `brand` no DataTable
- [ ] Export credenza: CSV + XLSX
- [ ] Import credenza: CSV + XLSX com mapeamento de colunas
- [ ] `bun run typecheck` passa sem erros
- [ ] `bun run check` passa sem erros
- [ ] Testes de integração passam
