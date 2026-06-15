import { useForm } from "@tanstack/react-form";
import { createCollection, ilike, or, useLiveQuery } from "@tanstack/react-db";
import {
   getCoreRowModel,
   useReactTable,
   type ColumnDef,
   type ColumnFiltersState,
   type SortingState,
} from "@tanstack/react-table";
import { createFileRoute } from "@tanstack/react-router";
import { useUploadFiles } from "@better-upload/client";
import { format, of } from "@f-o-t/money";
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import { Checkbox } from "@packages/ui/components/checkbox";
import {
   ContextPanel,
   ContextPanelContent,
   ContextPanelHeader,
   ContextPanelTitle,
} from "@packages/ui/components/context-panel";
import {
   Empty,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import { Field, FieldError, FieldLabel } from "@packages/ui/components/field";
import { Input } from "@packages/ui/components/input";
import { ScrollArea } from "@packages/ui/components/scroll-area";
import { SearchInput } from "@packages/ui/components/search-input";
import {
   SheetDescription,
   SheetFooter,
   SheetHeader,
   SheetTitle,
} from "@packages/ui/components/sheet";
import { Table } from "@packages/ui/components/table";
import { UploadDropzone } from "@packages/ui/components/upload-dropzone";
import { UploadProgress } from "@packages/ui/components/upload-progress";
import { toast } from "@packages/ui/hooks/use-toast";
import dayjs from "dayjs";
import { Archive, ExternalLink, Plus, ReceiptText } from "lucide-react";
import { useMemo } from "react";
import { z } from "zod";
import { DataTableBody } from "@/blocks/data-table/data-table-body";
import { DataTableColumnVisibility } from "@/blocks/data-table/data-table-column-visibility";
import { DataTableFilterChips } from "@/blocks/data-table/data-table-filter-chips";
import { DataTableHeader } from "@/blocks/data-table/data-table-header";
import { DataTablePagination } from "@/blocks/data-table/data-table-pagination";
import { DataTableSkeleton } from "@/blocks/data-table/data-table-skeleton";
import { useDataTableLayout } from "@/blocks/data-table/use-data-table-layout";
import { useDebouncedSearch } from "@/blocks/data-table/use-debounced-search";
import { useTableUrlState } from "@/blocks/data-table/use-table-url-state";
import { useSheet } from "@/hooks/use-sheet";
import {
   SelectionActionButton,
   useTableBulkActions,
} from "@/hooks/use-selection-toolbar";
import {
   bulkArchiveNfeAction,
   createNfeAction,
   nfeCollectionOptions,
   type NfeRow,
} from "@/integrations/tanstack-db/fiscal";
import { useContextPanelInfo } from "../-context-panel/use-context-panel";
import { DefaultHeader } from "../-layout/default-header";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/nfe",
)({
   validateSearch: z.object({
      sorting: z
         .array(z.object({ id: z.string(), desc: z.boolean() }))
         .catch([])
         .default([]),
      columnFilters: z
         .array(z.object({ id: z.string(), value: z.unknown() }))
         .catch([])
         .default([]),
      page: z.number().int().min(1).catch(1).default(1),
      pageSize: z.number().int().min(1).max(100).catch(20).default(20),
      search: z.string().catch("").default(""),
   }),
   pendingMs: 300,
   pendingComponent: NfeSkeleton,
   head: () => ({ meta: [{ title: "NF-e — Montte" }] }),
   component: NfePage,
});

const createNfeSchema = z.object({
   accessKey: z.string().trim().min(1, "Chave obrigatória"),
   number: z.string().trim().min(1, "Número obrigatório"),
   series: z.string().trim().min(1, "Série obrigatória"),
   issuerName: z.string().trim().min(1, "Emitente obrigatório"),
   recipientName: z.string().trim(),
   totalAmount: z.string().trim(),
   issuedAt: z.string().trim(),
   fileKey: z.string().trim(),
   originalFileName: z.string().trim(),
   mimeType: z.string().trim(),
   fileSize: z.number().int().nonnegative(),
});

