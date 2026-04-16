import { Badge } from "@packages/ui/components/badge";
import type { ColumnDef, ImportConfig } from "@/features/import/types";

export type MappedCategory = {
   name: string;
   type: "income" | "expense" | null;
   color: string | null;
   icon: string | null;
   keywords: string[] | null;
   subcategories: { name: string; keywords: string[] | null }[];
};

const COLUMN_DEFS: ColumnDef[] = [
   {
      field: "name",
      label: "Nome *",
      patterns: [/^(nome|name|categoria|category)$/i],
      required: true,
   },
   {
      field: "type",
      label: "Tipo (receita/despesa)",
      patterns: [/^(tipo|type)$/i],
   },
   { field: "color", label: "Cor (hex)", patterns: [/^(cor|color)$/i] },
   { field: "icon", label: "Ícone", patterns: [/^(icone|ícone|icon)$/i] },
   {
      field: "keywords",
      label: "Palavras-chave (sep. por ;)",
      patterns: [/^(palavras?.?chave|keywords?)$/i],
   },
   {
      field: "subcategory",
      label: "Subcategoria",
      patterns: [/^(subcategoria|subcategory|sub)$/i],
   },
   {
      field: "subcategoryKeywords",
      label: "Palavras-chave (Sub)",
      patterns: [/^(palavras?.?chave.*sub|sub.*keywords?)$/i],
   },
];

export const TEMPLATE = {
   headers: [
      "nome",
      "tipo",
      "cor",
      "icone",
      "palavras-chave",
      "subcategoria",
      "palavras-chave-sub",
   ] as const,
   rows: [
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
   ],
   filename: "modelo-categorias",
};

export const EXPORT_HEADERS = [
   "Nome",
   "Tipo",
   "Cor",
   "Ícone",
   "Palavras-chave",
   "Subcategoria",
   "Palavras-chave-Sub",
] as const;

export interface ExportableCategory {
   id: string;
   name: string;
   type: string | null;
   color: string | null;
   icon: string | null;
   keywords: string[] | null;
   parentId: string | null;
}

export function buildExportRows(
   categories: ExportableCategory[],
): Record<string, string>[] {
   const parents = categories.filter((c) => c.parentId === null);
   const rows: Record<string, string>[] = [];

   for (const parent of parents) {
      const subs = categories.filter((c) => c.parentId === parent.id);
      const typeLabel =
         parent.type === "income"
            ? "Receita"
            : parent.type === "expense"
              ? "Despesa"
              : "";

      if (subs.length === 0) {
         rows.push({
            Nome: parent.name,
            Tipo: typeLabel,
            Cor: parent.color ?? "",
            Ícone: parent.icon ?? "",
            "Palavras-chave": parent.keywords?.join("; ") ?? "",
            Subcategoria: "",
            "Palavras-chave-Sub": "",
         });
      } else {
         for (const sub of subs) {
            rows.push({
               Nome: parent.name,
               Tipo: typeLabel,
               Cor: parent.color ?? "",
               Ícone: parent.icon ?? "",
               "Palavras-chave": parent.keywords?.join("; ") ?? "",
               Subcategoria: sub.name,
               "Palavras-chave-Sub": sub.keywords?.join("; ") ?? "",
            });
         }
      }
   }

   return rows;
}

function parseKeywords(raw: string) {
   const kws = raw
      .split(/[;,]/)
      .map((k) => k.trim())
      .filter(Boolean);
   return kws.length > 0 ? kws : null;
}

export function buildMappedCategories(
   fieldRecords: Record<string, string>[],
): MappedCategory[] {
   const map = new Map<string, MappedCategory>();
   for (const fields of fieldRecords) {
      const name = (fields["name"] ?? "").trim();
      if (!name) continue;
      const typeRaw = (fields["type"] ?? "").trim().toLowerCase();
      const type =
         typeRaw === "receita" || typeRaw === "income"
            ? "income"
            : typeRaw === "despesa" || typeRaw === "expense"
              ? "expense"
              : null;
      if (!map.has(name)) {
         map.set(name, {
            name,
            type,
            color: fields["color"] || null,
            icon: fields["icon"] || null,
            keywords: parseKeywords(fields["keywords"] ?? ""),
            subcategories: [],
         });
      }
      const cat = map.get(name)!;
      const subName = (fields["subcategory"] ?? "").trim();
      if (subName) {
         const sub = cat.subcategories.find((s) => s.name === subName);
         const subKw = parseKeywords(fields["subcategoryKeywords"] ?? "");
         if (sub) {
            if (subKw)
               sub.keywords = [...new Set([...(sub.keywords ?? []), ...subKw])];
         } else {
            cat.subcategories.push({ name: subName, keywords: subKw });
         }
      }
   }
   return Array.from(map.values());
}

export function buildImportPayload(rows: MappedCategory[]) {
   return rows
      .filter((c) => c.type !== null)
      .map((c) => ({
         name: c.name,
         type: c.type as "income" | "expense",
         color: c.color,
         icon: c.icon,
         keywords: c.keywords,
         subcategories: c.subcategories.map((s) => ({
            name: s.name,
            keywords: s.keywords ?? undefined,
         })),
      }));
}

export function createCategoryImportConfig(
   onBulkCreate: ImportConfig<MappedCategory>["onBulkCreate"],
   onSuccess: () => void,
   onClose: () => void,
   checkDuplicates: (rows: MappedCategory[]) => Promise<number[]>,
): ImportConfig<MappedCategory> {
   return {
      featureKey: "categories",
      columns: COLUMN_DEFS,
      template: TEMPLATE,
      mapRows: buildMappedCategories,
      isValid: (row) => row.type !== null,
      previewColumns: [
         { header: "Nome", getValue: (c) => c.name },
         {
            header: "Tipo",
            getValue: (c) =>
               c.type === "income" ? (
                  <Badge
                     variant="outline"
                     className="text-green-600 border-green-600"
                  >
                     Receita
                  </Badge>
               ) : c.type === "expense" ? (
                  <Badge variant="destructive">Despesa</Badge>
               ) : (
                  <span className="text-sm text-muted-foreground">—</span>
               ),
         },
         {
            header: "Subcategorias",
            getValue: (c) =>
               c.subcategories.length > 0 ? (
                  <Badge variant="secondary">{c.subcategories.length}</Badge>
               ) : (
                  <span className="text-sm text-muted-foreground">—</span>
               ),
         },
      ],
      onBulkCreate,
      onSuccess,
      onClose,
      dedup: {
         checkDuplicates,
      },
   };
}
