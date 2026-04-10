import { useCsvFile } from "@/hooks/use-csv-file";
import { useXlsxFile } from "@/hooks/use-xlsx-file";
import { useLocalStorage } from "foxact/use-local-storage";
import { invariant } from "foxact/invariant";
import { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";

export type FileFormat = "csv" | "xlsx";

export type RawData = {
   headers: string[];
   rows: string[][];
};

export type ColumnField =
   | "tipo"
   | "nome"
   | "codigo_banco"
   | "descricao"
   | "saldo_inicial"
   | "cor";

export type ColumnMapping = Record<ColumnField, string>;

export const COLUMN_FIELDS: ColumnField[] = [
   "tipo",
   "nome",
   "codigo_banco",
   "descricao",
   "saldo_inicial",
   "cor",
];

export const REQUIRED_FIELDS: ColumnField[] = ["tipo", "nome"];

export const FIELD_LABELS: Record<ColumnField, string> = {
   tipo: "Tipo de conta *",
   nome: "Nome *",
   codigo_banco: "Código do banco",
   descricao: "Descrição",
   saldo_inicial: "Saldo inicial",
   cor: "Cor (hex)",
};

export const TEMPLATE_HEADERS = [
   "tipo",
   "nome",
   "codigo_banco",
   "descricao",
   "saldo_inicial",
   "cor",
] as const;

export const TEMPLATE_ROWS = [
   {
      tipo: "corrente",
      nome: "Nubank",
      codigo_banco: "260",
      descricao: "Conta principal",
      saldo_inicial: "1500.00",
      cor: "#6366f1",
   },
   {
      tipo: "poupanca",
      nome: "Caixa Econômica",
      codigo_banco: "104",
      descricao: "",
      saldo_inicial: "500.00",
      cor: "#22c55e",
   },
   {
      tipo: "caixa",
      nome: "Caixa Físico",
      codigo_banco: "",
      descricao: "",
      saldo_inicial: "200.00",
      cor: "#f59e0b",
   },
] as const;

export type ResolvedBankAccountType =
   | "checking"
   | "savings"
   | "investment"
   | "payment"
   | "cash";

export const TYPE_MAP: Record<string, ResolvedBankAccountType> = {
   caixa: "cash",
   "caixa fisico": "cash",
   "caixa físico": "cash",
   cash: "cash",
   corrente: "checking",
   "conta corrente": "checking",
   checking: "checking",
   poupanca: "savings",
   poupança: "savings",
   "conta poupanca": "savings",
   "conta poupança": "savings",
   savings: "savings",
   pagamento: "payment",
   "conta pagamento": "payment",
   payment: "payment",
   investimento: "investment",
   "conta investimento": "investment",
   investment: "investment",
};

const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

export const BANK_TYPES: ResolvedBankAccountType[] = [
   "checking",
   "savings",
   "investment",
   "payment",
];

export type PreviewRow = {
   tipo: string;
   nome: string;
   codigo_banco: string;
   descricao: string;
   saldo_inicial: string;
   cor: string;
   _resolvedType: ResolvedBankAccountType | null;
   _valid: boolean;
   _errors: string[];
};

export function getSampleValues(raw: RawData, header: string): string {
   const idx = raw.headers.indexOf(header);
   if (idx === -1) return "";
   return raw.rows
      .slice(0, 3)
      .map((r) => r[idx] ?? "")
      .filter(Boolean)
      .join(", ");
}

export function buildPreviewRows(
   rawData: RawData,
   mapping: ColumnMapping,
   overrides?: Map<number, Partial<Pick<PreviewRow, "codigo_banco">>>,
): PreviewRow[] {
   return rawData.rows.map((row, index) => {
      const get = (field: ColumnField) => {
         const col = mapping[field];
         if (!col) return "";
         const idx = rawData.headers.indexOf(col);
         return idx >= 0 ? (row[idx] ?? "").trim() : "";
      };
      const tipo = get("tipo");
      const nome = get("nome");
      const override = overrides?.get(index);
      const codigo_banco = override?.codigo_banco ?? get("codigo_banco");
      const resolvedType = TYPE_MAP[tipo.toLowerCase().trim()] ?? null;
      const errors: string[] = [];
      if (!resolvedType) errors.push("Tipo inválido");
      if (nome.length < 2) errors.push("Nome muito curto");
      if (resolvedType && BANK_TYPES.includes(resolvedType) && !codigo_banco) {
         errors.push("Código do banco obrigatório");
      }
      return {
         tipo,
         nome,
         codigo_banco,
         descricao: get("descricao"),
         saldo_inicial: get("saldo_inicial"),
         cor: get("cor"),
         _resolvedType: resolvedType,
         _valid: errors.length === 0,
         _errors: errors,
      };
   });
}

export function toCreateInput(row: PreviewRow) {
   const resolvedColor = HEX_COLOR_REGEX.test(row.cor) ? row.cor : "#6366f1";
   const rawBalance = row.saldo_inicial.replace(",", ".");
   const resolvedBalance = Number.isNaN(Number(rawBalance))
      ? "0"
      : String(Number(rawBalance));
   return {
      type: row._resolvedType ?? "checking",
      name: row.nome.trim(),
      notes: row.descricao || null,
      initialBalance: resolvedBalance,
      color: resolvedColor,
      bankCode: row.codigo_banco || null,
   };
}

const EMPTY_MAPPING: ColumnMapping = {
   tipo: "",
   nome: "",
   codigo_banco: "",
   descricao: "",
   saldo_inicial: "",
   cor: "",
};

function autoDetectMapping(headers: string[]): ColumnMapping {
   const mapped = { ...EMPTY_MAPPING };
   for (const field of COLUMN_FIELDS) {
      const match = headers.find(
         (h) =>
            h.toLowerCase().trim() === field ||
            h.toLowerCase().trim() === field.replace(/_/g, " "),
      );
      if (match) mapped[field] = match;
   }
   return mapped;
}

type BankAccountImportContextValue = {
   rawData: RawData | null;
   mapping: ColumnMapping;
   setMapping: (m: ColumnMapping) => void;
   savedMappingApplied: boolean;
   parseFile: (file: File) => Promise<void>;
   applyColumnMapping: (m: ColumnMapping) => void;
   resetMapping: () => void;
   previewRows: PreviewRow[];
   ignoredIndices: Set<number>;
   setIgnoredIndices: (s: Set<number>) => void;
   updateRow: (
      index: number,
      data: Partial<Pick<PreviewRow, "codigo_banco">>,
   ) => void;
};

const BankAccountImportContext =
   createContext<BankAccountImportContextValue | null>(null);

export function useBankAccountImportContext() {
   const ctx = useContext(BankAccountImportContext);
   invariant(
      ctx,
      "useBankAccountImportContext must be used inside BankAccountImportProvider",
   );
   return ctx;
}

export function BankAccountImportProvider({
   children,
}: {
   children: ReactNode;
}) {
   const csv = useCsvFile();
   const xlsx = useXlsxFile();
   const [rawData, setRawData] = useState<RawData | null>(null);
   const [mapping, setMappingState] = useState<ColumnMapping>(EMPTY_MAPPING);
   const [savedMappingApplied, setSavedMappingApplied] = useState(false);
   const [ignoredIndices, setIgnoredIndices] = useState<Set<number>>(new Set());
   const [rowOverrides, setRowOverrides] = useState<
      Map<number, Partial<Pick<PreviewRow, "codigo_banco">>>
   >(new Map());
   const [savedMapping, setSavedMapping] =
      useLocalStorage<ColumnMapping | null>(
         "montte:bank-account-import:mapping",
         null,
      );

   const parseFile = useCallback(
      async (file: File) => {
         const ext = file.name.split(".").pop()?.toLowerCase();
         const data =
            ext === "xlsx" || ext === "xls"
               ? await xlsx.parse(file)
               : await csv.parse(file);
         setRawData(data);
         const auto = autoDetectMapping(data.headers);
         if (savedMapping) {
            const applied = { ...auto };
            let anyApplied = false;
            for (const field of COLUMN_FIELDS) {
               if (
                  savedMapping[field] &&
                  data.headers.includes(savedMapping[field])
               ) {
                  applied[field] = savedMapping[field];
                  anyApplied = true;
               }
            }
            setMappingState(applied);
            setSavedMappingApplied(anyApplied);
         } else {
            setMappingState(auto);
            setSavedMappingApplied(false);
         }
      },
      [csv, xlsx, savedMapping],
   );

   const applyColumnMapping = useCallback(
      (m: ColumnMapping) => {
         setMappingState(m);
         setSavedMapping(m);
         setSavedMappingApplied(false);
      },
      [setSavedMapping],
   );

   const resetMapping = useCallback(() => {
      if (!rawData) return;
      const auto = autoDetectMapping(rawData.headers);
      setMappingState(auto);
      setSavedMapping(null);
      setSavedMappingApplied(false);
   }, [rawData, setSavedMapping]);

   const updateRow = useCallback(
      (index: number, data: Partial<Pick<PreviewRow, "codigo_banco">>) => {
         setRowOverrides((prev) => {
            const next = new Map(prev);
            next.set(index, { ...prev.get(index), ...data });
            return next;
         });
      },
      [],
   );

   const previewRows = rawData
      ? buildPreviewRows(rawData, mapping, rowOverrides)
      : [];

   return (
      <BankAccountImportContext.Provider
         value={{
            rawData,
            mapping,
            setMapping: setMappingState,
            savedMappingApplied,
            parseFile,
            applyColumnMapping,
            resetMapping,
            previewRows,
            ignoredIndices,
            setIgnoredIndices,
            updateRow,
         }}
      >
         {children}
      </BankAccountImportContext.Provider>
   );
}
