import { parseBufferOrThrow as parseCsvBuffer } from "@f-o-t/csv";
import { of as moneyOf, toMajorUnitsString } from "@f-o-t/money";
import { parseBufferOrThrow as parseOfx, getTransactions } from "@f-o-t/ofx";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { useCallback, useState } from "react";
import { read as xlsxRead, utils as xlsxUtils } from "xlsx";
import { orpc } from "@/integrations/orpc/client";

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

const DATE_FORMATS = [
   "YYYY-MM-DD",
   "DD/MM/YYYY",
   "MM/DD/YYYY",
   "DD-MM-YYYY",
   "YYYYMMDD",
   "DD/MM/YY",
] as const;

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
      return toMajorUnitsString(moneyOf(normalized, "BRL")).replace("-", "");
   } catch {
      return null;
   }
}

const OFX_INCOME_TYPES = new Set(["CREDIT", "INT", "DIV", "DIRECTDEP"]);

function inferTypeFromOfx(
   trnType: string,
   trnAmt: number,
): "income" | "expense" {
   if (trnAmt > 0) return "income";
   if (trnAmt < 0) return "expense";
   if (OFX_INCOME_TYPES.has(trnType)) return "income";
   return "expense";
}

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

function inferTypeFromName(name: string): "income" | "expense" | null {
   const n = name.toLowerCase();
   if (INCOME_NAME_PATTERNS.some((p) => n.includes(p))) return "income";
   if (EXPENSE_NAME_PATTERNS.some((p) => n.includes(p))) return "expense";
   return null;
}

function inferType(raw: string, amount: number): "income" | "expense" {
   const t = raw.toLowerCase().trim();
   if (["receita", "income", "crédito", "credito", "credit"].includes(t))
      return "income";
   if (["despesa", "expense", "débito", "debito", "debit"].includes(t))
      return "expense";
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

export function mappingStorageKey(headers: string[]): string {
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
   const patterns: Record<ColumnField, string[]> = {
      date: ["data", "date", "dt", "data_lancamento"],
      name: ["nome", "name", "historico", "memo", "descricao"],
      type: ["tipo", "type", "natureza", "operacao"],
      amount: ["valor", "value", "amount", "montante", "vlr"],
      description: ["descricao", "description", "obs", "complemento"],
   };
   const mapping: Partial<ColumnMapping> = {};
   for (const field of COLUMN_FIELDS) {
      const idx = lower.findIndex((h) =>
         patterns[field].some((c) => h.includes(c)),
      );
      if (idx !== -1) mapping[field] = headers[idx];
   }
   return mapping;
}

function parseXlsx(buffer: ArrayBuffer): RawData {
   const wb = xlsxRead(buffer, { type: "array" });
   const ws = wb.Sheets[wb.SheetNames[0]];
   if (!ws) throw new Error("Planilha vazia");
   const data = xlsxUtils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      defval: "",
   });
   if (data.length < 2) throw new Error("Planilha sem dados");
   return {
      headers: (data[0] as unknown[]).map(String),
      rows: (data.slice(1) as unknown[][])
         .filter((r) => r.some((c) => String(c).trim() !== ""))
         .map((r) => r.map(String)),
   };
}

