import { toPng } from "html-to-image";

/**
 * Export data as CSV and trigger download
 */
export function exportToCsv(
   data: Array<Record<string, unknown>>,
   filename: string,
): void {
   if (data.length === 0) {
      return;
   }

   const firstRow = data[0];
   if (!firstRow) {
      return;
   }

   // Get headers from first row
   const headers = Object.keys(firstRow);

   // Build CSV content
   const csvContent = [
      // Header row
      headers.join(","),
      // Data rows
      ...data.map((row) =>
         headers
            .map((header) => {
               const value = row[header];
               // Escape quotes and wrap in quotes if contains comma, quote, or newline
               if (value === null || value === undefined) {
                  return "";
               }
               const stringValue = String(value);
               if (
                  stringValue.includes(",") ||
                  stringValue.includes('"') ||
                  stringValue.includes("\n")
               ) {
                  return `"${stringValue.replace(/"/g, '""')}"`;
               }
               return stringValue;
            })
            .join(","),
      ),
   ].join("\n");

   // Create blob and download
   const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
   const url = URL.createObjectURL(blob);
   const link = document.createElement("a");
   link.setAttribute("href", url);
   link.setAttribute("download", `${filename}.csv`);
   link.style.visibility = "hidden";
   document.body.appendChild(link);
   link.click();
   document.body.removeChild(link);
   URL.revokeObjectURL(url);
}

/**
 * Export HTML element as PNG image
 */
export async function exportToImage(
   element: HTMLElement,
   filename: string,
): Promise<void> {
   try {
      const dataUrl = await toPng(element, {
         quality: 1,
         pixelRatio: 2,
         backgroundColor: "white",
      });

      const link = document.createElement("a");
      link.download = `${filename}.png`;
      link.href = dataUrl;
      link.click();
   } catch (error) {
      console.error("Failed to export image:", error);
      throw new Error("Failed to export as image");
   }
}

/**
 * Format insight data for CSV export
 */
export function formatInsightDataForCsv(
   data: {
      value?: number;
      breakdown?: Array<{ label: string; value: number }>;
      timeSeries?: Array<{ date: string; value: number }>;
      tableData?: Array<Record<string, unknown>>;
   },
   insightName: string,
): Array<Record<string, unknown>> {
   // If there's table data, use it directly
   if (data.tableData && data.tableData.length > 0) {
      return data.tableData;
   }

   // If there's time series data
   if (data.timeSeries && data.timeSeries.length > 0) {
      return data.timeSeries.map((item) => ({
         Date: item.date,
         Value: item.value,
      }));
   }

   // If there's breakdown data
   if (data.breakdown && data.breakdown.length > 0) {
      return data.breakdown.map((item) => ({
         Label: item.label,
         Value: item.value,
      }));
   }

   // Single value
   return [{ Insight: insightName, Value: data.value }];
}
