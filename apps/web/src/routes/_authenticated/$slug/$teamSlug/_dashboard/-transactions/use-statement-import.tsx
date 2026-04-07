import {
   of as moneyOf,
   toMajorUnitsString,
   absolute,
   format as moneyFormat,
} from "@f-o-t/money";
import { parseBufferOrThrow as parseOfx, getTransactions } from "@f-o-t/ofx";
import { useMutation } from "@tanstack/react-query";
import { useDebouncedCallback } from "@tanstack/react-pacer";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { useLocalStorage } from "foxact/use-local-storage";
import { invariant } from "foxact/invariant";
import { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";
import { orpc } from "@/integrations/orpc/client";
import { useCnpj } from "@/hooks/use-cnpj";
import { useCsvFile } from "@/hooks/use-csv-file";
import { useXlsxFile } from "@/hooks/use-xlsx-file";

dayjs.extend(customParseFormat);

export type FileFormat = "csv" | "xlsx" | "ofx";

export type ParsedRow = {
   date: string;
   name: string;
   type: "income" | "expense";
   amount: string;
   description: string;
   categoryId?: string;
};

export type ValidatedRow = ParsedRow & { isValid: boolean; errors: string[] };

export type RawData = {
   headers: string[];
   rows: string[][];
};

export type ColumnField = "date" | "name" | "type" | "amount" | "description";

export type ColumnMapping = Record<ColumnField, string>;

export const COLUMN_FIELDS: ColumnField[] = [
   "date",
   "name",
   "type",
   "amount",
   "description",
];

export const REQUIRED_FIELDS: ColumnField[] = ["date", "amount"];

export const FIELD_LABELS: Record<ColumnField, string> = {
   date: "Data *",
   name: "Nome",
   type: "Tipo",
   amount: "Valor *",
   description: "Descrição",
};

export const TEMPLATE_HEADERS = [
   "data",
   "nome",
   "tipo",
   "valor",
   "descricao",
] as const;

export const TEMPLATE_ROWS = [
   {
      data: "15/01/2024",
      nome: "Pagamento fornecedor",
      tipo: "despesa",
      valor: "1500.00",
      descricao: "NF 123",
   },
   {
      data: "20/01/2024",
      nome: "Recebimento cliente",
      tipo: "receita",
      valor: "3200.00",
      descricao: "Fatura 456",
   },
];

const DATE_FORMATS = [
   "DD/MM/YYYY",
   "DD/MM/YY",
   "DD-MM-YYYY",
   "YYYY-MM-DD",
   "YYYYMMDD",
] as const;

const OFX_INCOME_TYPES = new Set(["CREDIT", "INT", "DIV", "DIRECTDEP"]);

const INCOME_TYPE_KEYWORDS = new Set([
   "receita",
   "income",
   "crédito",
   "credito",
   "credit",
]);

const EXPENSE_TYPE_KEYWORDS = new Set([
   "despesa",
   "expense",
   "débito",
   "debito",
   "debit",
]);

const INCOME_NAME_PATTERNS = [
   "recebido",
   "recebimento",
   "depósito",
   "deposito",
   "salário",
   "salario",
   "crédito",
   "credito",
   "pix recebido",
   "transferência recebida",
   "ted recebida",
   "doc recebido",
   "rendimento",
   "reembolso",
   "estorno",
];

const EXPENSE_NAME_PATTERNS = [
   "enviado",
   "pagamento",
   "compra",
   "débito",
   "debito",
   "pix enviado",
   "transferência enviada",
   "ted enviada",
   "doc enviado",
   "saque",
   "tarifa",
   "cobrança",
   "boleto",
];

const COLUMN_PATTERNS: Record<ColumnField, string[]> = {
   date: ["data", "date", "dt", "data_lancamento"],
   name: ["nome", "name", "historico", "memo", "descricao"],
   type: ["tipo", "type", "natureza", "operacao"],
   amount: ["valor", "value", "amount", "montante", "vlr"],
   description: ["descricao", "description", "obs", "complemento"],
};

const EMPTY_MAPPING: ColumnMapping = {
   date: "",
   name: "",
   type: "",
   amount: "",
   description: "",
};

export function formatMoney(value: string): string {
   const normalized = parseAmount(value) ?? value;
   try {
      return moneyFormat(moneyOf(normalized, "BRL"), "pt-BR");
   } catch {
      return value;
   }
}

export function parseDate(raw: string): string | null {
   const dateOnly = raw
      .trim()
      .replace(/\s*às\s*\d{1,2}:\d{2}(:\d{2})?/i, "")
      .replace(/\s+\d{1,2}:\d{2}(:\d{2})?$/, "")
      .replace(/T\d{2}:\d{2}.*$/, "")
      .trim();
   for (const fmt of DATE_FORMATS) {
      const d = dayjs(dateOnly, fmt, true);
      if (d.isValid()) return d.format("YYYY-MM-DD");
   }
   return null;
}

export function parseAmount(raw: string): string | null {
   const cleaned = raw.replace(/R\$\s*/g, "").trim();
   const hasComma = cleaned.includes(",");
   const hasDot = cleaned.includes(".");
   let normalized: string;
   if (hasComma && hasDot) {
      normalized = cleaned.replace(/\./g, "").replace(",", ".");
   } else if (hasComma) {
      normalized = cleaned.replace(",", ".");
   } else {
      normalized = cleaned;
   }
   try {
      return toMajorUnitsString(absolute(moneyOf(normalized, "BRL")));
   } catch {
      return null;
   }
}

function inferTypeFromOfx(
   trnType: string,
   trnAmt: number,
): "income" | "expense" {
   if (trnAmt > 0) return "income";
   if (trnAmt < 0) return "expense";
   if (OFX_INCOME_TYPES.has(trnType)) return "income";
   return "expense";
}

function inferTypeFromName(name: string): "income" | "expense" | null {
   const n = name.toLowerCase();
   if (INCOME_NAME_PATTERNS.some((p) => n.includes(p))) return "income";
   if (EXPENSE_NAME_PATTERNS.some((p) => n.includes(p))) return "expense";
   return null;
}

function inferType(raw: string, amount: number): "income" | "expense" {
   const t = raw.toLowerCase().trim();
   if (INCOME_TYPE_KEYWORDS.has(t)) return "income";
   if (EXPENSE_TYPE_KEYWORDS.has(t)) return "expense";
   if (amount < 0) return "expense";
   return "expense";
}

function validateRow(row: ParsedRow, minDate?: string | null): ValidatedRow {
   const errors: string[] = [];
   const parsedDate = parseDate(row.date);
   if (!parsedDate) errors.push("Data inválida");
   if (parsedDate && minDate && parsedDate < minDate)
      errors.push(
         `Anterior à abertura da empresa (${dayjs(minDate).format("DD/MM/YYYY")})`,
      );
   if (!row.amount || parseAmount(row.amount) === null)
      errors.push("Valor inválido");
   return { ...row, isValid: errors.length === 0, errors };
}

export function getSampleValues(raw: RawData, header: string): string {
   const idx = raw.headers.indexOf(header);
   if (idx === -1) return "";
   return raw.rows
      .slice(0, 3)
      .map((r) => r[idx] ?? "")
      .filter(Boolean)
      .join(", ");
}

function mappingStorageKey(headers: string[]): string {
   return `montte:import:mapping:${[...headers].sort().join(",")}`;
}

function applyMappingToRow(
   row: string[],
   headers: string[],
   mapping: ColumnMapping,
): ParsedRow {
   const get = (field: ColumnField): string => {
      const header = mapping[field];
      if (!header) return "";
      const idx = headers.indexOf(header);
      return idx !== -1 ? (row[idx] ?? "") : "";
   };

   const rawAmount = get("amount");
   const numericAmount = Number.parseFloat(
      rawAmount.replace(/[^\d.,-]/g, "").replace(",", "."),
   );
   const rawType = get("type");
   const name = get("name");

   const type =
      rawType.trim() !== ""
         ? inferType(rawType, numericAmount)
         : numericAmount < 0
           ? "expense"
           : (inferTypeFromName(name) ?? "expense");

   return {
      date: get("date"),
      name,
      type,
      amount: rawAmount,
      description: get("description"),
   };
}

function guessColumns(headers: string[]): Partial<ColumnMapping> {
   const lower = headers.map((h) => h.toLowerCase().trim());
   return Object.fromEntries(
      COLUMN_FIELDS.flatMap((field) => {
         const idx = lower.findIndex((h) =>
            COLUMN_PATTERNS[field].some((p) => h.includes(p)),
         );
         return idx !== -1 ? [[field, headers[idx]]] : [];
      }),
   ) as Partial<ColumnMapping>;
}

function parseOfxBuffer(
   buffer: ArrayBuffer,
   minImportDate: string | null,
): ValidatedRow[] {
   const ofxDoc = parseOfx(new Uint8Array(buffer));
   const txs = getTransactions(ofxDoc);
   return txs.map((tx) => {
      const amount = Math.abs(tx.TRNAMT);
      const type = inferTypeFromOfx(tx.TRNTYPE, tx.TRNAMT);
      const dtDate = tx.DTPOSTED.toDate();
      const date = !Number.isNaN(dtDate.getTime())
         ? dayjs(dtDate).format("YYYY-MM-DD")
         : (parseDate(tx.DTPOSTED.raw.replace(/\[.*\]/, "").slice(0, 8)) ??
           tx.DTPOSTED.raw.slice(0, 8));
      const parsed: ParsedRow = {
         date,
         name: tx.NAME ?? tx.MEMO ?? "",
         type,
         amount: String(amount),
         description: tx.MEMO ?? "",
      };
      return validateRow(parsed, minImportDate);
   });
}

type ImportPayloadItem = {
   name?: string;
   type: "income" | "expense";
   amount: string;
   date: string;
   description?: string;
   categoryId?: string;
};

type StatementImportContextValue = {
   rawData: RawData | null;
   rows: ValidatedRow[];
   setRows: (rows: ValidatedRow[]) => void;
   duplicateFlags: boolean[];
   format: FileFormat;
   bankAccountId: string;
   setBankAccountId: (id: string) => void;
   mapping: ColumnMapping;
   setMapping: (m: ColumnMapping) => void;
   savedMappingApplied: boolean;
   minImportDate: string | null;
   confirmedIndices: Set<number>;
   setConfirmedIndices: (s: Set<number>) => void;
   parseFile: (file: File) => Promise<void>;
   applyColumnMapping: (m: ColumnMapping) => Promise<void>;
   resetMapping: () => void;
   buildImportPayload: () => ImportPayloadItem[];
};

const StatementImportContext =
   createContext<StatementImportContextValue | null>(null);

export function useStatementImportContext(): StatementImportContextValue {
   const ctx = useContext(StatementImportContext);
   invariant(
      ctx,
      "useStatementImportContext must be used within StatementImportProvider",
   );
   return ctx;
}

export function StatementImportProvider({
   teamId,
   children,
}: {
   teamId: string;
   children: ReactNode;
}) {
   const [confirmedIndices, setConfirmedIndices] = useState<Set<number>>(
      new Set(),
   );

   const { buildImportPayload: buildPayload, ...rest } = useStatementImport({
      teamId,
      onInitSelection: setConfirmedIndices,
   });

   const buildImportPayload = useCallback(
      () => buildPayload(confirmedIndices),
      [buildPayload, confirmedIndices],
   );

   return (
      // oxlint-ignore react/no-context-provider-as-value-passing-callback
      <StatementImportContext.Provider
         value={{
            ...rest,
            confirmedIndices,
            setConfirmedIndices,
            buildImportPayload,
         }}
      >
         {children}
      </StatementImportContext.Provider>
   );
}

function useStatementImport({
   teamId,
   onInitSelection,
}: {
   teamId: string;
   onInitSelection?: (s: Set<number>) => void;
}) {
   const csv = useCsvFile();
   const xlsx = useXlsxFile();
   const [rawData, setRawData] = useState<RawData | null>(null);
   const [rows, setRows] = useState<ValidatedRow[]>([]);
   const [duplicateFlags, setDuplicateFlags] = useState<boolean[]>([]);
   const [format, setFormat] = useState<FileFormat>("csv");
   const [bankAccountId, setBankAccountId] = useLocalStorage<string>(
      "montte:import:bankAccountId",
      "",
   );
   const [mapping, setMapping] = useState<ColumnMapping>(EMPTY_MAPPING);
   const [savedMappingApplied, setSavedMappingApplied] = useState(false);

   const checkDuplicatesMutation = useMutation(
      orpc.transactions.checkDuplicates.mutationOptions({}),
   );

   const { minDateStr: minImportDate } = useCnpj(teamId);

   const [, setSavedMapping] = useLocalStorage<ColumnMapping>(
      rawData
         ? mappingStorageKey(rawData.headers)
         : "montte:import:mapping:__none__",
      undefined,
      {
         serializer: JSON.stringify,
         deserializer: JSON.parse,
      },
   );

   const initSelection = useCallback(
      (mapped: ValidatedRow[], flags: boolean[]) => {
         const sel = new Set(
            mapped.flatMap((r, i) => (r.isValid && !flags[i] ? [i] : [])),
         );
         onInitSelection?.(sel);
      },
      [onInitSelection],
   );

   const debouncedCheckDuplicates = useDebouncedCallback(
      async (mapped: ValidatedRow[]) => {
         const validRows = mapped.filter((r) => r.isValid);
         if (!bankAccountId || validRows.length === 0) {
            setDuplicateFlags([]);
            initSelection(mapped, []);
            return;
         }
         try {
            const flags = await checkDuplicatesMutation.mutateAsync({
               bankAccountId,
               transactions: validRows.map((r) => ({
                  date: parseDate(r.date) ?? r.date,
                  amount: parseAmount(r.amount) ?? r.amount,
                  type: r.type,
               })),
            });
            let fi = 0;
            const fullFlags = mapped.map((r) =>
               r.isValid ? (flags[fi++] ?? false) : false,
            );
            setDuplicateFlags(fullFlags);
            initSelection(mapped, fullFlags);
         } catch {
            setDuplicateFlags([]);
            initSelection(mapped, []);
         }
      },
      { wait: 400 },
   );

   const applyRows = useCallback(
      async (mapped: ValidatedRow[]) => {
         setRows(mapped);
         debouncedCheckDuplicates(mapped);
      },
      [debouncedCheckDuplicates],
   );

   const parseFile = useCallback(
      async (file: File): Promise<void> => {
         const ext = file.name.split(".").pop()?.toLowerCase();

         if (ext === "ofx") {
            const buffer = await file.arrayBuffer();
            setFormat("ofx");
            await applyRows(parseOfxBuffer(buffer, minImportDate));
            return;
         }

         const isXlsx = ext === "xlsx" || ext === "xls";
         const raw = isXlsx ? await xlsx.parse(file) : await csv.parse(file);

         setFormat(isXlsx ? "xlsx" : "csv");
         setRawData(raw);

         const saved = localStorage.getItem(mappingStorageKey(raw.headers));
         if (saved) {
            try {
               const parsed: ColumnMapping = JSON.parse(saved);
               setMapping((prev) => ({ ...prev, ...parsed }));
               setSavedMappingApplied(true);
            } catch {
               setMapping((prev) => ({
                  ...prev,
                  ...guessColumns(raw.headers),
               }));
            }
            return;
         }

         setMapping((prev) => ({ ...prev, ...guessColumns(raw.headers) }));
      },
      [applyRows, csv, minImportDate, xlsx],
   );

   const applyColumnMapping = useCallback(
      async (m: ColumnMapping) => {
         if (!rawData) return;
         setSavedMapping(m);
         const mapped = rawData.rows.map((r) =>
            validateRow(
               applyMappingToRow(r, rawData.headers, m),
               minImportDate,
            ),
         );
         await applyRows(mapped);
      },
      [rawData, setSavedMapping, minImportDate, applyRows],
   );

   const resetMapping = useCallback(() => {
      setSavedMappingApplied(false);
      setMapping(EMPTY_MAPPING);
      setSavedMapping(null);
   }, [setSavedMapping]);

   const buildImportPayload = useCallback(
      (selectedIndices: Set<number>): ImportPayloadItem[] =>
         rows
            .filter((_, i) => selectedIndices.has(i))
            .map((r) => ({
               name: r.name || undefined,
               type: r.type,
               amount: parseAmount(r.amount) ?? r.amount,
               date: parseDate(r.date) ?? r.date,
               description: r.description || undefined,
               categoryId: r.categoryId || undefined,
            })),
      [rows],
   );

   return {
      rawData,
      rows,
      setRows,
      duplicateFlags,
      format,
      bankAccountId,
      setBankAccountId,
      mapping,
      setMapping,
      savedMappingApplied,
      minImportDate,
      parseFile,
      applyColumnMapping,
      resetMapping,
      buildImportPayload,
   };
}