function parseCsv(buffer: ArrayBuffer): RawData {
   const doc = parseCsvBuffer(new Uint8Array(buffer), {
      hasHeaders: true,
      trimFields: true,
   });
   return {
      headers: doc.headers ?? [],
      rows: doc.rows.map((r) => r.fields),
   };
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

const EMPTY_MAPPING: ColumnMapping = {
   date: "",
   name: "",
   type: "",
   amount: "",
   description: "",
};

export function useStatementImport({ teamId }: { teamId: string }) {
   const [rawData, setRawData] = useState<RawData | null>(null);
   const [rows, setRows] = useState<ValidatedRow[]>([]);
   const [duplicateFlags, setDuplicateFlags] = useState<boolean[]>([]);
   const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
      new Set(),
   );
   const [format, setFormat] = useState<FileFormat>("csv");
   const [bankAccountId, setBankAccountId] = useState("");
   const [mapping, setMapping] = useState<ColumnMapping>(EMPTY_MAPPING);
   const [savedMappingApplied, setSavedMappingApplied] = useState(false);

   const checkDuplicatesMutation = useMutation(
      orpc.transactions.checkDuplicates.mutationOptions({}),
   );

   const { data: teamData } = useSuspenseQuery(
      orpc.team.get.queryOptions({ input: { teamId } }),
   );

   const cnpjData = teamData?.cnpjData as
      | { data_inicio_atividade?: string }
      | null
      | undefined;
   const minImportDate: string | null = (() => {
      const raw = cnpjData?.data_inicio_atividade;
      if (!raw) return null;
      const d = dayjs(raw, "DD/MM/YYYY", true);
      if (d.isValid()) return d.format("YYYY-MM-DD");
      return parseDate(raw);
   })();

   function initSelection(mapped: ValidatedRow[], flags: boolean[]) {
      const sel = new Set<number>();
      mapped.forEach((r, i) => {
         if (r.isValid && !flags[i]) sel.add(i);
      });
      setSelectedIndices(sel);
   }

   const applyRows = useCallback(
      async (mapped: ValidatedRow[]) => {
         setRows(mapped);
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
      // oxlint-ignore react-hooks/exhaustive-deps
      [bankAccountId, checkDuplicatesMutation],
   );

   async function parseFile(file: File): Promise<void> {
      const ext = file.name.split(".").pop()?.toLowerCase();

      return new Promise((resolve, reject) => {
         const reader = new FileReader();
         reader.onload = async (ev) => {
            try {
               const buffer = ev.target?.result;
               if (!(buffer instanceof ArrayBuffer))
                  throw new Error("read error");

               if (ext === "ofx") {
                  const parsed = parseOfxBuffer(buffer, minImportDate);
                  setFormat("ofx");
                  await applyRows(parsed);
                  resolve();
                  return;
               }

               const raw =
                  ext === "xlsx" || ext === "xls"
                     ? parseXlsx(buffer)
                     : parseCsv(buffer);

               setFormat(ext === "xlsx" || ext === "xls" ? "xlsx" : "csv");
               setRawData(raw);

               const saved = localStorage.getItem(
                  mappingStorageKey(raw.headers),
               );
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
               } else {
                  setMapping((prev) => ({
                     ...prev,
                     ...guessColumns(raw.headers),
                  }));
               }

               resolve();
            } catch (err) {
               reject(err);
            }
         };
         reader.onerror = () => reject(new Error("Falha ao ler arquivo"));
         reader.readAsArrayBuffer(file);
      });
   }

   async function applyColumnMapping(m: ColumnMapping) {
      if (!rawData) return;
      localStorage.setItem(
         mappingStorageKey(rawData.headers),
         JSON.stringify(m),
      );
      const mapped = rawData.rows.map((r) =>
         validateRow(applyMappingToRow(r, rawData.headers, m), minImportDate),
      );
      await applyRows(mapped);
   }

   function resetMapping() {
      setSavedMappingApplied(false);
      setMapping(EMPTY_MAPPING);
   }

   function buildImportPayload() {
      return rows
         .filter((_, i) => selectedIndices.has(i))
         .map((r) => ({
            name: r.name || undefined,
            type: r.type,
            amount: parseAmount(r.amount) ?? r.amount,
            date: parseDate(r.date) ?? r.date,
            description: r.description || undefined,
            categoryId: r.categoryId || undefined,
         }));
   }

   return {
      // state
      rawData,
      rows,
      setRows,
      duplicateFlags,
      selectedIndices,
      setSelectedIndices,
      format,
      bankAccountId,
      setBankAccountId,
      mapping,
      setMapping,
      savedMappingApplied,
      minImportDate,
      // actions
      parseFile,
      applyColumnMapping,
      resetMapping,
      buildImportPayload,
   };
}
