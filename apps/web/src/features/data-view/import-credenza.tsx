import {
   CredenzaBody,
   CredenzaDescription,
   CredenzaFooter,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import {
   Dropzone,
   DropzoneContent,
   DropzoneEmptyState,
} from "@packages/ui/components/dropzone";
import { Combobox } from "@packages/ui/components/combobox";
import {
   Popover,
   PopoverContent,
   PopoverTrigger,
} from "@packages/ui/components/popover";
import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
} from "@packages/ui/components/table";
import { defineStepper } from "@packages/ui/components/stepper";
import { Button } from "@packages/ui/components/button";
import {
   AlertTriangle,
   ChevronRight,
   FileSpreadsheet,
   FileText,
   Loader2,
} from "lucide-react";
import { cn } from "@packages/ui/lib/utils";
import { useTransition, useState, useRef, useCallback, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { toast } from "sonner";
import { useCsvFile } from "@/hooks/use-csv-file";
import { useFileDownload } from "@/hooks/use-file-download";
import { useXlsxFile } from "@/hooks/use-xlsx-file";
import type {
   ImportConfig,
   ImportableColumn,
   ParsedRow,
} from "@/features/data-view/data-table";
import { format, of } from "@f-o-t/money";
import { MoneyInput } from "@packages/ui/components/money-input";
import {
   Announcement,
   AnnouncementTag,
   AnnouncementTitle,
} from "@/components/blocks/announcement";

const { Stepper, useStepper } = defineStepper(
   { id: "upload", title: "Arquivo" },
   { id: "mapping", title: "Colunas" },
   { id: "confirm", title: "Importar" },
);

type ImportStepperMethods = ReturnType<typeof useStepper>;
type RawData = { headers: string[]; rows: string[][] };
type ColumnMapping = Record<string, string>;

// =============================================================================
// guessMapping
// =============================================================================

function guessMapping(
   headers: string[],
   columns: ImportableColumn[],
): ColumnMapping {
   const mapping: ColumnMapping = {};
   const lower = headers.map((h) => h.toLowerCase().trim());
   for (const col of columns) {
      const patterns = [
         col.key.toLowerCase(),
         col.label.toLowerCase(),
         ...col.fieldPatterns.map((p) => p.toLowerCase()),
      ];
      let idx = lower.findIndex((h) => patterns.includes(h));
      if (idx === -1)
         idx = lower.findIndex((h) => patterns.some((p) => h.includes(p)));
      if (idx !== -1) mapping[col.key] = headers[idx] ?? "";
   }
   return mapping;
}

// =============================================================================
// Step metadata
// =============================================================================

const STEP_META: Record<
   string,
   { title: (label: string) => string; description: string }
> = {
   upload: {
      title: (label) => `Importar ${label}`,
      description: "Selecione um arquivo CSV ou XLSX para importar.",
   },
   mapping: {
      title: () => "Mapear Colunas",
      description:
         "Associe cada coluna do arquivo ao campo correspondente. Os dados são exibidos abaixo para referência.",
   },
   confirm: {
      title: () => "Confirmar Importação",
      description: "Revise o resumo e confirme a importação.",
   },
};

// =============================================================================
// UploadBody
// =============================================================================

function UploadBody({
   methods,
   onReady,
}: {
   methods: ImportStepperMethods;
   onReady: (raw: RawData) => void;
}) {
   const [isParsing, setIsParsing] = useState(false);
   const [selectedFile, setSelectedFile] = useState<File | undefined>();
   const { parse: parseCsv } = useCsvFile();
   const { parse: parseXlsx } = useXlsxFile();

   async function processFile(file: File) {
      setSelectedFile(file);
      setIsParsing(true);
      try {
         const ext = file.name.split(".").pop()?.toLowerCase();
         const data =
            ext === "xlsx" || ext === "xls"
               ? await parseXlsx(file)
               : await parseCsv(file);
         onReady(data);
         methods.navigation.next();
      } catch {
         toast.error("Erro ao processar o arquivo. Verifique o formato.");
         setSelectedFile(undefined);
      } finally {
         setIsParsing(false);
      }
   }

   return (
      <Dropzone
         accept={{
            "text/csv": [".csv"],
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
               [".xlsx"],
         }}
         disabled={isParsing}
         maxFiles={1}
         onDrop={([file]) => {
            if (file) processFile(file);
         }}
         src={selectedFile ? [selectedFile] : undefined}
      >
         <DropzoneEmptyState>
            {isParsing ? (
               <Loader2 className="size-8 text-primary animate-spin" />
            ) : (
               <div className="flex flex-col gap-2 items-center">
                  <FileSpreadsheet className="size-8 text-muted-foreground" />
                  <p className="font-medium text-sm">
                     Arraste e solte ou clique para selecionar
                  </p>
                  <p className="text-xs text-muted-foreground">
                     Suporta arquivos <strong>.CSV</strong> e{" "}
                     <strong>.XLSX</strong>
                  </p>
                  <div className="flex items-center gap-2">
                     <div className="flex items-center gap-2 rounded-md border bg-background px-2.5 py-1">
                        <FileSpreadsheet className="size-3.5 text-emerald-600" />
                        <span className="text-xs font-medium">CSV</span>
                     </div>
                     <div className="flex items-center gap-2 rounded-md border bg-background px-2.5 py-1">
                        <FileText className="size-3.5 text-blue-600" />
                        <span className="text-xs font-medium">XLSX</span>
                     </div>
                  </div>
               </div>
            )}
         </DropzoneEmptyState>
         <DropzoneContent />
      </Dropzone>
   );
}

function UploadFooter({
   config,
   columns,
}: {
   config: ImportConfig;
   columns: ImportableColumn[];
}) {
   const { generate: generateCsv } = useCsvFile();
   const { generate: generateXlsx } = useXlsxFile();
   const { download } = useFileDownload();

   const templateSlug = config.label.toLowerCase().replace(/\s+/g, "-");

   function handleTemplateCsv() {
      const headers = columns.map((c) => c.key);
      const exampleRow = Object.fromEntries(columns.map((c) => [c.key, ""]));
      download(
         generateCsv([exampleRow], headers),
         `modelo-${templateSlug}.csv`,
      );
   }

   function handleTemplateXlsx() {
      const headers = columns.map((c) => c.key);
      const exampleRow = Object.fromEntries(columns.map((c) => [c.key, ""]));
      download(
         generateXlsx([exampleRow], headers),
         `modelo-${templateSlug}.xlsx`,
      );
   }

   return (
      <Popover>
         <PopoverTrigger asChild>
            <Button size="sm" type="button" variant="ghost">
               <FileSpreadsheet className="size-4" />
               Baixar modelo
            </Button>
         </PopoverTrigger>
         <PopoverContent align="start" className="w-40 p-1">
            <button
               className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
               onClick={handleTemplateCsv}
               type="button"
            >
               <FileSpreadsheet className="size-4 text-emerald-600" />
               CSV
            </button>
            <button
               className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
               onClick={handleTemplateXlsx}
               type="button"
            >
               <FileText className="size-4 text-blue-600" />
               XLSX
            </button>
         </PopoverContent>
      </Popover>
   );
}

// =============================================================================
// CellDisplay
// =============================================================================

function CellDisplay({ col, value }: { col: ImportableColumn; value: string }) {
   if (!value) {
      return <span className="text-xs text-muted-foreground">—</span>;
   }

   if (col.editType === "money") {
      return (
         <span className="text-xs">{format(of(value, "BRL"), "pt-BR")}</span>
      );
   }

   if (col.editType === "combobox") {
      const match = col.editOptions?.find((o) => o.value === value);
      if (match) {
         return (
            <Announcement className="cursor-pointer">
               <AnnouncementTag>{match.label.charAt(0)}</AnnouncementTag>
               <AnnouncementTitle className="text-xs">
                  {match.label}
               </AnnouncementTitle>
            </Announcement>
         );
      }
      return <span className="text-xs text-muted-foreground">{value}</span>;
   }

   return <span className="text-xs">{value}</span>;
}

function MoneyEditCell({
   value,
   onChange,
   onDeactivate,
}: {
   value: string;
   onChange: (v: string) => void;
   onDeactivate: () => void;
}) {
   const [draft, setDraft] = useState(
      value ? Number.parseFloat(value) : undefined,
   );

   return (
      <MoneyInput
         autoFocus
         className="rounded-none border-0 shadow-none"
         onChange={setDraft}
         onBlur={() => {
            onChange(draft != null ? String(draft) : "0");
            onDeactivate();
         }}
         onKeyDown={(e) => {
            if (e.key === "Escape") onDeactivate();
         }}
         value={draft}
         valueInCents={false}
      />
   );
}

// =============================================================================
// EditCell
// =============================================================================

export function EditCell({
   col,
   isEditing,
   value,
   onActivate,
   onChange,
   onDeactivate,
}: {
   col: ImportableColumn;
   isEditing: boolean;
   value: string;
   onActivate: () => void;
   onChange: (v: string) => void;
   onDeactivate: () => void;
}) {
   if (!isEditing) {
      return (
         <div
            className="px-2 py-1 min-h-8 flex items-center cursor-pointer hover:bg-muted/50 rounded"
            onClick={onActivate}
         >
            <CellDisplay col={col} value={value} />
         </div>
      );
   }

   if (col.editType === "money") {
      return (
         <MoneyEditCell
            value={value}
            onChange={onChange}
            onDeactivate={onDeactivate}
         />
      );
   }

   if (col.editType === "combobox") {
      return (
         <Combobox
            className="h-8 w-full justify-start rounded-none border-0 bg-transparent px-2 text-xs shadow-none"
            emptyMessage="Nenhuma opção"
            onValueChange={(v) => {
               onChange(v);
               onDeactivate();
            }}
            options={col.editOptions ?? []}
            placeholder="Selecionar..."
            searchPlaceholder="Buscar..."
            value={value}
         />
      );
   }

   return (
      <input
         autoFocus
         className="w-full px-2 py-1 text-xs bg-transparent border-0 outline-none ring-1 ring-primary/50 rounded"
         defaultValue={value}
         onBlur={(e) => {
            onChange(e.target.value);
            onDeactivate();
         }}
         onKeyDown={(e) => {
            if (e.key === "Enter") {
               onChange(e.currentTarget.value);
               onDeactivate();
            }
            if (e.key === "Escape") onDeactivate();
         }}
      />
   );
}

// =============================================================================
// MappingBody
// =============================================================================

function MappingBody({
   raw,
   columns,
   mapping,
   onMappingChange,
   onRowsChange,
}: {
   raw: RawData;
   columns: ImportableColumn[];
   mapping: ColumnMapping;
   onMappingChange: (m: ColumnMapping) => void;
   onRowsChange: (rows: ParsedRow[]) => void;
}) {
   const [editRows, setEditRows] = useState<ParsedRow[]>(() =>
      raw.rows.map((row) =>
         Object.fromEntries(
            columns.map((col) => {
               const header = mapping[col.key];
               const idx = header ? raw.headers.indexOf(header) : -1;
               return [col.key, idx >= 0 ? (row[idx] ?? "") : ""];
            }),
         ),
      ),
   );

   useEffect(() => {
      onRowsChange(editRows);
      // oxlint-ignore react-hooks/exhaustive-deps
   }, []);

   const [editingCell, setEditingCell] = useState<{
      rowIdx: number;
      colKey: string;
   } | null>(null);

   const parentRef = useRef<HTMLDivElement>(null);

   const rowVirtualizer = useVirtualizer({
      count: editRows.length,
      getScrollElement: () => parentRef.current,
      estimateSize: () => 36,
      overscan: 10,
   });

   const handleCellChange = useCallback(
      (rowIdx: number, colKey: string, value: string) => {
         setEditRows((prev) => {
            const next = [...prev];
            next[rowIdx] = { ...next[rowIdx], [colKey]: value };
            onRowsChange(next);
            return next;
         });
      },
      [onRowsChange],
   );

   function getDestKeyForSource(sourceHeader: string): string {
      return (
         Object.entries(mapping).find(([, src]) => src === sourceHeader)?.[0] ??
         "__none__"
      );
   }

   function handleMappingSelect(sourceHeader: string, destKey: string) {
      const next = { ...mapping };
      for (const key of Object.keys(next)) {
         if (next[key] === sourceHeader) next[key] = "";
      }
      if (destKey !== "__none__") next[destKey] = sourceHeader;
      onMappingChange(next);
   }

   const destOptions = [
      { value: "__none__", label: "— Ignorar coluna —" },
      ...columns.map((c) => ({
         value: c.key,
         label: c.required ? `${c.label} *` : c.label,
      })),
   ];

   const virtualItems = rowVirtualizer.getVirtualItems();

   return (
      <div className="overflow-auto rounded-md border">
         <Table className="border-separate border-spacing-0">
            <TableHeader>
               <TableRow className="bg-muted/50 hover:bg-muted/50">
                  {raw.headers.map((header) => {
                     const destKey = getDestKeyForSource(header);
                     return (
                        <TableHead className="p-0 min-w-[160px]" key={header}>
                           <Combobox
                              className="h-10 w-full justify-start rounded-none border-0 bg-transparent px-2 text-xs font-medium shadow-none"
                              emptyMessage="Nenhum campo"
                              onValueChange={(v) =>
                                 handleMappingSelect(header, v)
                              }
                              options={destOptions}
                              placeholder={header}
                              renderSelected={() => (
                                 <span className="truncate">{header}</span>
                              )}
                              searchPlaceholder="Buscar campo..."
                              value={destKey}
                           />
                        </TableHead>
                     );
                  })}
               </TableRow>
            </TableHeader>
         </Table>
         <div
            ref={parentRef}
            className="overflow-auto"
            style={{ maxHeight: "360px" }}
         >
            <div
               style={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                  position: "relative",
               }}
            >
               {virtualItems.map((virtualRow) => {
                  const rowIdx = virtualRow.index;
                  const parsedRow = editRows[rowIdx];
                  return (
                     <div
                        key={virtualRow.key}
                        style={{
                           position: "absolute",
                           top: 0,
                           left: 0,
                           width: "100%",
                           height: `${virtualRow.size}px`,
                           transform: `translateY(${virtualRow.start}px)`,
                        }}
                     >
                        <Table className="border-separate border-spacing-0">
                           <TableBody>
                              <TableRow
                                 className={
                                    rowIdx % 2 === 0 ? "" : "bg-muted/20"
                                 }
                              >
                                 {columns.map((col) => {
                                    const isEditing =
                                       editingCell?.rowIdx === rowIdx &&
                                       editingCell?.colKey === col.key;
                                    const value = parsedRow?.[col.key] ?? "";
                                    return (
                                       <TableCell
                                          className="p-0 min-w-[160px]"
                                          key={col.key}
                                       >
                                          <EditCell
                                             col={col}
                                             isEditing={isEditing}
                                             onActivate={() =>
                                                setEditingCell({
                                                   rowIdx,
                                                   colKey: col.key,
                                                })
                                             }
                                             onChange={(v) =>
                                                handleCellChange(
                                                   rowIdx,
                                                   col.key,
                                                   v,
                                                )
                                             }
                                             onDeactivate={() =>
                                                setEditingCell(null)
                                             }
                                             value={value}
                                          />
                                       </TableCell>
                                    );
                                 })}
                              </TableRow>
                           </TableBody>
                        </Table>
                     </div>
                  );
               })}
            </div>
         </div>
      </div>
   );
}