const nfeSortIdSchema = z.enum([
   "accessKey",
   "issuerName",
   "issuedAt",
   "number",
   "recipientName",
   "series",
   "status",
   "totalAmountCents",
   "updatedAt",
]);

const skeletonColumns = buildNfeColumns();

function getMetadataString(metadata: unknown, key: string) {
   if (typeof metadata !== "object" || metadata === null) return undefined;
   for (const [entryKey, value] of Object.entries(metadata)) {
      if (entryKey === key && typeof value === "string") return value;
   }
   return undefined;
}

function parseMoneyToCents(value: string) {
   const normalized = value.replace(/\./g, "").replace(",", ".").trim();
   const amount = Number(normalized || "0");
   if (!Number.isFinite(amount)) return 0;
   return Math.round(amount * 100);
}

function formatMoneyFromCents(value: number) {
   return format(of(String(value / 100), "BRL"), "pt-BR");
}

function normalizeNfeSorting(sorting: SortingState) {
   const normalized: Array<{
      id: z.infer<typeof nfeSortIdSchema>;
      desc: boolean;
   }> = [];
   for (const rule of sorting) {
      const result = nfeSortIdSchema.safeParse(rule.id);
      if (!result.success) continue;
      normalized.push({ id: result.data, desc: rule.desc });
   }
   return normalized;
}

function compareNfeValues(
   left: NfeRow,
   right: NfeRow,
   sortId: z.infer<typeof nfeSortIdSchema>,
) {
   switch (sortId) {
      case "accessKey":
         return left.accessKey.localeCompare(right.accessKey, "pt-BR");
      case "issuerName":
         return left.issuerName.localeCompare(right.issuerName, "pt-BR");
      case "issuedAt":
         return (
            dayjs(left.issuedAt).valueOf() - dayjs(right.issuedAt).valueOf()
         );
      case "number":
         return left.number.localeCompare(right.number, "pt-BR");
      case "recipientName":
         return String(left.recipientName ?? "").localeCompare(
            String(right.recipientName ?? ""),
            "pt-BR",
         );
      case "series":
         return left.series.localeCompare(right.series, "pt-BR");
      case "status":
         return left.status.localeCompare(right.status, "pt-BR");
      case "totalAmountCents":
         return left.totalAmountCents - right.totalAmountCents;
      case "updatedAt":
         return (
            dayjs(left.updatedAt).valueOf() - dayjs(right.updatedAt).valueOf()
         );
   }
}

function sortNfeRows(rows: NfeRow[], sorting: SortingState) {
   const normalized = normalizeNfeSorting(sorting);
   return [...rows].sort((left, right) => {
      if (normalized.length === 0) {
         return (
            dayjs(right.updatedAt).valueOf() - dayjs(left.updatedAt).valueOf()
         );
      }
      for (const rule of normalized) {
         const result = compareNfeValues(left, right, rule.id);
         if (result !== 0) return rule.desc ? -result : result;
      }
      return left.number.localeCompare(right.number, "pt-BR");
   });
}

function matchesNfeFilter(row: NfeRow, filter: ColumnFiltersState[number]) {
   if (typeof filter.value !== "string") return true;
   const value = filter.value.trim().toLowerCase();
   if (!value) return true;
   if (filter.id === "accessKey") return row.accessKey.includes(value);
   if (filter.id === "issuerName") {
      return row.issuerName.toLowerCase().includes(value);
   }
   if (filter.id === "number") return row.number.toLowerCase().includes(value);
   if (filter.id === "recipientName") {
      return String(row.recipientName ?? "")
         .toLowerCase()
         .includes(value);
   }
   if (filter.id === "series") return row.series.toLowerCase().includes(value);
   if (filter.id === "status") return row.status === value;
   return true;
}

function filterNfeRows(rows: NfeRow[], filters: ColumnFiltersState) {
   if (filters.length === 0) return rows;
   return rows.filter((row) =>
      filters.every((filter) => matchesNfeFilter(row, filter)),
   );
}

