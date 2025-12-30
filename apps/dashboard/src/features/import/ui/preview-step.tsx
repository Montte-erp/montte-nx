import {
   type BatchCsvProgressEvent,
   type CsvColumnMapping,
   parseCsvBatch,
} from "@packages/csv/batch";
import { formatDecimalCurrency } from "@packages/money";
import type { TransactionType } from "@packages/ofx";
import { type BatchOfxProgressEvent, parseOfxBatch } from "@packages/ofx/batch";
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import { Checkbox } from "@packages/ui/components/checkbox";
import { Label } from "@packages/ui/components/label";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
} from "@packages/ui/components/table";
import { useMutation } from "@tanstack/react-query";
import {
   AlertTriangleIcon,
   ArrowDownIcon,
   ArrowUpIcon,
   CheckCircle2Icon,
   FileSpreadsheetIcon,
   FileTextIcon,
   Loader2Icon,
   XIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/integrations/clients";
import type {
   BatchDuplicateInfo,
   BatchParsedTransaction,
   ColumnMapping,
   CsvPreviewData,
   FileType,
   ImportedFile,
} from "../lib/use-import-wizard";
import { createBatchRowKey } from "../lib/use-import-wizard";

interface PreviewStepProps {
   bankAccountId: string;
   files: ImportedFile[];
   columnMapping: ColumnMapping | null;
   csvPreviewData: CsvPreviewData | null;
   initialParsedTransactions: BatchParsedTransaction[];
   initialSelectedRows: Set<string>; // compound keys: "fileIndex:rowIndex"
   initialDuplicates: BatchDuplicateInfo[];
   onBack: () => void;
   onComplete: (
      transactions: BatchParsedTransaction[],
      selectedRows: Set<string>,
      duplicates: BatchDuplicateInfo[],
   ) => void;
}

export function PreviewStep({
   bankAccountId,
   files,
   columnMapping,
   csvPreviewData,
   initialParsedTransactions,
   initialSelectedRows,
   initialDuplicates,
   onBack,
   onComplete,
}: PreviewStepProps) {
   const trpc = useTRPC();

   const [isLoading, setIsLoading] = useState(
      initialParsedTransactions.length === 0,
   );
   const [parseProgress, setParseProgress] = useState<string | null>(null);
   const [error, setError] = useState<string | null>(null);
   const [parsedTransactions, setParsedTransactions] = useState<
      BatchParsedTransaction[]
   >(initialParsedTransactions);
   const [selectedRows, setSelectedRows] = useState<Set<string>>(
      initialSelectedRows.size > 0
         ? initialSelectedRows
         : new Set(
              initialParsedTransactions.map((t) =>
                 createBatchRowKey(t.fileIndex, t.rowIndex),
              ),
           ),
   );
   const [duplicates, setDuplicates] =
      useState<BatchDuplicateInfo[]>(initialDuplicates);
   const [checkDuplicates, setCheckDuplicates] = useState(true);
   const [fileFilter, setFileFilter] = useState<string>("all");

   const hasLoadedRef = useRef(false);
   const hasCheckedDuplicatesRef = useRef(initialDuplicates.length > 0);

   // Check duplicates mutation
   const checkDuplicatesMutation = useMutation({
      ...trpc.bankAccounts.checkBatchDuplicates.mutationOptions(),
      onSuccess: (data) => {
         setDuplicates(data.duplicates as BatchDuplicateInfo[]);
      },
      onError: (error) => {
         console.error("Failed to check duplicates:", error);
         toast.error("Erro ao verificar duplicatas");
      },
   });

   // Get file types
   const hasCsv = files.some((f) => f.fileType === "csv");

   // Parse files when we have all required data
   useEffect(() => {
      if (hasLoadedRef.current || parsedTransactions.length > 0) return;
      if (hasCsv && (!columnMapping || !csvPreviewData)) return;

      hasLoadedRef.current = true;

      const parseFiles = async () => {
         try {
            const allTransactions: BatchParsedTransaction[] = [];

            // Parse CSV files
            const csvFiles = files.filter((f) => f.fileType === "csv");
            if (csvFiles.length > 0 && columnMapping) {
               setParseProgress(
                  `Processando ${csvFiles.length} arquivo(s) CSV...`,
               );

               const csvInputs = csvFiles.map((f) => {
                  // Decode base64 content and convert to UTF-8 string
                  const binaryString = atob(f.content);
                  const bytes = new Uint8Array(
                     binaryString.split("").map((c) => c.charCodeAt(0)),
                  );
                  const decodedContent = new TextDecoder("utf-8").decode(bytes);
                  return {
                     filename: f.filename,
                     content: decodedContent,
                  };
               });

               const onProgress = (event: BatchCsvProgressEvent) => {
                  if (event.type === "file_start") {
                     setParseProgress(`Processando ${event.filename}...`);
                  } else if (event.type === "batch_complete") {
                     setParseProgress(null);
                  }
               };

               const result = await parseCsvBatch(csvInputs, {
                  columnMapping: columnMapping as CsvColumnMapping,
                  dateFormat: "DD/MM/YYYY",
                  amountFormat: csvPreviewData?.amountFormat ?? "decimal-comma",
                  delimiter: csvPreviewData?.delimiter,
                  onProgress,
               });

               // Map to batch transactions with correct file indices
               for (const row of result.rows) {
                  const originalFile = csvFiles[row.fileIndex];
                  if (!originalFile) continue;

                  allTransactions.push({
                     rowIndex: row.rowIndex,
                     fileIndex: originalFile.fileIndex,
                     filename: originalFile.filename,
                     date: row.date,
                     amount: row.amount,
                     description: row.description,
                     type: row.type as TransactionType,
                  });
               }
            }

            // Parse OFX files
            const ofxFiles = files.filter((f) => f.fileType === "ofx");
            if (ofxFiles.length > 0) {
               setParseProgress(
                  `Processando ${ofxFiles.length} arquivo(s) OFX...`,
               );

               const ofxInputs = ofxFiles.map((f) => {
                  const decodedContent = atob(f.content);
                  const bytes = new Uint8Array(
                     decodedContent.split("").map((c) => c.charCodeAt(0)),
                  );
                  return {
                     filename: f.filename,
                     buffer: bytes,
                  };
               });

               const onProgress = (event: BatchOfxProgressEvent) => {
                  if (event.type === "file_start") {
                     setParseProgress(`Processando ${event.filename}...`);
                  } else if (event.type === "batch_complete") {
                     setParseProgress(null);
                  }
               };

               const ofxTransactions = await parseOfxBatch(ofxInputs, {
                  onProgress,
               });

               // Initialize per-file row counters
               const fileRowCounters = new Map<number, number>();

               // Map to batch transactions with correct file indices
               for (const trn of ofxTransactions) {
                  const originalFile = ofxFiles[trn.fileIndex];
                  if (!originalFile) continue;

                  // Get current row index for this file (defaults to 0)
                  const currentRowIndex =
                     fileRowCounters.get(originalFile.fileIndex) ?? 0;

                  allTransactions.push({
                     rowIndex: currentRowIndex,
                     fileIndex: originalFile.fileIndex,
                     filename: originalFile.filename,
                     date: trn.date,
                     amount: trn.amount,
                     description: trn.description,
                     type: trn.type,
                     externalId: trn.fitid,
                  });

                  // Increment counter for this file
                  fileRowCounters.set(
                     originalFile.fileIndex,
                     currentRowIndex + 1,
                  );
               }
            }

            setParsedTransactions(allTransactions);
            setSelectedRows(
               new Set(
                  allTransactions.map((t) =>
                     createBatchRowKey(t.fileIndex, t.rowIndex),
                  ),
               ),
            );
            setIsLoading(false);
         } catch (err) {
            console.error("Failed to parse files:", err);
            setError(
               err instanceof Error
                  ? err.message
                  : "Erro ao processar arquivos",
            );
            setIsLoading(false);
            toast.error("Erro ao processar arquivos");
         }
      };

      parseFiles();
   }, [
      files,
      columnMapping,
      csvPreviewData,
      parsedTransactions.length,
      hasCsv,
   ]);

   // Check duplicates after parsing
   useEffect(() => {
      if (
         hasCheckedDuplicatesRef.current ||
         parsedTransactions.length === 0 ||
         !checkDuplicates
      )
         return;
      hasCheckedDuplicatesRef.current = true;

      checkDuplicatesMutation.mutate({
         bankAccountId,
         transactions: parsedTransactions.map((t) => ({
            rowIndex: t.rowIndex,
            fileIndex: t.fileIndex,
            date: t.date.toISOString(),
            amount: t.amount,
            description: t.description,
         })),
      });
   }, [
      bankAccountId,
      parsedTransactions,
      checkDuplicates,
      checkDuplicatesMutation,
   ]);

   // Toggle duplicate checking
   const handleDuplicateToggle = useCallback(
      (checked: boolean) => {
         setCheckDuplicates(checked);
         if (
            checked &&
            duplicates.length === 0 &&
            parsedTransactions.length > 0
         ) {
            hasCheckedDuplicatesRef.current = false;
            checkDuplicatesMutation.mutate({
               bankAccountId,
               transactions: parsedTransactions.map((t) => ({
                  rowIndex: t.rowIndex,
                  fileIndex: t.fileIndex,
                  date: t.date.toISOString(),
                  amount: t.amount,
                  description: t.description,
               })),
            });
         }
      },
      [
         bankAccountId,
         parsedTransactions,
         duplicates.length,
         checkDuplicatesMutation,
      ],
   );

   const duplicatesMap = useMemo(() => {
      return new Map(
         duplicates.map((d) => [createBatchRowKey(d.fileIndex, d.rowIndex), d]),
      );
   }, [duplicates]);

   // Filtered transactions
   const filteredTransactions = useMemo(() => {
      if (fileFilter === "all") return parsedTransactions;
      const filterIndex = Number.parseInt(fileFilter, 10);
      return parsedTransactions.filter((t) => t.fileIndex === filterIndex);
   }, [parsedTransactions, fileFilter]);

   // Per-file transaction counts
   const perFileStats = useMemo(() => {
      const stats = new Map<
         number,
         { filename: string; fileType: FileType; count: number }
      >();
      for (const file of files) {
         stats.set(file.fileIndex, {
            filename: file.filename,
            fileType: file.fileType,
            count: parsedTransactions.filter(
               (t) => t.fileIndex === file.fileIndex,
            ).length,
         });
      }
      return stats;
   }, [files, parsedTransactions]);

   // Precompute file lookup map to avoid O(n) scans per row
   const filesByIndex = useMemo(() => {
      const map = new Map<number, ImportedFile>();
      for (const file of files) {
         map.set(file.fileIndex, file);
      }
      return map;
   }, [files]);

   const allSelected =
      filteredTransactions.length > 0 &&
      filteredTransactions.every((t) =>
         selectedRows.has(createBatchRowKey(t.fileIndex, t.rowIndex)),
      );
   const someSelected =
      filteredTransactions.some((t) =>
         selectedRows.has(createBatchRowKey(t.fileIndex, t.rowIndex)),
      ) && !allSelected;

   const handleSelectAll = useCallback(() => {
      if (allSelected) {
         // Deselect all in current filter
         const newSelected = new Set(selectedRows);
         for (const t of filteredTransactions) {
            newSelected.delete(createBatchRowKey(t.fileIndex, t.rowIndex));
         }
         setSelectedRows(newSelected);
      } else {
         // Select all in current filter
         const newSelected = new Set(selectedRows);
         for (const t of filteredTransactions) {
            newSelected.add(createBatchRowKey(t.fileIndex, t.rowIndex));
         }
         setSelectedRows(newSelected);
      }
   }, [allSelected, filteredTransactions, selectedRows]);

   const handleRowToggle = useCallback(
      (fileIndex: number, rowIndex: number) => {
         const key = createBatchRowKey(fileIndex, rowIndex);
         setSelectedRows((prev) => {
            const newSelected = new Set(prev);
            if (newSelected.has(key)) {
               newSelected.delete(key);
            } else {
               newSelected.add(key);
            }
            return newSelected;
         });
      },
      [],
   );

   const formatDate = (date: Date) => {
      return date.toLocaleDateString("pt-BR");
   };

   const formatAmount = (amount: number, type: TransactionType) => {
      const formatted = formatDecimalCurrency(Math.abs(amount));
      return type === "expense" ? `-${formatted}` : formatted;
   };

   const selectedCount = selectedRows.size;
   const duplicateSelectedCount = [...selectedRows].filter((key) =>
      duplicatesMap.has(key),
   ).length;

   const handleImport = () => {
      onComplete(parsedTransactions, selectedRows, duplicates);
   };

   if (isLoading) {
      return (
         <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2Icon className="size-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
               {parseProgress ?? "Processando transações..."}
            </p>
         </div>
      );
   }

   if (error) {
      return (
         <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <XIcon className="size-8 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
            <Button onClick={onBack} variant="outline">
               Voltar
            </Button>
         </div>
      );
   }

   if (parsedTransactions.length === 0) {
      return (
         <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <XIcon className="size-8 text-destructive" />
            <p className="text-sm text-destructive">
               Nenhuma transação válida encontrada nos arquivos
            </p>
            <Button onClick={onBack} variant="outline">
               Voltar
            </Button>
         </div>
      );
   }

   return (
      <div className="space-y-4">
         {/* File stats summary */}
         {files.length > 1 && (
            <div className="flex flex-wrap gap-2">
               {[...perFileStats.entries()].map(([fileIndex, stats]) => (
                  <div
                     className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-card text-sm"
                     key={`stat-${fileIndex}`}
                  >
                     {stats.fileType === "csv" ? (
                        <FileSpreadsheetIcon className="size-4 text-green-600" />
                     ) : (
                        <FileTextIcon className="size-4 text-blue-600" />
                     )}
                     <span className="truncate max-w-[150px]">
                        {stats.filename}
                     </span>
                     <Badge variant="secondary">{stats.count}</Badge>
                  </div>
               ))}
            </div>
         )}

         <div className="flex items-center justify-between">
            <div className="space-y-1">
               <p className="text-sm font-medium">
                  {selectedCount} de {parsedTransactions.length} transações
                  selecionadas
               </p>
               {duplicateSelectedCount > 0 && checkDuplicates && (
                  <p className="text-xs text-amber-600">
                     {duplicateSelectedCount} possíveis duplicatas selecionadas
                  </p>
               )}
            </div>
            <div className="flex items-center gap-4">
               {/* File filter */}
               {files.length > 1 && (
                  <Select onValueChange={setFileFilter} value={fileFilter}>
                     <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Filtrar por arquivo" />
                     </SelectTrigger>
                     <SelectContent>
                        <SelectItem value="all">Todos os arquivos</SelectItem>
                        {files.map((file) => (
                           <SelectItem
                              key={`filter-${file.fileIndex}`}
                              value={String(file.fileIndex)}
                           >
                              {file.filename}
                           </SelectItem>
                        ))}
                     </SelectContent>
                  </Select>
               )}
               <div className="flex items-center gap-2">
                  <Checkbox
                     checked={checkDuplicates}
                     id="check-duplicates"
                     onCheckedChange={handleDuplicateToggle}
                  />
                  <Label
                     className="text-sm cursor-pointer"
                     htmlFor="check-duplicates"
                  >
                     Verificar duplicatas
                  </Label>
               </div>
               {checkDuplicatesMutation.isPending && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                     <Loader2Icon className="size-4 animate-spin" />
                     Verificando...
                  </div>
               )}
            </div>
         </div>

         <div className="border rounded-lg overflow-hidden">
            <div className="max-h-[400px] overflow-y-auto">
               <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                     <TableRow>
                        <TableHead className="w-12">
                           <Checkbox
                              checked={
                                 allSelected ||
                                 (someSelected ? "indeterminate" : false)
                              }
                              onCheckedChange={handleSelectAll}
                           />
                        </TableHead>
                        {files.length > 1 && <TableHead>Arquivo</TableHead>}
                        <TableHead>Data</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        {checkDuplicates && <TableHead>Status</TableHead>}
                     </TableRow>
                  </TableHeader>
                  <TableBody>
                     {filteredTransactions.map((trn) => {
                        const key = createBatchRowKey(
                           trn.fileIndex,
                           trn.rowIndex,
                        );
                        const duplicate = duplicatesMap.get(key);
                        const isSelected = selectedRows.has(key);

                        return (
                           <TableRow
                              className={
                                 isSelected ? "" : "opacity-50 bg-muted/30"
                              }
                              key={key}
                           >
                              <TableCell>
                                 <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() =>
                                       handleRowToggle(
                                          trn.fileIndex,
                                          trn.rowIndex,
                                       )
                                    }
                                 />
                              </TableCell>
                              {files.length > 1 && (
                                 <TableCell>
                                    <div className="flex items-center gap-1.5">
                                       {filesByIndex.get(trn.fileIndex)
                                          ?.fileType === "csv" ? (
                                          <FileSpreadsheetIcon className="size-3.5 text-green-600" />
                                       ) : (
                                          <FileTextIcon className="size-3.5 text-blue-600" />
                                       )}
                                       <span className="text-xs truncate max-w-[100px]">
                                          {trn.filename}
                                       </span>
                                    </div>
                                 </TableCell>
                              )}
                              <TableCell className="whitespace-nowrap">
                                 {formatDate(trn.date)}
                              </TableCell>
                              <TableCell className="max-w-[200px] truncate">
                                 {trn.description}
                              </TableCell>
                              <TableCell className="text-right whitespace-nowrap">
                                 <span
                                    className={
                                       trn.type === "income"
                                          ? "text-green-600"
                                          : trn.type === "expense"
                                            ? "text-red-600"
                                            : "text-muted-foreground"
                                    }
                                 >
                                    <span className="inline-flex items-center gap-1">
                                       {trn.type === "income" && (
                                          <ArrowUpIcon className="size-3" />
                                       )}
                                       {trn.type === "expense" && (
                                          <ArrowDownIcon className="size-3" />
                                       )}
                                       {formatAmount(trn.amount, trn.type)}
                                    </span>
                                 </span>
                              </TableCell>
                              {checkDuplicates && (
                                 <TableCell>
                                    {duplicate ? (
                                       <Badge
                                          className="bg-amber-500/10 text-amber-600 border-amber-500/20 gap-1"
                                          variant="outline"
                                       >
                                          <AlertTriangleIcon className="size-3" />
                                          {duplicate.duplicateType ===
                                          "within_batch"
                                             ? "Duplicata lote"
                                             : "Duplicata"}
                                          {duplicate.matchScore > 0 && (
                                             <span className="ml-1 text-xs">
                                                {Math.round(
                                                   duplicate.matchScore * 100,
                                                )}
                                                %
                                             </span>
                                          )}
                                       </Badge>
                                    ) : (
                                       <Badge
                                          className="bg-green-500/10 text-green-600 border-green-500/20 gap-1"
                                          variant="outline"
                                       >
                                          <CheckCircle2Icon className="size-3" />
                                          Nova
                                       </Badge>
                                    )}
                                 </TableCell>
                              )}
                           </TableRow>
                        );
                     })}
                  </TableBody>
               </Table>
            </div>
         </div>

         <div className="flex items-center justify-between pt-4">
            <Button onClick={onBack} variant="ghost">
               Voltar
            </Button>
            <div className="flex items-center gap-3">
               <span className="text-sm text-muted-foreground">
                  {selectedCount} transação(ões) serão importadas
               </span>
               <Button disabled={selectedCount === 0} onClick={handleImport}>
                  Importar selecionadas
               </Button>
            </div>
         </div>
      </div>
   );
}