function MappingFooter({
   methods,
   columns,
   mapping,
   rows,
   onApply,
}: {
   methods: ImportStepperMethods;
   columns: ImportableColumn[];
   mapping: ColumnMapping;
   rows: ParsedRow[];
   onApply: (rows: ParsedRow[]) => void;
}) {
   const canProceed = columns
      .filter((c) => c.required)
      .every((c) => !!mapping[c.key]);

   function handleContinue() {
      onApply(rows);
      methods.navigation.next();
   }

   return (
      <div className="flex gap-2 w-full">
         <Button
            className="flex-none"
            onClick={() => methods.navigation.prev()}
            type="button"
            variant="outline"
         >
            Voltar
         </Button>
         <Button
            className="flex-1"
            disabled={!canProceed}
            onClick={handleContinue}
            type="button"
         >
            Continuar
            <ChevronRight className="size-4" />
         </Button>
      </div>
   );
}

// =============================================================================
// ConfirmBody
// =============================================================================

function ConfirmBody({ rows }: { rows: ParsedRow[] }) {
   return (
      <div className="flex flex-col gap-4">
         <div className="rounded-xl border overflow-hidden">
            <div className="bg-muted/40 px-4 py-2.5 border-b">
               <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Resumo
               </p>
            </div>
            <div className="divide-y">
               <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-sm text-muted-foreground">
                     Total no arquivo
                  </span>
                  <span className="text-sm font-medium">{rows.length}</span>
               </div>
               <div className="flex items-center justify-between bg-primary/5 px-4 py-2.5">
                  <span className="text-sm font-medium">Serão importados</span>
                  <span className="text-sm font-bold text-primary">
                     {rows.length}
                  </span>
               </div>
            </div>
         </div>
         {rows.length === 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
               <AlertTriangle className="size-4 shrink-0 text-amber-600" />
               <p className="text-xs text-amber-700">
                  Não há dados para importar.
               </p>
            </div>
         )}
      </div>
   );
}

