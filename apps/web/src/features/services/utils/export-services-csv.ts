// ---------------------------------------------------------------------------
// Export services to CSV
// ---------------------------------------------------------------------------

import { format, of } from "@f-o-t/money";

type ExportableService = {
   name: string;
   description: string | null;
   basePrice: number; // cents
   type: string;
   categoryName: string | null;
   tagName: string | null;
};

function escapeCsvField(value: string): string {
   if (value.includes(",") || value.includes('"') || value.includes("\n")) {
      return `"${value.replace(/"/g, '""')}"`;
   }
   return value;
}

export function exportServicesCsv(services: ExportableService[]): void {
   const headers = [
      "Nome",
      "Descrição",
      "Preço padrão",
      "Tipo",
      "Categoria",
      "Tag",
   ];

   const rows = services.map((s) => [
      s.name,
      s.description ?? "",
      format(of(String(s.basePrice), "BRL"), "pt-BR"),
      s.type,
      s.categoryName ?? "",
      s.tagName ?? "",
   ]);

   const csv = [
      headers.map(escapeCsvField).join(","),
      ...rows.map((row) => row.map(escapeCsvField).join(",")),
   ].join("\n");

   const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
   const url = URL.createObjectURL(blob);
   const a = document.createElement("a");
   a.href = url;
   a.download = "servicos.csv";
   a.click();
   URL.revokeObjectURL(url);
}