function buildNfeColumns(): ColumnDef<NfeRow>[] {
   return [
      {
         accessorKey: "number",
         header: "Número",
         size: 140,
         meta: { label: "Número", filterVariant: "text" },
         cell: ({ row }) => (
            <span className="truncate font-medium">
               {row.original.number}/{row.original.series}
            </span>
         ),
      },
      {
         accessorKey: "issuerName",
         header: "Emitente",
         size: 260,
         meta: { label: "Emitente", filterVariant: "text" },
         cell: ({ row }) => (
            <span className="truncate">{row.original.issuerName}</span>
         ),
      },
      {
         accessorKey: "recipientName",
         header: "Destinatário",
         size: 220,
         meta: { label: "Destinatário", filterVariant: "text" },
         cell: ({ row }) => (
            <span className="truncate text-muted-foreground">
               {row.original.recipientName || "—"}
            </span>
         ),
      },
      {
         accessorKey: "totalAmountCents",
         header: "Valor",
         size: 140,
         meta: { label: "Valor", align: "right", exportable: true },
         cell: ({ row }) => (
            <span className="block text-right font-medium">
               {formatMoneyFromCents(row.original.totalAmountCents)}
            </span>
         ),
      },
      {
         accessorKey: "issuedAt",
         header: "Emissão",
         size: 140,
         meta: { label: "Emissão", filterVariant: "date" },
         cell: ({ row }) => (
            <span className="text-muted-foreground">
               {row.original.issuedAt
                  ? dayjs(row.original.issuedAt).format("DD/MM/YYYY")
                  : "—"}
            </span>
         ),
      },
      {
         accessorKey: "status",
         header: "Status",
         size: 140,
         meta: { label: "Status", filterVariant: "select" },
         cell: ({ row }) => (
            <Badge variant="outline">{row.original.statusLabel}</Badge>
         ),
      },
   ];
}