function ConfirmFooter({
   rows,
   config,
   onClose,
}: {
   rows: ParsedRow[];
   config: ImportConfig;
   onClose: () => void;
}) {
   const [isPending, startTransition] = useTransition();

   function handleImport() {
      startTransition(async () => {
         try {
            const result = await config.onImport(rows);
            toast.success(
               `${result.imported} item(s) importado(s) com sucesso.`,
            );
            onClose();
         } catch (e) {
            toast.error(
               e instanceof Error
                  ? e.message
                  : "Erro ao importar. Tente novamente.",
            );
         }
      });
   }

   return (
      <div className="flex gap-2 w-full">
         <Button
            className="flex-none"
            disabled={isPending}
            onClick={onClose}
            type="button"
            variant="outline"
         >
            Cancelar
         </Button>
         <Button
            className="flex-1"
            disabled={isPending || rows.length === 0}
            onClick={handleImport}
            type="button"
         >
            {isPending && <Loader2 className="size-4 animate-spin" />}
            Importar {rows.length} item(s)
         </Button>
      </div>
   );
}

// =============================================================================
// ImportWizard — owns Credenza structure
// =============================================================================

function ImportWizard({
   methods,
   columns,
   config,
   onClose,
}: {
   methods: ImportStepperMethods;
   columns: ImportableColumn[];
   config: ImportConfig;
   onClose: () => void;
}) {
   const currentId = methods.state.current.data.id;
   const [rawData, setRawData] = useState<RawData | null>(null);
   const [mapping, setMapping] = useState<ColumnMapping>(() =>
      Object.fromEntries(columns.map((c) => [c.key, ""])),
   );
   const [rows, setRows] = useState<ParsedRow[]>([]);
   const [editedRows, setEditedRows] = useState<ParsedRow[]>([]);

   const stepMeta = STEP_META[currentId];
   const stepTitle = stepMeta?.title(config.label) ?? currentId;
   const stepDescription = stepMeta?.description ?? "";

   function handleReady(data: RawData) {
      setRawData(data);
      setMapping((prev) => ({
         ...prev,
         ...guessMapping(data.headers, columns),
      }));
   }

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>{stepTitle}</CredenzaTitle>
            <CredenzaDescription>{stepDescription}</CredenzaDescription>
         </CredenzaHeader>

         <CredenzaBody>
            <div className="flex flex-col gap-4">
               <Stepper.Navigation>
                  <Stepper.Step of="upload" />
                  <Stepper.Step of="mapping" />
                  <Stepper.Step of="confirm" />
               </Stepper.Navigation>
               {currentId === "upload" && (
                  <UploadBody methods={methods} onReady={handleReady} />
               )}
               {currentId === "mapping" && rawData && (
                  <MappingBody
                     columns={columns}
                     mapping={mapping}
                     onMappingChange={setMapping}
                     onRowsChange={setEditedRows}
                     raw={rawData}
                  />
               )}
               {currentId === "confirm" && <ConfirmBody rows={rows} />}
            </div>
         </CredenzaBody>

         <CredenzaFooter className="justify-start">
            {currentId === "upload" && (
               <UploadFooter columns={columns} config={config} />
            )}
            {currentId === "mapping" && rawData && (
               <MappingFooter
                  columns={columns}
                  mapping={mapping}
                  methods={methods}
                  onApply={setRows}
                  rows={editedRows}
               />
            )}
            {currentId === "confirm" && (
               <ConfirmFooter config={config} onClose={onClose} rows={rows} />
            )}
         </CredenzaFooter>
      </>
   );
}

// =============================================================================
// ImportCredenza (public export)
// =============================================================================

export function ImportCredenza({
   columns,
   config,
   onClose,
}: {
   columns: ImportableColumn[];
   config: ImportConfig;
   onClose: () => void;
}) {
   return (
      <Stepper.Provider variant="line">
         {({ methods }) => (
            <ImportWizard
               columns={columns}
               config={config}
               methods={methods}
               onClose={onClose}
            />
         )}
      </Stepper.Provider>
   );
}
