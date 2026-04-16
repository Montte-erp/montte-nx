export interface ExportableCategory {
   id: string;
   name: string;
   type: string | null;
   color: string | null;
   icon: string | null;
   keywords: string[] | null;
   parentId: string | null;
}

export const EXPORT_HEADERS = [
   "Nome",
   "Tipo",
   "Cor",
   "Ícone",
   "Palavras-chave",
   "Subcategoria",
   "Palavras-chave-Sub",
] as const;

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

function escapeCsvField(value: string): string {
   if (value.includes(",") || value.includes('"') || value.includes("\n")) {
      return `"${value.replace(/"/g, '""')}"`;
   }
   return value;
}

function triggerDownload(blob: Blob, filename: string): void {
   const url = URL.createObjectURL(blob);
   const a = document.createElement("a");
   a.href = url;
   a.download = filename;
   a.click();
   URL.revokeObjectURL(url);
}

export function exportCategoriesCsv(categories: ExportableCategory[]): void {
   const rows = buildExportRows(categories);
   const csv = [
      EXPORT_HEADERS.map(escapeCsvField).join(","),
      ...rows.map((row) =>
         EXPORT_HEADERS.map((h) => escapeCsvField(row[h] ?? "")).join(","),
      ),
   ].join("\n");

   const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8;" });
   triggerDownload(blob, "categorias.csv");
}