function UploadNfeSheet() {
   const { queryClient } = Route.useRouteContext();
   const { closeTopSheet } = useSheet();
   const collection = useMemo(
      () => createCollection(nfeCollectionOptions({ queryClient })),
      [queryClient],
   );
   const action = useMemo(() => createNfeAction(collection), [collection]);

   const form = useForm({
      defaultValues: {
         accessKey: "",
         number: "",
         series: "1",
         issuerName: "",
         recipientName: "",
         totalAmount: "0,00",
         issuedAt: "",
         fileKey: "",
         originalFileName: "",
         mimeType: "",
         fileSize: 0,
      },
      validators: { onSubmit: createNfeSchema },
      onSubmit: ({ value }) => {
         const transaction = action({
            input: {
               accessKey: value.accessKey,
               number: value.number,
               series: value.series,
               issuerName: value.issuerName,
               recipientName: value.recipientName || undefined,
               totalAmountCents: parseMoneyToCents(value.totalAmount),
               issuedAt: value.issuedAt || undefined,
               status: "received",
               fileKey: value.fileKey || undefined,
               originalFileName: value.originalFileName || undefined,
               mimeType: value.mimeType || undefined,
               fileSize: value.fileSize || undefined,
            },
         });
         transaction.isPersisted.promise
            .then(() => {
               toast.success("NF-e salva.");
               closeTopSheet();
            })
            .catch((error: unknown) =>
               toast.error(
                  error instanceof Error
                     ? error.message
                     : "Falha ao salvar NF-e.",
               ),
            );
      },
   });

   const upload = useUploadFiles({
      api: "/api/upload",
      route: "vaultDocument",
      onUploadComplete: ({ files, metadata }) => {
         const [file] = files;
         if (!file) return;
         const fileKey =
            getMetadataString(metadata, "fileKey") ?? file.objectInfo.key;
         form.setFieldValue("fileKey", fileKey);
         form.setFieldValue("originalFileName", file.name);
         form.setFieldValue("mimeType", file.type);
         form.setFieldValue("fileSize", file.size);
         toast.success("Arquivo fiscal enviado para o bucket.");
      },
      onUploadFail: ({ failedFiles }) => {
         for (const file of failedFiles)
            toast.error(`${file.name}: falha no upload.`);
      },
      onError: (error) => toast.error(error.message),
   });

   return (
      <>
         <SheetHeader>
            <SheetTitle>Nova NF-e</SheetTitle>
            <SheetDescription>
               Registre a nota e anexe o XML ou PDF. O arquivo também entra no
               Vault como documento fiscal.
            </SheetDescription>
         </SheetHeader>
         <div className="min-h-0 flex-1 overflow-auto px-4">
            <form
               className="flex flex-col gap-4"
               id="create-nfe-form"
               onSubmit={(event) => {
                  event.preventDefault();
                  form.handleSubmit();
               }}
            >
               <form.Field
                  name="accessKey"
                  children={(field) => {
                     const isInvalid =
                        field.state.meta.isTouched &&
                        field.state.meta.errors.length > 0;
                     return (
                        <Field>
                           <FieldLabel htmlFor={field.name} required>
                              Chave de acesso
                           </FieldLabel>
                           <Input
                              aria-invalid={isInvalid}
                              id={field.name}
                              name={field.name}
                              onBlur={field.handleBlur}
                              onInput={(event) =>
                                 field.handleChange(event.currentTarget.value)
                              }
                              placeholder="44 dígitos da NF-e"
                              value={field.state.value}
                           />
                           {isInvalid ? (
                              <FieldError>
                                 {String(field.state.meta.errors[0])}
                              </FieldError>
                           ) : null}
                        </Field>
                     );
                  }}
               />
               <div className="grid gap-4 sm:grid-cols-2">
                  <form.Field
                     name="number"
                     children={(field) => {
                        const isInvalid =
                           field.state.meta.isTouched &&
                           field.state.meta.errors.length > 0;
                        return (
                           <Field>
                              <FieldLabel htmlFor={field.name} required>
                                 Número
                              </FieldLabel>
                              <Input
                                 aria-invalid={isInvalid}
                                 id={field.name}
                                 name={field.name}
                                 onBlur={field.handleBlur}
                                 onInput={(event) =>
                                    field.handleChange(
                                       event.currentTarget.value,
                                    )
                                 }
                                 placeholder="Ex.: 12345"
                                 value={field.state.value}
                              />
                              {isInvalid ? (
                                 <FieldError>
                                    {String(field.state.meta.errors[0])}
                                 </FieldError>
                              ) : null}
                           </Field>
                        );
                     }}
                  />
                  <form.Field
                     name="series"
                     children={(field) => {
                        const isInvalid =
                           field.state.meta.isTouched &&
                           field.state.meta.errors.length > 0;
                        return (
                           <Field>
                              <FieldLabel htmlFor={field.name} required>
                                 Série
                              </FieldLabel>
                              <Input
                                 aria-invalid={isInvalid}
                                 id={field.name}
                                 name={field.name}
                                 onBlur={field.handleBlur}
                                 onInput={(event) =>
                                    field.handleChange(
                                       event.currentTarget.value,
                                    )
                                 }
                                 placeholder="Ex.: 1"
                                 value={field.state.value}
                              />
                              {isInvalid ? (
                                 <FieldError>
                                    {String(field.state.meta.errors[0])}
                                 </FieldError>
                              ) : null}
                           </Field>
                        );
                     }}
                  />
               </div>
               <form.Field
                  name="issuerName"
                  children={(field) => {
                     const isInvalid =
                        field.state.meta.isTouched &&
                        field.state.meta.errors.length > 0;
                     return (
                        <Field>
                           <FieldLabel htmlFor={field.name} required>
                              Emitente
                           </FieldLabel>
                           <Input
                              aria-invalid={isInvalid}
                              id={field.name}
                              name={field.name}
                              onBlur={field.handleBlur}
                              onInput={(event) =>
                                 field.handleChange(event.currentTarget.value)
                              }
                              placeholder="Razão social do emitente"
                              value={field.state.value}
                           />
                           {isInvalid ? (
                              <FieldError>
                                 {String(field.state.meta.errors[0])}
                              </FieldError>
                           ) : null}
                        </Field>
                     );
                  }}
               />
               <form.Field
                  name="recipientName"
                  children={(field) => (
                     <Field>
                        <FieldLabel htmlFor={field.name}>
                           Destinatário
                        </FieldLabel>
                        <Input
                           id={field.name}
                           name={field.name}
                           onBlur={field.handleBlur}
                           onInput={(event) =>
                              field.handleChange(event.currentTarget.value)
                           }
                           placeholder="Razão social do destinatário"
                           value={field.state.value}
                        />
                     </Field>
                  )}
               />
               <div className="grid gap-4 sm:grid-cols-2">
                  <form.Field
                     name="totalAmount"
                     children={(field) => (
                        <Field>
                           <FieldLabel htmlFor={field.name}>
                              Valor total
                           </FieldLabel>
                           <Input
                              id={field.name}
                              name={field.name}
                              onBlur={field.handleBlur}
                              onInput={(event) =>
                                 field.handleChange(event.currentTarget.value)
                              }
                              placeholder="0,00"
                              value={field.state.value}
                           />
                        </Field>
                     )}
                  />
                  <form.Field
                     name="issuedAt"
                     children={(field) => (
                        <Field>
                           <FieldLabel htmlFor={field.name}>Emissão</FieldLabel>
                           <Input
                              id={field.name}
                              name={field.name}
                              onBlur={field.handleBlur}
                              onInput={(event) =>
                                 field.handleChange(event.currentTarget.value)
                              }
                              type="date"
                              value={field.state.value}
                           />
                        </Field>
                     )}
                  />
               </div>
               <Field>
                  <FieldLabel>Arquivo fiscal</FieldLabel>
                  <UploadDropzone
                     accept="application/pdf,text/xml,application/xml,.xml,.pdf"
                     control={upload.control}
                     description={{
                        maxFiles: 1,
                        maxFileSize: "25MB",
                        fileTypes: "XML ou PDF",
                     }}
                  />
                  <UploadProgress control={upload.control} />
                  <form.Subscribe
                     selector={(state) => state.values.originalFileName}
                  >
                     {(fileName) =>
                        fileName ? (
                           <p className="text-sm text-muted-foreground">
                              Arquivo enviado: {fileName}
                           </p>
                        ) : null
                     }
                  </form.Subscribe>
               </Field>
            </form>
         </div>
         <SheetFooter>
            <form.Subscribe
               selector={(state) => ({
                  canSubmit: state.canSubmit,
                  isSubmitting: state.isSubmitting,
               })}
            >
               {({ canSubmit, isSubmitting }) => (
                  <Button
                     disabled={
                        !canSubmit || isSubmitting || upload.control.isPending
                     }
                     form="create-nfe-form"
                     type="submit"
                  >
                     Salvar NF-e
                  </Button>
               )}
            </form.Subscribe>
         </SheetFooter>
      </>
   );
}

