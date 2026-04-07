# Hooks Cleanup — use-csv, use-xlsx, use-cnpj

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rewrite the three file/data hooks to eliminate bloat, use proper patterns (useSuspenseQuery + skipToken for async queries, foxact for SSR-safe storage), and remove redundant interfaces that duplicate backend-inferred types.

**Architecture:**
- `useCnpj` — replace `useQuery` with `useSuspenseQuery` + `skipToken` (when `teamId` is null); remove the hand-rolled `CnpjData` interface entirely and use `Outputs["team"]["get"]["cnpjData"]` inferred from the router.
- `useCsvFile` / `useXlsxFile` — not hooks. Single exported async function each. No internal `parse*Buffer` helper — logic is inlined directly.
- `useCnpj` — remove `parseCnpjRaw` (pointless cast) and `parseDateOfCreation` (pure helper with 8 lines) — inline both directly in the hook body. Less indirection, same result.

**Tech Stack:** TanStack Query (`useSuspenseQuery`, `skipToken`), `@f-o-t/csv`, `xlsx`, `dayjs`, `Outputs` type inference from `@/integrations/orpc/client`.

---

### Task 1: Rewrite `use-cnpj.ts`

**Files:**
- Modify: `apps/web/src/hooks/use-cnpj.ts`
- Update callers:
  - `apps/web/src/features/bank-accounts/ui/bank-accounts-form.tsx:174`
  - `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-transactions/use-statement-import.ts:295`

**What to do:**

1. Remove the hand-rolled `CnpjData` interface and `parseCnpjRaw` — they duplicate what the router already returns. Use `Outputs` from `@/integrations/orpc/client` instead:
   ```ts
   import type { Outputs } from "@/integrations/orpc/client";
   type TeamCnpjData = NonNullable<Outputs["team"]["get"]["cnpjData"]>;
   ```
   `cnpjData` on the team row is `unknown | null` in Drizzle (JSONB column). Check what TypeScript infers for `Outputs["team"]["get"]["cnpjData"]` — if it's `unknown`, you'll need to keep a minimal cast-free approach. Look at the router return type first.

2. Replace `useQuery` + `enabled` with `useSuspenseQuery` + `skipToken`:
   ```ts
   import { useSuspenseQuery } from "@tanstack/react-query";
   import { skipToken } from "@tanstack/react-query";
   import { orpc } from "@/integrations/orpc/client";

   export function useCnpj(teamId: string | null) {
     const { data: teamData } = useSuspenseQuery(
       teamId
         ? orpc.team.get.queryOptions({ input: { teamId } })
         : { queryKey: ["cnpj-skip"], queryFn: skipToken }
     );
     // teamData is undefined when skipped
     const cnpjData = teamData?.cnpjData ?? null;
     const { minDate, minDateStr } = parseDateOfCreation(
       cnpjData?.data_inicio_atividade
     );
     return { data: cnpjData, minDate, minDateStr };
   }
   ```

3. Remove `parseDateOfCreation` and `parseCnpjRaw` entirely. Inline the date-parsing logic directly in the hook body:
   ```ts
   const raw = cnpjData?.data_inicio_atividade;
   let minDate: Date | undefined;
   let minDateStr: string | null = null;
   if (raw) {
     for (const fmt of ["DD/MM/YYYY", "YYYY-MM-DD", "DD-MM-YYYY"]) {
       const d = dayjs(raw, fmt, true);
       if (d.isValid()) {
         minDateStr = d.format("YYYY-MM-DD");
         minDate = d.toDate();
         break;
       }
     }
   }
   return { data: cnpjData, minDate, minDateStr };
   ```
   Remove the `dayjs.extend(customParseFormat)` side-effect from the module — check if it's called in app bootstrap first (grep for it). If not elsewhere, move it there.

4. Callers (`bank-accounts-form.tsx`, `use-statement-import.ts`) — check that they're already inside a `<Suspense>` boundary. If not, the switch to `useSuspenseQuery` will require wrapping. Verify and note — do NOT add Suspense boundaries here, just flag for the caller's owner.

**Step 1:** Check if `dayjs.extend(customParseFormat)` is called anywhere in the app bootstrap:
```bash
grep -r "customParseFormat" apps/web/src --include="*.ts" --include="*.tsx" -l
```

**Step 2:** Check what TypeScript infers for `Outputs["team"]["get"]["cnpjData"]`:
```bash
grep -n "cnpjData" apps/web/src/integrations/orpc/router/team.ts
```

**Step 3:** Rewrite the file per the pattern above.

**Step 4:** Commit:
```bash
git add apps/web/src/hooks/use-cnpj.ts
git commit -m "refactor(hooks): useCnpj — useSuspenseQuery + skipToken, remove duplicate CnpjData interface"
```

---

### Task 2: Rewrite `use-csv-file.ts`

**Files:**
- Modify: `apps/web/src/hooks/use-csv-file.ts`
- Update callers: `use-statement-import.ts` (parse), `statement-import-credenza.tsx` (generate for template download)

**What to do:**

