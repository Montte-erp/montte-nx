import { useCsvFile } from "@/hooks/use-csv-file";
import { useXlsxFile } from "@/hooks/use-xlsx-file";
import { fromPromise, fromThrowable } from "neverthrow";
import { invariant } from "foxact/invariant";
import { z } from "zod";
import {
   createContext,
   useCallback,
   useContext,
   useMemo,
   useState,
} from "react";
import type { ReactNode } from "react";

export type RawData = { headers: string[]; rows: string[][] };

export type MappedCategory = {
   name: string;
   type: "income" | "expense" | null;
   color: string | null;
   icon: string | null;
   keywords: string[] | null;
   subcategories: { name: string; keywords: string[] | null }[];
   valid: boolean;
};

export type ImportPayloadItem = {
   name: string;
   type: "income" | "expense";
   color: string | null;
   icon: string | null;
   keywords: string[] | null;
   subcategories: { name: string; keywords?: string[] }[];
};

export const FIELD_OPTIONS = [
   { value: "__skip__", label: "Ignorar" },
   { value: "name", label: "Nome *" },
   { value: "type", label: "Tipo (receita/despesa)" },
   { value: "color", label: "Cor (hex)" },
   { value: "icon", label: "Ícone" },
   { value: "keywords", label: "Palavras-chave (separadas por ;)" },
   { value: "subcategory", label: "Subcategoria" },
   { value: "subcategoryKeywords", label: "Palavras-chave (Sub)" },
];

export const TEMPLATE_HEADERS = [
   "nome",
   "tipo",
   "cor",
   "icone",
   "palavras-chave",
   "subcategoria",
   "palavras-chave-sub",
] as const;

export const TEMPLATE_ROWS: Record<string, string>[] = [
   {
      nome: "Alimentação",
      tipo: "despesa",
      cor: "#ef4444",
      icone: "utensils",
      "palavras-chave": "mercado;restaurante",
      subcategoria: "Supermercado",
      "palavras-chave-sub": "pao;leite",
   },
   {
      nome: "Alimentação",
      tipo: "despesa",
      cor: "#ef4444",
      icone: "utensils",
      "palavras-chave": "mercado;restaurante",
      subcategoria: "Restaurante",
      "palavras-chave-sub": "almoco;jantar",
   },
   {
      nome: "Salário",
      tipo: "receita",
      cor: "#22c55e",
      icone: "wallet",
      "palavras-chave": "salario;pagamento",
      subcategoria: "",
      "palavras-chave-sub": "",
   },
];

const MAPPING_PATTERNS: Record<string, RegExp> = {
   name: /^(nome|name|categoria|category)$/i,
   type: /^(tipo|type)$/i,
   color: /^(cor|color)$/i,
   icon: /^(icone|ícone|icon)$/i,
   keywords: /^(palavras?.?chave|keywords?)$/i,
   subcategory: /^(subcategoria|subcategory|sub)$/i,
   subcategoryKeywords: /^(palavras?.?chave.*sub|sub.*keywords?)$/i,
};

function guessMapping(headers: string[]): Record<string, string> {
   const mapping: Record<string, string> = {};
   for (const header of headers) {
      let matched = false;
      for (const [field, regex] of Object.entries(MAPPING_PATTERNS)) {
         if (regex.test(header)) {
            mapping[header] = field;
            matched = true;
            break;
         }
      }
      if (!matched) mapping[header] = "__skip__";
   }
   return mapping;
}

export function getSampleValues(rawData: RawData, header: string): string {
   const idx = rawData.headers.indexOf(header);
   if (idx === -1) return "";
   return rawData.rows
      .slice(0, 3)
      .map((r) => r[idx] ?? "")
      .filter(Boolean)
      .join(", ");
}

function mappingStorageKey(headers: string[]): string {
   return `montte:categories:import:mapping:${[...headers].sort().join(",")}`;
}

function buildMappedCategories(
   rawData: RawData,
   mapping: Record<string, string>,
): MappedCategory[] {
   const getField = (row: string[], field: string): string => {
      const header = rawData.headers.find((h) => mapping[h] === field);
      if (!header) return "";
      const idx = rawData.headers.indexOf(header);
      return (row[idx] ?? "").trim();
   };

   const categoryMap = new Map<string, MappedCategory>();

   for (const row of rawData.rows) {
      const name = getField(row, "name");
      if (!name) continue;

      const typeRaw = getField(row, "type").toLowerCase();
      let type: "income" | "expense" | null = null;
      if (typeRaw === "receita" || typeRaw === "income") type = "income";
      else if (typeRaw === "despesa" || typeRaw === "expense") type = "expense";

      const color = getField(row, "color") || null;
      const icon = getField(row, "icon") || null;
      const keywordsRaw = getField(row, "keywords");
      const keywords = keywordsRaw
         ? keywordsRaw
              .split(/[;,]/)
              .map((k) => k.trim())
              .filter(Boolean)
         : null;

      const subName = getField(row, "subcategory");
      const subKeywordsRaw = getField(row, "subcategoryKeywords");
      const subKeywords = subKeywordsRaw
         ? subKeywordsRaw
              .split(/[;,]/)
              .map((k) => k.trim())
              .filter(Boolean)
         : null;

      if (!categoryMap.has(name)) {
         categoryMap.set(name, {
            name,
            type,
            color,
            icon,
            keywords,
            subcategories: [],
            valid: type !== null,
         });
      }

      if (subName) {
         const existing = categoryMap.get(name);
         if (existing) {
            const existingSub = existing.subcategories.find(
               (s) => s.name === subName,
            );
            if (existingSub) {
               if (subKeywords) {
                  existingSub.keywords = [
                     ...new Set([
                        ...(existingSub.keywords ?? []),
                        ...subKeywords,
                     ]),
                  ];
               }
            } else {
               existing.subcategories.push({
                  name: subName,
                  keywords: subKeywords,
               });
            }
         }
      }
   }

   return Array.from(categoryMap.values());
}