function NfeInfoContent() {
   return (
      <ContextPanel className="h-auto shrink-0">
         <ContextPanelHeader>
            <ContextPanelTitle>Sobre NF-e</ContextPanelTitle>
         </ContextPanelHeader>
         <ContextPanelContent className="flex-none gap-4">
            <p className="px-2 text-sm text-muted-foreground">
               A tela de NF-e centraliza notas fiscais eletrônicas recebidas ou
               cadastradas manualmente.
            </p>
            <div className="grid gap-2 px-2 text-sm">
               <div>
                  <div className="font-medium">Integração com Vault</div>
                  <p className="text-muted-foreground">
                     XML e PDF ficam registrados no GED como documentos fiscais.
                  </p>
               </div>
               <div>
                  <div className="font-medium">Operação fiscal</div>
                  <p className="text-muted-foreground">
                     Use busca, filtros e arquivamento em lote para acompanhar o
                     acervo de notas.
                  </p>
               </div>
            </div>
         </ContextPanelContent>
      </ContextPanel>
   );
}

function NfeToolbar({
   searchInput,
   table,
}: {
   searchInput: ReturnType<typeof useDebouncedSearch>;
   table: ReturnType<typeof useReactTable<NfeRow>>;
}) {
   const { openSheet } = useSheet();
   return (
      <div className="flex flex-wrap items-center justify-between gap-2">
         <SearchInput
            aria-label="Buscar NF-e"
            className="max-w-sm"
            onChange={(event) => searchInput.onChange(event.target.value)}
            placeholder="Buscar NF-e..."
            value={searchInput.value}
         />
         <div className="flex flex-wrap items-center gap-2">
            <DataTableColumnVisibility table={table} />
            <Button
               onClick={() =>
                  openSheet({
                     className: "sm:max-w-lg",
                     renderChildren: () => <UploadNfeSheet />,
                  })
               }
               size="icon-sm"
               tooltip="Nova NF-e"
               type="button"
               variant="outline"
            >
               <Plus />
               <span className="sr-only">Nova NF-e</span>
            </Button>
         </div>
      </div>
   );
}

