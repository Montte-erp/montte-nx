interface ExportableCategory {
   name: string;
   type: string | null;
   color: string | null;
   icon: string | null;
   keywords: string[] | null;
   subcategories: {
      name: string;
      keywords: string[] | null;
   }[];
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
   const headers = [
      "Nome",
      "Tipo",
      "Cor",
      "Ícone",
      "Palavras-chave",
      "Subcategoria",
      "Palavras-chave (Subcategoria)",
   ];

   const rows: string[][] = [];
   for (const cat of categories) {
      if (cat.subcategories.length === 0) {
         rows.push([
            cat.name,
            cat.type === "income"
               ? "Receita"
               : cat.type === "expense"
                 ? "Despesa"
                 : "",
            cat.color ?? "",
            cat.icon ?? "",
            cat.keywords?.join("; ") ?? "",
            "",
            "",
         ]);
      } else {
         for (const sub of cat.subcategories) {
            rows.push([
               cat.name,
               cat.type === "income"
                  ? "Receita"
                  : cat.type === "expense"
                    ? "Despesa"
                    : "",
               cat.color ?? "",
               cat.icon ?? "",
               cat.keywords?.join("; ") ?? "",
               sub.name,
               sub.keywords?.join("; ") ?? "",
            ]);
         }
      }
   }

   const csv = [
      headers.map(escapeCsvField).join(","),
      ...rows.map((row) => row.map(escapeCsvField).join(",")),
   ].join("\n");

   const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
   triggerDownload(blob, "categorias.csv");
}
