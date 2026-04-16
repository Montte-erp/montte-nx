interface ExportableCategory {
   id: string;
   name: string;
   type: string | null;
   color: string | null;
   icon: string | null;
   keywords: string[] | null;
   parentId: string | null;
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
      "Palavras-chave-Sub",
   ];

   const parents = categories.filter((c) => c.parentId === null);
   const rows: string[][] = [];

   for (const parent of parents) {
      const subs = categories.filter((c) => c.parentId === parent.id);
      const typeLabel =
         parent.type === "income"
            ? "Receita"
            : parent.type === "expense"
              ? "Despesa"
              : "";

      if (subs.length === 0) {
         rows.push([
            parent.name,
            typeLabel,
            parent.color ?? "",
            parent.icon ?? "",
            parent.keywords?.join("; ") ?? "",
            "",
            "",
         ]);
      } else {
         for (const sub of subs) {
            rows.push([
               parent.name,
               typeLabel,
               parent.color ?? "",
               parent.icon ?? "",
               parent.keywords?.join("; ") ?? "",
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