function NfeSkeleton() {
   return <DataTableSkeleton columns={skeletonColumns} />;
}

function NfeContent() {
   const navigate = Route.useNavigate();
   const { queryClient } = Route.useRouteContext();
   const { sorting, columnFilters, search, page, pageSize } = Route.useSearch();
   const layout = useDataTableLayout("fiscal-nfe");
   const searchInput = useDebouncedSearch({
      value: search,
      onCommit: (value) =>
         navigate({
            search: (prev) => ({ ...prev, search: value, page: 1 }),
            replace: true,
         }),
   });
   const collection = useMemo(
      () => createCollection(nfeCollectionOptions({ queryClient })),
      [queryClient],
   );

   useContextPanelInfo(() => <NfeInfoContent />);

   const { data: liveRows, isLoading } = useLiveQuery(
      (q) => {
         let query = q.from({ nfe: collection });
         if (search.trim()) {
            const pattern = `%${search.trim()}%`;
            query = query.where(({ nfe }) =>
               or(
                  ilike(nfe.accessKey, pattern),
                  ilike(nfe.issuerName, pattern),
                  ilike(nfe.number, pattern),
                  ilike(nfe.recipientName, pattern),
                  ilike(nfe.series, pattern),
               ),
            );
         }
         return query.select(({ nfe }) => nfe);
      },
      [collection, search],
   );

   const rows = useMemo(() => {
      const filtered = filterNfeRows(liveRows, columnFilters);
      const sorted = sortNfeRows(filtered, sorting);
      const start = (page - 1) * pageSize;
      return { all: sorted, rows: sorted.slice(start, start + pageSize) };
   }, [columnFilters, liveRows, page, pageSize, sorting]);

   const columns = useMemo<ColumnDef<NfeRow>[]>(() => {
      const selectColumn: ColumnDef<NfeRow> = {
         id: "__select",
         size: 40,
         enableSorting: false,
         enableHiding: false,
         meta: { importIgnore: true },
         header: ({ table }) => (
            <Checkbox
               aria-label="Selecionar todos"
               checked={
                  table.getIsAllPageRowsSelected()
                     ? true
                     : table.getIsSomePageRowsSelected()
                       ? "indeterminate"
                       : false
               }
               onCheckedChange={(value) =>
                  table.toggleAllPageRowsSelected(Boolean(value))
               }
            />
         ),
         cell: ({ row }) => (
            <Checkbox
               aria-label="Selecionar linha"
               checked={row.getIsSelected()}
               disabled={!row.getCanSelect()}
               onCheckedChange={(value) => row.toggleSelected(Boolean(value))}
            />
         ),
      };
      const actionsColumn: ColumnDef<NfeRow> = {
         id: "__actions",
         size: 48,
         enableSorting: false,
         enableHiding: false,
         meta: { importIgnore: true, align: "right" },
         cell: ({ row }) => {
            const href = row.original.fileKey
               ? `/api/files/${row.original.fileKey}`
               : undefined;
            return (
               <div className="flex justify-end">
                  <Button
                     asChild={Boolean(href)}
                     disabled={!href}
                     size="icon-sm"
                     tooltip="Abrir arquivo fiscal"
                     type="button"
                     variant="ghost"
                  >
                     {href ? (
                        <a href={href} rel="noreferrer" target="_blank">
                           <ExternalLink className="size-4" />
                           <span className="sr-only">Abrir arquivo fiscal</span>
                        </a>
                     ) : (
                        <span>
                           <ExternalLink className="size-4" />
                           <span className="sr-only">Abrir arquivo fiscal</span>
                        </span>
                     )}
                  </Button>
               </div>
            );
         },
      };
      return [selectColumn, ...buildNfeColumns(), actionsColumn];
   }, []);

   const urlState = useTableUrlState({
      search: { sorting, columnFilters, page, pageSize },
      totalRows: rows.all.length,
      onUpdate: (next) =>
         navigate({ search: (prev) => ({ ...prev, ...next }), replace: true }),
   });

   const table = useReactTable({
      data: rows.rows,
      columns,
      getRowId: (row) => row.id,
      rowCount: rows.all.length,
      pageCount: urlState.pageCount,
      manualPagination: true,
      manualSorting: true,
      manualFiltering: true,
      columnResizeMode: "onChange",
      defaultColumn: { minSize: 80, size: 160, maxSize: 600 },
      state: { ...urlState.state, ...layout.state },
      onSortingChange: urlState.onSortingChange,
      onColumnFiltersChange: urlState.onColumnFiltersChange,
      onPaginationChange: urlState.onPaginationChange,
      onRowSelectionChange: urlState.onRowSelectionChange,
      onColumnSizingChange: layout.onColumnSizingChange,
      onColumnOrderChange: layout.onColumnOrderChange,
      onColumnVisibilityChange: layout.onColumnVisibilityChange,
      onColumnPinningChange: layout.onColumnPinningChange,
      getCoreRowModel: getCoreRowModel(),
   });

   const selectedRows = table.getSelectedRowModel().rows;
   const selectedIds = selectedRows.map((row) => row.original.id);
   useTableBulkActions({
      selectedCount: selectedRows.length,
      onClear: () => table.resetRowSelection(),
      children: (
         <SelectionActionButton
            icon={<Archive className="size-4" />}
            onClick={() => {
               const archive = bulkArchiveNfeAction(collection);
               const transaction = archive({ ids: selectedIds });
               transaction.isPersisted.promise
                  .then(() => {
                     toast.success(
                        `${selectedIds.length} ${selectedIds.length === 1 ? "NF-e arquivada" : "NF-e arquivadas"}.`,
                     );
                     table.resetRowSelection();
                  })
                  .catch((error: unknown) =>
                     toast.error(
                        error instanceof Error
                           ? error.message
                           : "Erro ao arquivar NF-e.",
                     ),
                  );
            }}
         >
            Arquivar
         </SelectionActionButton>
      ),
   });

   if (isLoading) return <NfeSkeleton />;

   return (
      <div className="flex flex-1 flex-col gap-4 min-h-0">
         <div className="flex flex-1 flex-col gap-4 min-h-0">
            <NfeToolbar searchInput={searchInput} table={table} />
            <DataTableFilterChips table={table} />
            <ScrollArea className="flex-1 min-h-0 rounded-md border bg-card">
               <Table>
                  <DataTableHeader table={table} />
                  <DataTableBody<NfeRow> table={table} />
               </Table>
               {table.getRowCount() === 0 ? (
                  <Empty>
                     <EmptyHeader>
                        <EmptyMedia variant="icon">
                           <ReceiptText className="size-6" />
                        </EmptyMedia>
                        <EmptyTitle>Nenhuma NF-e encontrada</EmptyTitle>
                        <EmptyDescription>
                           Cadastre uma nota ou ajuste a busca para ver
                           documentos fiscais.
                        </EmptyDescription>
                     </EmptyHeader>
                  </Empty>
               ) : null}
            </ScrollArea>
            {rows.all.length > 0 ? <DataTablePagination table={table} /> : null}
         </div>
      </div>
   );
}

function NfePage() {
   return (
      <main className="flex flex-1 min-h-0 flex-col gap-4 overflow-hidden">
         <DefaultHeader
            description="Controle notas fiscais eletrônicas e mantenha XML/PDF no GED."
            title="NF-e"
         />
         <NfeContent />
      </main>
   );
}