type CategoryImportContextValue = {
   rawData: RawData | null;
   mapping: Record<string, string>;
   setMapping: (m: Record<string, string>) => void;
   savedMappingApplied: boolean;
   resetMapping: () => void;
   parseFile: (file: File) => Promise<void>;
   applyColumnMapping: (mapping: Record<string, string>) => void;
   mappedCategories: MappedCategory[];
   buildImportPayload: () => ImportPayloadItem[];
};

const CategoryImportContext = createContext<CategoryImportContextValue | null>(
   null,
);

export function CategoryImportProvider({ children }: { children: ReactNode }) {
   const { parse: parseCsv } = useCsvFile();
   const { parse: parseXlsx } = useXlsxFile();
   const [rawData, setRawData] = useState<RawData | null>(null);
   const [mapping, setMappingState] = useState<Record<string, string>>({});
   const [savedMappingApplied, setSavedMappingApplied] = useState(false);

   const mappedCategories = useMemo(
      () => (rawData ? buildMappedCategories(rawData, mapping) : []),
      [rawData, mapping],
   );

   const parseFile = useCallback(
      async (file: File): Promise<void> => {
         const isXlsx =
            file.name.toLowerCase().endsWith(".xlsx") ||
            file.type ===
               "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
         const result = await fromPromise(
            isXlsx ? parseXlsx(file) : parseCsv(file),
            (e) => e,
         );
         if (result.isErr())
            throw new Error("Arquivo CSV inválido ou corrompido.");
         const raw = result.value;
         setRawData(raw);

         const saved = localStorage.getItem(mappingStorageKey(raw.headers));
         if (saved) {
            const safeParse = fromThrowable(JSON.parse);
            const parseResult = safeParse(saved);
            const mappingSchema = z.record(z.string(), z.string());
            const validated = parseResult.isOk()
               ? mappingSchema.safeParse(parseResult.value)
               : null;
            if (!validated?.success) {
               setMappingState(guessMapping(raw.headers));
               setSavedMappingApplied(false);
               return;
            }
            setMappingState(validated.data);
            setSavedMappingApplied(true);
            return;
         }

         setMappingState(guessMapping(raw.headers));
         setSavedMappingApplied(false);
      },
      [parseCsv, parseXlsx],
   );

   const setMapping = useCallback((m: Record<string, string>) => {
      setMappingState(m);
   }, []);

   const applyColumnMapping = useCallback(
      (m: Record<string, string>) => {
         if (!rawData) return;
         localStorage.setItem(
            mappingStorageKey(rawData.headers),
            JSON.stringify(m),
         );
         setMappingState(m);
      },
      [rawData],
   );

   const resetMapping = useCallback(() => {
      if (!rawData) return;
      localStorage.removeItem(mappingStorageKey(rawData.headers));
      setSavedMappingApplied(false);
      setMappingState(guessMapping(rawData.headers));
   }, [rawData]);

   const buildImportPayload = useCallback((): ImportPayloadItem[] => {
      const result: ImportPayloadItem[] = [];
      for (const c of mappedCategories) {
         if (!c.valid) continue;
         if (c.type !== "income" && c.type !== "expense") continue;
         result.push({
            name: c.name,
            type: c.type,
            color: c.color,
            icon: c.icon,
            keywords: c.keywords,
            subcategories: c.subcategories.map((s) => ({
               name: s.name,
               keywords: s.keywords ?? undefined,
            })),
         });
      }
      return result;
   }, [mappedCategories]);

   return (
      <CategoryImportContext.Provider
         value={{
            rawData,
            mapping,
            setMapping,
            savedMappingApplied,
            resetMapping,
            parseFile,
            applyColumnMapping,
            mappedCategories,
            buildImportPayload,
         }}
      >
         {children}
      </CategoryImportContext.Provider>
   );
}

export function useCategoryImportContext(): CategoryImportContextValue {
   const ctx = useContext(CategoryImportContext);
   invariant(
      ctx,
      "useCategoryImportContext must be used inside CategoryImportProvider",
   );
   return ctx;
}