Keep it as a hook. Remove the `parseCsvBuffer` helper — inline the logic directly in `parse`. Add `generate` for producing the template blob (replaces the inline `downloadCsv` in `TemplateCredenza`). No `FileReader`, use `file.arrayBuffer()`.

```ts
import { parseBufferOrThrow, generateFromObjects } from "@f-o-t/csv";

export type CsvData = {
  headers: string[];
  rows: string[][];
};

export function useCsvFile() {
  async function parse(file: File): Promise<CsvData> {
    const doc = parseBufferOrThrow(new Uint8Array(await file.arrayBuffer()), {
      hasHeaders: true,
      trimFields: true,
    });
    return { headers: doc.headers ?? [], rows: doc.rows.map((r) => r.fields) };
  }

  function generate(rows: Record<string, string>[], headers: string[]): Blob {
    return new Blob([generateFromObjects(rows, { headers })], {
      type: "text/csv;charset=utf-8;",
    });
  }

  return { parse, generate };
}
```

`use-statement-import.ts` already calls `csv.parse` — rename from `csv.readFile` → `csv.parse`.

In `statement-import-credenza.tsx`, `TemplateCredenza` calls `useXlsxFile()` / `useCsvFile()` and uses `generate` to produce the blob, then passes it to `triggerDownload`. The inline `downloadCsv` function goes away.

**Step 1:** Rewrite `use-csv-file.ts`.

**Step 2:** Update `use-statement-import.ts` — `csv.readFile` → `csv.parse`.

**Step 3:** Update `TemplateCredenza` in `statement-import-credenza.tsx`:
```tsx
function TemplateCredenza({ onClose }: { onClose?: () => void }) {
  const csv = useCsvFile();
  const xlsx = useXlsxFile();

  return (
    // ...
    onClick={() => {
      triggerDownload(csv.generate(TEMPLATE_ROWS, [...TEMPLATE_HEADERS]), "modelo-importacao.csv");
      onClose?.();
    }}
    // xlsx button:
    onClick={() => {
      triggerDownload(xlsx.generate(TEMPLATE_ROWS, [...TEMPLATE_HEADERS]), "modelo-importacao.xlsx");
      onClose?.();
    }}
  );
}
```

**Step 4:** Commit:
```bash
git add apps/web/src/hooks/use-csv-file.ts apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-transactions/use-statement-import.ts apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-transactions/statement-import-credenza.tsx
git commit -m "refactor(hooks): useCsvFile — inline parse, add generate, no helper fns"
```

---

### Task 3: Rewrite `use-xlsx-file.ts`

**Files:**
- Modify: `apps/web/src/hooks/use-xlsx-file.ts`
- Update callers: `use-statement-import.ts` (parse), `statement-import-credenza.tsx` (generate — already handled in Task 2 Step 3)

**What to do:**

Same shape as CSV. Keep as hook, inline `parseXlsxBuffer` into `parse`, add `generate`.

```ts
import { read as xlsxRead, utils as xlsxUtils, write as xlsxWrite } from "xlsx";

export type XlsxData = {
  headers: string[];
  rows: string[][];
};

export function useXlsxFile() {
  async function parse(file: File): Promise<XlsxData> {
    const wb = xlsxRead(new Uint8Array(await file.arrayBuffer()), { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) throw new Error("Planilha vazia");
    const data = xlsxUtils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });
    if (data.length < 2) throw new Error("Planilha sem dados");
    return {
      headers: (data[0] as unknown[]).map(String),
      rows: (data.slice(1) as unknown[][])
        .filter((r) => r.some((c) => String(c).trim() !== ""))
        .map((r) => r.map(String)),
    };
  }

  function generate(rows: Record<string, string>[], headers: string[]): Blob {
    const ws = xlsxUtils.json_to_sheet(rows, { header: headers });
    const wb = xlsxUtils.book_new();
    xlsxUtils.book_append_sheet(wb, ws, "Modelo");
    return new Blob([xlsxWrite(wb, { type: "array", bookType: "xlsx" })], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
  }

  return { parse, generate };
}
```

`use-statement-import.ts` calls `xlsx.parse(file)` (rename from `xlsx.readFile`).

**Step 1:** Rewrite `use-xlsx-file.ts`.

**Step 2:** Update `use-statement-import.ts` — `xlsx.readFile` → `xlsx.parse`.

**Step 3:** Commit:
```bash
git add apps/web/src/hooks/use-xlsx-file.ts apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-transactions/use-statement-import.ts
git commit -m "refactor(hooks): useXlsxFile — inline parse, add generate, no helper fns"
```

---

### Task 4: Verify & typecheck

**Step 1:** Run typecheck to ensure no broken imports:
```bash
bun run typecheck
```

**Step 2:** Fix any type errors that surface (likely from `cnpjData` being `unknown` in the Drizzle schema — if so, cast-free approach: narrow with `cnpjDataSchema.safeParse()` inline in the hook and return `null` on failure).

**Step 3:** Final commit if any fixes needed:
```bash
git add -p
git commit -m "fix(hooks): type errors after hook refactor"
```
