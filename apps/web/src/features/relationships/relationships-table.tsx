import { Button } from "@packages/ui/components/button";
import { Checkbox } from "@packages/ui/components/checkbox";
import {
   Empty,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import { Input } from "@packages/ui/components/input";
import { ScrollArea } from "@packages/ui/components/scroll-area";
import { SearchInput } from "@packages/ui/components/search-input";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
import { Table } from "@packages/ui/components/table";
import { TooltipProvider } from "@packages/ui/components/tooltip";
import { toast } from "@packages/ui/hooks/use-toast";
import type { QueryClient } from "@tanstack/query-core";
import { createCollection, useLiveQuery } from "@tanstack/react-db";
import { Link } from "@tanstack/react-router";
import {
   getCoreRowModel,
   useReactTable,
   type ColumnDef,
   type ColumnFiltersState,
   type SortingState,
} from "@tanstack/react-table";
import { Result } from "better-result";
import {
   Archive,
   ArchiveRestore,
   Building2,
   Check,
   Edit2,
   Plus,
   ReceiptText,
   Trash2,
   Truck,
   UserPlus,
   UserRound,
   X,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { z } from "zod";
import { DataImportButton } from "@/blocks/data-table/data-import/data-import-button";
import { DataImportSection } from "@/blocks/data-table/data-import/data-import-section";
import {
   useDataImport,
   type DataImportConfig,
} from "@/blocks/data-table/data-import/use-data-import";
import { DataTableBody } from "@/blocks/data-table/data-table-body";
import { DataTableColumnVisibility } from "@/blocks/data-table/data-table-column-visibility";
import { DataTableFilterChips } from "@/blocks/data-table/data-table-filter-chips";
import { DataTableHeader } from "@/blocks/data-table/data-table-header";
import { DataTablePagination } from "@/blocks/data-table/data-table-pagination";
import { DataTableSkeleton } from "@/blocks/data-table/data-table-skeleton";
import { useDataTableLayout } from "@/blocks/data-table/use-data-table-layout";
import { useDebouncedSearch } from "@/blocks/data-table/use-debounced-search";
import { useTableUrlState } from "@/blocks/data-table/use-table-url-state";
import {
   SelectionActionButton,
   useTableBulkActions,
} from "@/hooks/use-selection-toolbar";
import { ExportButton } from "@/components/export-button/export-button";
import { useActiveTeam } from "@/hooks/use-active-team";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useCsvFile } from "@/hooks/use-csv-file";
import { useDashboardSlugs } from "@/hooks/use-dashboard-slugs";
import { useSheet } from "@/hooks/use-sheet";
import { useXlsxFile } from "@/hooks/use-xlsx-file";
import {
   archiveRelationshipAction,
   deleteRelationshipAction,
   importRelationshipsAction,
   relationshipsCollectionOptions,
   restoreRelationshipAction,
   updateRelationshipAction,
   type RelationshipImportBulkOutput,
   type RelationshipKind,
   type RelationshipRole,
   type RelationshipsCollectionRow,
} from "@/integrations/tanstack-db/relationships";
import { RelationshipFormSheet } from "./relationship-form-sheet";

const KIND_VALUES = ["company", "person"] as const;
const relationshipSortIdSchema = z.enum([
   "kind",
   "name",
   "documentNumber",
   "email",
   "phone",
]);
const relationshipImportRowSchema = z.object({
   kind: z.enum(KIND_VALUES),
   name: z
      .string()
      .trim()
      .min(2, "Nome deve ter no mínimo 2 caracteres.")
      .max(160, "Nome deve ter no máximo 160 caracteres."),
   documentNumber: z.string().trim(),
   email: z.union([
      z.literal(""),
      z.string().email("Informe um e-mail válido."),
   ]),
   phone: z.string().trim(),
});

const editSchema = relationshipImportRowSchema.superRefine((value, ctx) => {
   const documentDigits = value.documentNumber.replace(/\D/g, "");
   if (
      documentDigits &&
      value.kind === "person" &&
      !isValidCpf(value.documentNumber)
   ) {
      ctx.addIssue({
         code: z.ZodIssueCode.custom,
         path: ["documentNumber"],
         message:
            documentDigits.length === 11
               ? "CPF inválido."
               : "CPF deve conter 11 dígitos.",
      });
   }
   if (
      documentDigits &&
      value.kind === "company" &&
      !isValidCnpj(value.documentNumber)
   ) {
      ctx.addIssue({
         code: z.ZodIssueCode.custom,
         path: ["documentNumber"],
         message:
            documentDigits.length === 14
               ? "CNPJ inválido."
               : "CNPJ deve conter 14 dígitos.",
      });
   }
   const phoneDigits = value.phone.replace(/\D/g, "");
   if (phoneDigits && phoneDigits.length !== 10 && phoneDigits.length !== 11) {
      ctx.addIssue({
         code: z.ZodIssueCode.custom,
         path: ["phone"],
         message: "Telefone deve ter 10 ou 11 dígitos.",
      });
   }
});

type RelationshipEditValues = z.input<typeof editSchema>;
type RelationshipSortId = z.infer<typeof relationshipSortIdSchema>;

type RelationshipsSearchState = {
   sorting: SortingState;
   columnFilters: Array<{ id: string; value: unknown }>;
   search: string;
   view: "active" | "archived";
   page: number;
   pageSize: number;
};

type RelationshipsTableProps = {
   role: RelationshipRole;
   searchState: RelationshipsSearchState;
   onSearchChange: (next: Partial<RelationshipsSearchState>) => void;
   storageKey: "relationships-customers" | "relationships-suppliers";
   emptyTitle: string;
   emptyDescription: string;
   createLabel: string;
   queryClient: QueryClient;
};

const KIND_LABELS: Record<RelationshipKind, string> = {
   company: "Empresa",
   person: "Pessoa física",
};

const skeletonColumns = buildRelationshipSkeletonColumns();

function buildRelationshipSkeletonColumns(): ColumnDef<RelationshipsCollectionRow>[] {
   return [
      { accessorKey: "kind", header: "Tipo" },
      { accessorKey: "name", header: "Nome" },
      { accessorKey: "documentNumber", header: "CPF/CNPJ" },
      { accessorKey: "email", header: "E-mail" },
      { accessorKey: "phone", header: "Telefone" },
   ];
}

export function RelationshipsTableSkeleton() {
   return <DataTableSkeleton columns={skeletonColumns} />;
}

function parseKind(value: string): RelationshipKind | undefined {
   return KIND_VALUES.find((kind) => kind === value);
}

function normalizeNullable(value: string) {
   const trimmed = value.trim();
   return trimmed || null;
}

function normalizeDigits(value: string) {
   return value.replace(/\D/g, "") || null;
}

function normalizeImportDocument(value: string) {
   return value.toUpperCase().replace(/[^A-Z0-9]/g, "") || null;
}

function formatDocumentNumber(
   value: string | null | undefined,
   kind: RelationshipKind,
) {
   const digits = String(value ?? "")
      .replace(/\D/g, "")
      .slice(0, kind === "person" ? 11 : 14);
   if (kind === "person") {
      return digits
         .replace(/^(\d{3})(\d)/, "$1.$2")
         .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
         .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
   }
   return digits
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3/$4")
      .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, "$1.$2.$3/$4-$5");
}

function formatPhone(value: string | null | undefined) {
   const digits = String(value ?? "")
      .replace(/\D/g, "")
      .slice(0, 11);

   if (digits.length <= 10) {
      return digits
         .replace(/^(\d{2})(\d)/, "($1) $2")
         .replace(/^(\(\d{2}\) \d{4})(\d)/, "$1-$2");
   }

   return digits
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/^(\(\d{2}\) \d{5})(\d)/, "$1-$2");
}

function allDigitsEqual(value: string) {
   return value.split("").every((digit) => digit === value[0]);
}

function cpfDigit(values: string, weights: readonly number[]) {
   const total = values
      .split("")
      .reduce(
         (acc, digit, index) => acc + Number(digit) * (weights[index] ?? 0),
         0,
      );
   const remainder = total % 11;
   return remainder < 2 ? 0 : 11 - remainder;
}

function isValidCpf(value: string) {
   const digits = value.replace(/\D/g, "");
   if (digits.length !== 11 || allDigitsEqual(digits)) return false;
   const body = digits.slice(0, 9);
   const first = cpfDigit(body, [10, 9, 8, 7, 6, 5, 4, 3, 2]);
   const second = cpfDigit(`${body}${first}`, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
   return `${first}${second}` === digits.slice(9);
}

function cnpjDigit(values: string, weights: readonly number[]) {
   const total = values
      .split("")
      .reduce(
         (acc, digit, index) => acc + Number(digit) * (weights[index] ?? 0),
         0,
      );
   const remainder = total % 11;
   return remainder < 2 ? 0 : 11 - remainder;
}

function isValidCnpj(value: string) {
   const digits = value.replace(/\D/g, "");
   if (digits.length !== 14 || allDigitsEqual(digits)) return false;
   const body = digits.slice(0, 12);
   const first = cnpjDigit(body, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
   const second = cnpjDigit(
      `${body}${first}`,
      [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
   );
   return `${first}${second}` === digits.slice(12);
}

function valueOrDash(value: string | null | undefined) {
   return value?.trim() ? value : "—";
}

function getErrorMessage(error: unknown, fallback: string) {
   if (
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof error.message === "string" &&
      error.message.length > 0
   ) {
      return error.message;
   }
   return fallback;
}

function getEditErrorMessage(error: z.ZodError<RelationshipEditValues>) {
   return error.issues[0]?.message ?? "Revise os campos destacados.";
}

function cleanImportCell(value: unknown) {
   const text = String(value ?? "").trim();
   if (text === "-" || text === "—") return "";
   return text;
}

function normalizeHeaderValue(value: string) {
   return value
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");
}

function resolveImportKind(value: unknown, documentNumber: string) {
   const normalized = normalizeHeaderValue(String(value ?? ""));
   if (normalized === "empresa" || normalized === "company") return "company";
   if (
      normalized === "pessoa fisica" ||
      normalized === "pessoa física" ||
      normalized === "person"
   ) {
      return "person";
   }
   const normalizedDocument = documentNumber
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
   const documentDigits = documentNumber.replace(/\D/g, "");
   if (documentDigits.length === 11) return "person";
   if (normalizedDocument.length === 14) return "company";
   return "company";
}

function isRelationshipImportResult(
   value: unknown,
): value is RelationshipImportBulkOutput {
   return (
      typeof value === "object" &&
      value !== null &&
      "created" in value &&
      "skipped" in value &&
      "errors" in value
   );
}

function getImportSuccessMessage(value: unknown, count: number) {
   if (!isRelationshipImportResult(value)) {
      const label =
         count === 1
            ? "relacionamento importado"
            : "relacionamentos importados";
      return `${count} ${label}.`;
   }
   const importedLabel =
      value.created === 1
         ? "relacionamento importado"
         : "relacionamentos importados";
   const skippedLabel =
      value.skipped === 1 ? "duplicado ignorado" : "duplicados ignorados";
   return `${value.created} ${importedLabel}. ${value.skipped} ${skippedLabel}.`;
}

function normalizeImportDuplicateValue(value: unknown) {
   return normalizeImportDocument(String(value ?? "")) ?? "";
}

function buildImportErrorMessage(
   errors: RelationshipImportBulkOutput["errors"],
) {
   const details = errors
      .slice(0, 3)
      .map((error) => `linha ${error.index + 2}: ${error.message}`)
      .join("; ");
   const extra = errors.length > 3 ? `; mais ${errors.length - 3} erro(s)` : "";
   return `Importação retornou ${errors.length} erro(s): ${details}${extra}.`;
}

function normalizeSorting(sorting: SortingState) {
   const normalized: Array<{ id: RelationshipSortId; desc: boolean }> = [];
   for (const rule of sorting) {
      const result = relationshipSortIdSchema.safeParse(rule.id);
      if (!result.success) continue;
      normalized.push({ id: result.data, desc: rule.desc });
   }
   return normalized;
}

function compareRelationshipValues(
   left: RelationshipsCollectionRow,
   right: RelationshipsCollectionRow,
   sortId: RelationshipSortId,
) {
   const leftValue = left[sortId] ?? "";
   const rightValue = right[sortId] ?? "";
   return String(leftValue).localeCompare(String(rightValue), "pt-BR");
}

function sortRelationships(
   rows: RelationshipsCollectionRow[],
   sorting: SortingState,
) {
   const normalized = normalizeSorting(sorting);
   return [...rows].sort((left, right) => {
      for (const rule of normalized) {
         const result = compareRelationshipValues(left, right, rule.id);
         if (result !== 0) return rule.desc ? -result : result;
      }
      return left.name.localeCompare(right.name, "pt-BR");
   });
}

function getRelationshipFilterText(
   relationship: RelationshipsCollectionRow,
   filterId: RelationshipSortId,
) {
   if (filterId === "kind") return relationship.kind;
   if (filterId === "documentNumber") {
      return formatDocumentNumber(
         relationship.documentNumber,
         relationship.kind,
      );
   }
   if (filterId === "phone") return formatPhone(relationship.phone);
   return String(relationship[filterId] ?? "");
}

function matchesRelationshipFilter(
   relationship: RelationshipsCollectionRow,
   filter: ColumnFiltersState[number],
) {
   const result = relationshipSortIdSchema.safeParse(filter.id);
   if (!result.success) return true;
   if (typeof filter.value !== "string") return true;

   const value = filter.value.trim().toLowerCase();
   if (!value) return true;

   if (result.data === "kind") return relationship.kind === value;

   return getRelationshipFilterText(relationship, result.data)
      .toLowerCase()
      .includes(value);
}

function filterRelationships(
   rows: RelationshipsCollectionRow[],
   filters: ColumnFiltersState,
) {
   if (filters.length === 0) return rows;
   return rows.filter((relationship) =>
      filters.every((filter) =>
         matchesRelationshipFilter(relationship, filter),
      ),
   );
}

function relationshipToEditValues(
   relationship: RelationshipsCollectionRow,
): RelationshipEditValues {
   return {
      kind: relationship.kind,
      name: relationship.name,
      documentNumber: relationship.documentNumber ?? "",
      email: relationship.email ?? "",
      phone: relationship.phone ?? "",
   };
}

export function RelationshipsTable({
   role,
   searchState,
   onSearchChange,
   storageKey,
   emptyTitle,
   emptyDescription,
   createLabel,
   queryClient,
}: RelationshipsTableProps) {
   const { activeTeamId } = useActiveTeam();
   const { slug, teamSlug } = useDashboardSlugs();
   const { openAlertDialog } = useAlertDialog();
   const { openSheet } = useSheet();
   const { parse: parseCsv, generate: generateCsv } = useCsvFile();
   const { parse: parseXlsx, generate: generateXlsx } = useXlsxFile();
   const layout = useDataTableLayout(storageKey);
   const [editingId, setEditingId] = useState<string | null>(null);
   const [editValues, setEditValues] = useState<RelationshipEditValues | null>(
      null,
   );
   const [editError, setEditError] = useState<string | null>(null);

   const searchInput = useDebouncedSearch({
      value: searchState.search,
      onCommit: (value) => onSearchChange({ search: value, page: 1 }),
   });

   const collection = useMemo(
      () =>
         createCollection(
            relationshipsCollectionOptions({
               queryClient,
               teamId: activeTeamId ?? "no-team",
               role,
               archived: searchState.view === "archived",
               search: searchState.search.trim() || undefined,
            }),
         ),
      [activeTeamId, queryClient, role, searchState.search, searchState.view],
   );

   const importConfig: DataImportConfig = useMemo(
      () => ({
         parseFile: async (file: File) => {
            const ext = file.name.split(".").pop()?.toLowerCase();
            if (ext === "xlsx" || ext === "xls") return parseXlsx(file);
            return parseCsv(file);
         },
         importColumns: [
            { key: "name", label: "Cliente" },
            { key: "email", label: "Email" },
         ],
         mapRow: (row) => {
            const documentNumber = cleanImportCell(row.documentNumber);
            return {
               kind: resolveImportKind(row.kind, documentNumber),
               name: cleanImportCell(row.name),
               documentNumber,
               email: cleanImportCell(row.email),
               phone: cleanImportCell(row.phone),
            };
         },
         duplicateColumnKey: "documentNumber",
         normalizeDuplicateValue: normalizeImportDuplicateValue,
         getSuccessMessage: ({ result, count }) =>
            getImportSuccessMessage(result, count),
         template: {
            label: "Baixar modelo",
            description: "Modelo com Tipo, Nome, CPF/CNPJ, E-mail e Telefone.",
            formats: [
               {
                  filename: "modelo-relacionamentos.csv",
                  label: "CSV",
                  createBlob: () =>
                     generateCsv(
                        [
                           {
                              Tipo: "Empresa",
                              Nome: "Acme Ltda",
                              "CPF/CNPJ": "12.345.678/0001-95",
                              "E-mail": "financeiro@acme.com.br",
                              Telefone: "(11) 99999-9999",
                           },
                           {
                              Tipo: "Pessoa física",
                              Nome: "Maria Silva",
                              "CPF/CNPJ": "123.456.789-09",
                              "E-mail": "maria@email.com",
                              Telefone: "(11) 98888-8888",
                           },
                        ],
                        ["Tipo", "Nome", "CPF/CNPJ", "E-mail", "Telefone"],
                     ),
               },
               {
                  filename: "modelo-relacionamentos.xlsx",
                  label: "XLSX",
                  createBlob: () =>
                     generateXlsx(
                        [
                           {
                              Tipo: "Empresa",
                              Nome: "Acme Ltda",
                              "CPF/CNPJ": "12.345.678/0001-95",
                              "E-mail": "financeiro@acme.com.br",
                              Telefone: "(11) 99999-9999",
                           },
                           {
                              Tipo: "Pessoa física",
                              Nome: "Maria Silva",
                              "CPF/CNPJ": "123.456.789-09",
                              "E-mail": "maria@email.com",
                              Telefone: "(11) 98888-8888",
                           },
                        ],
                        ["Tipo", "Nome", "CPF/CNPJ", "E-mail", "Telefone"],
                     ),
               },
            ],
         },
         onImport: async (rows) => {
            if (!activeTeamId) throw new Error("Time ativo não encontrado.");
            const parsedRows = rows.map((row, index) => {
               const values = {
                  kind: row.kind,
                  name: String(row.name ?? ""),
                  documentNumber: String(row.documentNumber ?? ""),
                  email: String(row.email ?? ""),
                  phone: String(row.phone ?? ""),
               };
               const parsed = relationshipImportRowSchema.safeParse(values);
               return { index, parsed };
            });
            const invalidRows = parsedRows.filter(
               (entry) => !entry.parsed.success,
            );
            if (invalidRows.length > 0) {
               const details = invalidRows
                  .slice(0, 3)
                  .map((entry) => {
                     const message = entry.parsed.success
                        ? "Linha inválida."
                        : getEditErrorMessage(entry.parsed.error);
                     return `linha ${entry.index + 2}: ${message}`;
                  })
                  .join("; ");
               const extra =
                  invalidRows.length > 3
                     ? `; mais ${invalidRows.length - 3} erro(s)`
                     : "";
               throw new Error(
                  `Corrija ${invalidRows.length} linha(s) antes de importar: ${details}${extra}.`,
               );
            }

            const importRelationships = importRelationshipsAction(collection);
            const importResult: { value: RelationshipImportBulkOutput | null } =
               {
                  value: null,
               };
            const rowsToImport = parsedRows.flatMap((entry) => {
               if (!entry.parsed.success) return [];
               return [
                  {
                     kind: entry.parsed.data.kind,
                     name: entry.parsed.data.name.trim(),
                     documentNumber: normalizeImportDocument(
                        entry.parsed.data.documentNumber,
                     ),
                     email: normalizeNullable(entry.parsed.data.email),
                     phone: normalizeDigits(entry.parsed.data.phone),
                  },
               ];
            });
            const transaction = importRelationships({
               role,
               rows: rowsToImport,
               onResult: (value) => {
                  importResult.value = value;
               },
            });
            const result = await Result.tryPromise({
               try: () => transaction.isPersisted.promise,
               catch: (error) => error,
            });
            if (Result.isError(result)) {
               throw new Error(
                  getErrorMessage(
                     result.error,
                     "Erro ao importar relacionamentos.",
                  ),
               );
            }
            if (importResult.value?.errors.length) {
               throw new Error(
                  buildImportErrorMessage(importResult.value.errors),
               );
            }
            return importResult.value;
         },
      }),
      [
         activeTeamId,
         collection,
         generateCsv,
         generateXlsx,
         parseCsv,
         parseXlsx,
         role,
      ],
   );

   const { data: liveRelationships, isLoading } = useLiveQuery(
      (query) =>
         query
            .from({ relationship: collection })
            .select(({ relationship }) => relationship),
      [collection],
   );

   const relationships = useMemo(() => {
      const filtered = filterRelationships(
         liveRelationships,
         searchState.columnFilters,
      );
      const sorted = sortRelationships(filtered, searchState.sorting);
      const start = (searchState.page - 1) * searchState.pageSize;
      return {
         all: sorted,
         rows: sorted.slice(start, start + searchState.pageSize),
      };
   }, [
      liveRelationships,
      searchState.columnFilters,
      searchState.page,
      searchState.pageSize,
      searchState.sorting,
   ]);

   const handleOpenCreate = useCallback(() => {
      openSheet({
         renderChildren: () => (
            <RelationshipFormSheet
               collection={collection}
               role={role}
               teamId={activeTeamId}
            />
         ),
      });
   }, [activeTeamId, collection, openSheet, role]);

   const handleStartEdit = useCallback(
      (relationship: RelationshipsCollectionRow) => {
         if (relationship.archivedAt) return;
         setEditingId(relationship.id);
         setEditValues(relationshipToEditValues(relationship));
         setEditError(null);
      },
      [],
   );

   const handleCancelEdit = useCallback(() => {
      setEditingId(null);
      setEditValues(null);
      setEditError(null);
   }, []);

   const handleSaveEdit = useCallback(
      async (relationship: RelationshipsCollectionRow) => {
         if (!editValues || editingId !== relationship.id) return;
         const parsed = editSchema.safeParse(editValues);
         if (!parsed.success) {
            setEditError(getEditErrorMessage(parsed.error));
            return;
         }

         const updateRelationship = updateRelationshipAction(collection);
         const transaction = updateRelationship({
            id: relationship.id,
            patch: {
               kind: parsed.data.kind,
               name: parsed.data.name.trim(),
               documentNumber: normalizeDigits(parsed.data.documentNumber),
               email: normalizeNullable(parsed.data.email),
               phone: normalizeDigits(parsed.data.phone),
            },
         });
         const result = await Result.tryPromise({
            try: () => transaction.isPersisted.promise,
            catch: (error) => error,
         });
         if (Result.isError(result)) {
            toast.error(
               getErrorMessage(
                  result.error,
                  "Erro ao atualizar relacionamento.",
               ),
            );
            return;
         }

         toast.success("Relacionamento atualizado com sucesso.");
         handleCancelEdit();
      },
      [collection, editValues, editingId, handleCancelEdit],
   );

   const handleDelete = useCallback(
      (relationship: RelationshipsCollectionRow) => {
         openAlertDialog({
            title: "Excluir relacionamento",
            description: `Tem certeza que deseja excluir "${relationship.name}"? Esta ação não pode ser desfeita.`,
            actionLabel: "Excluir",
            cancelLabel: "Cancelar",
            variant: "destructive",
            onAction: async () => {
               const remove = deleteRelationshipAction(collection);
               const result = await Result.tryPromise({
                  try: () =>
                     remove({ id: relationship.id }).isPersisted.promise,
                  catch: (error) => error,
               });
               if (Result.isError(result)) {
                  toast.error(
                     getErrorMessage(
                        result.error,
                        "Erro ao excluir relacionamento.",
                     ),
                  );
                  return;
               }
               toast.success("Relacionamento excluído com sucesso.");
            },
         });
      },
      [collection, openAlertDialog],
   );

   const handleArchive = useCallback(
      (relationship: RelationshipsCollectionRow) => {
         openAlertDialog({
            title: "Arquivar relacionamento",
            description: `Arquivar "${relationship.name}" remove o relacionamento da visão de ativos.`,
            actionLabel: "Arquivar",
            cancelLabel: "Cancelar",
            onAction: async () => {
               const archive = archiveRelationshipAction(collection);
               const result = await Result.tryPromise({
                  try: () =>
                     archive({ id: relationship.id }).isPersisted.promise,
                  catch: (error) => error,
               });
               if (Result.isError(result)) {
                  toast.error(
                     getErrorMessage(
                        result.error,
                        "Erro ao arquivar relacionamento.",
                     ),
                  );
                  return;
               }
               toast.success("Relacionamento arquivado com sucesso.");
            },
         });
      },
      [collection, openAlertDialog],
   );

   const handleRestore = useCallback(
      async (relationship: RelationshipsCollectionRow) => {
         const restore = restoreRelationshipAction(collection);
         const result = await Result.tryPromise({
            try: () => restore({ id: relationship.id }).isPersisted.promise,
            catch: (error) => error,
         });
         if (Result.isError(result)) {
            toast.error(
               getErrorMessage(
                  result.error,
                  "Erro ao desarquivar relacionamento.",
               ),
            );
            return;
         }
         toast.success("Relacionamento desarquivado com sucesso.");
      },
      [collection],
   );

   const updateEditValue = useCallback(
      (key: keyof RelationshipEditValues, value: string) => {
         setEditValues((current) => {
            if (!current) return current;
            if (key === "kind") {
               const parsed = parseKind(value);
               if (!parsed) return current;
               return {
                  ...current,
                  kind: parsed,
                  documentNumber: formatDocumentNumber(
                     current.documentNumber,
                     parsed,
                  ),
               };
            }
            return { ...current, [key]: value };
         });
         setEditError(null);
      },
      [],
   );

   const columns = useMemo<ColumnDef<RelationshipsCollectionRow>[]>(
      () => [
         {
            accessorKey: "kind",
            header: "Tipo",
            meta: {
               label: "Tipo",
               filterVariant: "select",
               exportable: true,
               isEditable: true,
               cellComponent: "select",
               editOptions: [
                  { value: "company", label: "Empresa" },
                  { value: "person", label: "Pessoa física" },
               ],
            },
            cell: ({ row }) => {
               const editing = editingId === row.original.id && editValues;
               if (editing) {
                  return (
                     <Select
                        value={editValues.kind}
                        onValueChange={(value) =>
                           updateEditValue("kind", value)
                        }
                     >
                        <SelectTrigger aria-label="Tipo">
                           <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                           <SelectItem value="company">Empresa</SelectItem>
                           <SelectItem value="person">Pessoa física</SelectItem>
                        </SelectContent>
                     </Select>
                  );
               }
               const Icon =
                  row.original.kind === "company" ? Building2 : UserRound;
               return (
                  <div className="flex items-center gap-2">
                     <Icon className="size-4 text-muted-foreground" />
                     <span>{KIND_LABELS[row.original.kind]}</span>
                  </div>
               );
            },
         },
         {
            accessorKey: "name",
            header: "Nome",
            meta: {
               label: "Nome",
               filterVariant: "text",
               exportable: true,
               isEditable: true,
               cellComponent: "text",
               required: true,
            },
            cell: ({ row }) => {
               const editing = editingId === row.original.id && editValues;
               if (editing) {
                  return (
                     <Input
                        aria-label="Nome"
                        value={editValues.name}
                        onChange={(event) =>
                           updateEditValue("name", event.target.value)
                        }
                     />
                  );
               }
               return <span className="font-medium">{row.original.name}</span>;
            },
         },
         {
            accessorKey: "documentNumber",
            header: "CPF/CNPJ",
            meta: {
               label: "CPF/CNPJ",
               filterVariant: "text",
               exportable: true,
               isEditable: true,
               cellComponent: "text",
            },
            cell: ({ row }) => {
               const editing = editingId === row.original.id && editValues;
               if (editing) {
                  return (
                     <Input
                        aria-label="CPF/CNPJ"
                        value={editValues.documentNumber}
                        onChange={(event) =>
                           updateEditValue(
                              "documentNumber",
                              formatDocumentNumber(
                                 event.target.value,
                                 editValues.kind,
                              ),
                           )
                        }
                     />
                  );
               }
               return (
                  <span>
                     {valueOrDash(
                        formatDocumentNumber(
                           row.original.documentNumber,
                           row.original.kind,
                        ),
                     )}
                  </span>
               );
            },
         },
         {
            accessorKey: "email",
            header: "E-mail",
            meta: {
               label: "E-mail",
               filterVariant: "text",
               exportable: true,
               isEditable: true,
               cellComponent: "text",
            },
            cell: ({ row }) => {
               const editing = editingId === row.original.id && editValues;
               if (editing) {
                  return (
                     <Input
                        aria-label="E-mail"
                        type="email"
                        value={editValues.email}
                        onChange={(event) =>
                           updateEditValue("email", event.target.value)
                        }
                     />
                  );
               }
               return <span>{valueOrDash(row.original.email)}</span>;
            },
         },
         {
            accessorKey: "phone",
            header: "Telefone",
            meta: {
               label: "Telefone",
               filterVariant: "text",
               exportable: true,
               isEditable: true,
               cellComponent: "text",
            },
            cell: ({ row }) => {
               const editing = editingId === row.original.id && editValues;
               if (editing) {
                  return (
                     <Input
                        aria-label="Telefone"
                        value={editValues.phone}
                        onChange={(event) =>
                           updateEditValue(
                              "phone",
                              formatPhone(event.target.value),
                           )
                        }
                     />
                  );
               }
               return (
                  <span>{valueOrDash(formatPhone(row.original.phone))}</span>
               );
            },
         },
      ],
      [editValues, editingId, updateEditValue],
   );

   const handleBulkDelete = useCallback(
      (ids: string[], onSuccess: () => void) => {
         openAlertDialog({
            title: `Excluir ${ids.length} ${ids.length === 1 ? "relacionamento" : "relacionamentos"}`,
            description:
               "Tem certeza que deseja excluir os relacionamentos selecionados? Esta ação não pode ser desfeita.",
            actionLabel: "Excluir",
            cancelLabel: "Cancelar",
            variant: "destructive",
            onAction: async () => {
               const remove = deleteRelationshipAction(collection);
               const result = await Result.tryPromise({
                  try: () =>
                     Promise.all(
                        ids.map((id) => remove({ id }).isPersisted.promise),
                     ),
                  catch: (error) => error,
               });
               if (Result.isError(result)) {
                  toast.error(
                     getErrorMessage(
                        result.error,
                        "Erro ao excluir relacionamentos.",
                     ),
                  );
                  return;
               }
               toast.success("Relacionamentos excluídos com sucesso.");
               onSuccess();
            },
         });
      },
      [collection, openAlertDialog],
   );

   const handleBulkArchive = useCallback(
      (ids: string[], onSuccess: () => void) => {
         openAlertDialog({
            title: `Arquivar ${ids.length} ${ids.length === 1 ? "relacionamento" : "relacionamentos"}`,
            description:
               "Os relacionamentos selecionados serão removidos da visão de ativos.",
            actionLabel: "Arquivar",
            cancelLabel: "Cancelar",
            onAction: async () => {
               const archive = archiveRelationshipAction(collection);
               const result = await Result.tryPromise({
                  try: () =>
                     Promise.all(
                        ids.map((id) => archive({ id }).isPersisted.promise),
                     ),
                  catch: (error) => error,
               });
               if (Result.isError(result)) {
                  toast.error(
                     getErrorMessage(
                        result.error,
                        "Erro ao arquivar relacionamentos.",
                     ),
                  );
                  return;
               }
               toast.success("Relacionamentos arquivados com sucesso.");
               onSuccess();
            },
         });
      },
      [collection, openAlertDialog],
   );

   const handleBulkRestore = useCallback(
      async (ids: string[], onSuccess: () => void) => {
         const restore = restoreRelationshipAction(collection);
         const result = await Result.tryPromise({
            try: () =>
               Promise.all(
                  ids.map((id) => restore({ id }).isPersisted.promise),
               ),
            catch: (error) => error,
         });
         if (Result.isError(result)) {
            toast.error(
               getErrorMessage(
                  result.error,
                  "Erro ao desarquivar relacionamentos.",
               ),
            );
            return;
         }
         toast.success("Relacionamentos desarquivados com sucesso.");
         onSuccess();
      },
      [collection],
   );

   const renderActions = useCallback(
      ({ row }: { row: { original: RelationshipsCollectionRow } }) => {
         const relationship = row.original;
         const isEditing = editingId === relationship.id;
         if (isEditing) {
            return (
               <>
                  <Button
                     onClick={() => handleSaveEdit(relationship)}
                     size="icon-sm"
                     tooltip="Salvar"
                     variant="outline"
                  >
                     <Check className="size-4" />
                     <span className="sr-only">Salvar</span>
                  </Button>
                  <Button
                     onClick={handleCancelEdit}
                     size="icon-sm"
                     tooltip="Cancelar"
                     variant="outline"
                  >
                     <X className="size-4" />
                     <span className="sr-only">Cancelar</span>
                  </Button>
               </>
            );
         }

         return (
            <>
               <Button
                  asChild
                  size="icon-sm"
                  tooltip="Ver lançamentos"
                  variant="outline"
               >
                  <Link
                     params={{ slug, teamSlug }}
                     search={{
                        bankId: "",
                        overdueOnly: false,
                        page: 1,
                        pageSize: 20,
                        relationshipId: relationship.id,
                        search: "",
                        status: [],
                        view: "all",
                     }}
                     to="/$slug/$teamSlug/transactions"
                  >
                     <ReceiptText className="size-4" />
                     <span className="sr-only">Ver lançamentos</span>
                  </Link>
               </Button>
               {!relationship.archivedAt && (
                  <Button
                     onClick={() => handleStartEdit(relationship)}
                     size="icon-sm"
                     tooltip="Editar"
                     variant="outline"
                  >
                     <Edit2 className="size-4" />
                     <span className="sr-only">Editar</span>
                  </Button>
               )}
               <Button
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleDelete(relationship)}
                  size="icon-sm"
                  tooltip="Excluir"
                  variant="outline"
               >
                  <Trash2 className="size-4" />
                  <span className="sr-only">Excluir</span>
               </Button>
               {relationship.archivedAt ? (
                  <Button
                     onClick={() => handleRestore(relationship)}
                     size="icon-sm"
                     tooltip="Desarquivar"
                     variant="outline"
                  >
                     <ArchiveRestore className="size-4" />
                     <span className="sr-only">Desarquivar</span>
                  </Button>
               ) : (
                  <Button
                     onClick={() => handleArchive(relationship)}
                     size="icon-sm"
                     tooltip="Arquivar"
                     variant="outline"
                  >
                     <Archive className="size-4" />
                     <span className="sr-only">Arquivar</span>
                  </Button>
               )}
            </>
         );
      },
      [
         editingId,
         handleArchive,
         handleCancelEdit,
         handleDelete,
         handleRestore,
         handleSaveEdit,
         handleStartEdit,
         slug,
         teamSlug,
      ],
   );

   const tableColumns = useMemo<ColumnDef<RelationshipsCollectionRow>[]>(
      () => [
         {
            id: "__select",
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
                     table.toggleAllPageRowsSelected(!!value)
                  }
               />
            ),
            cell: ({ row }) => (
               <Checkbox
                  aria-label="Selecionar linha"
                  checked={row.getIsSelected()}
                  onCheckedChange={(value) => row.toggleSelected(!!value)}
               />
            ),
            enableSorting: false,
            enableHiding: false,
            size: 44,
            meta: {
               required: true,
               resizable: false,
               reorderable: false,
               align: "center",
               headerAlign: "center",
            },
         },
         ...columns,
         {
            id: "__actions",
            header: () => null,
            cell: ({ row }) => (
               <div className="flex items-center justify-end gap-1">
                  {renderActions({ row })}
               </div>
            ),
            enableSorting: false,
            enableHiding: false,
            meta: { align: "right" },
         },
      ],
      [columns, renderActions],
   );

   const urlState = useTableUrlState({
      search: {
         sorting: searchState.sorting,
         columnFilters: searchState.columnFilters,
         page: searchState.page,
         pageSize: searchState.pageSize,
      },
      onUpdate: onSearchChange,
      totalRows: relationships.all.length,
   });

   const EmptyIcon = role === "customer" ? UserPlus : Truck;

   const table = useReactTable({
      data: relationships.rows,
      columns: tableColumns,
      getRowId: (row) => row.id,
      enableRowSelection: true,
      pageCount: urlState.pageCount,
      rowCount: relationships.all.length,
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

   const importApi = useDataImport({ table, config: importConfig });

   const selectedRows = table.getSelectedRowModel().rows;
   const selectedIds = selectedRows.map((row) => row.original.id);
   const resetSelection = () => table.resetRowSelection();

   useTableBulkActions({
      selectedCount: selectedRows.length,
      onClear: resetSelection,
      children: (
         <>
            {searchState.view === "archived" ? (
               <SelectionActionButton
                  icon={<ArchiveRestore />}
                  onClick={() => handleBulkRestore(selectedIds, resetSelection)}
               >
                  Desarquivar
               </SelectionActionButton>
            ) : (
               <SelectionActionButton
                  icon={<Archive />}
                  onClick={() => handleBulkArchive(selectedIds, resetSelection)}
               >
                  Arquivar
               </SelectionActionButton>
            )}
            <SelectionActionButton
               icon={<Trash2 />}
               onClick={() => handleBulkDelete(selectedIds, resetSelection)}
               variant="destructive"
            >
               Excluir
            </SelectionActionButton>
         </>
      ),
   });

   if (isLoading) return <RelationshipsTableSkeleton />;

   return (
      <div className="flex flex-1 flex-col gap-4 min-h-0">
         <div className="flex flex-wrap items-center gap-2 justify-between">
            <SearchInput
               aria-label="Buscar por nome ou CPF/CNPJ"
               className="max-w-sm"
               onChange={(event) => searchInput.onChange(event.target.value)}
               placeholder="Buscar por nome ou CPF/CNPJ..."
               value={searchInput.value}
            />
            <div className="flex flex-wrap items-center gap-2">
               <DataTableColumnVisibility table={table} />
               <ExportButton
                  fileBase={role === "customer" ? "clientes" : "fornecedores"}
                  table={table}
               />
               <DataImportButton api={importApi} config={importConfig} />
               <Button
                  onClick={handleOpenCreate}
                  size="icon-sm"
                  tooltip={createLabel}
                  variant="outline"
               >
                  <Plus className="size-4" />
                  <span className="sr-only">{createLabel}</span>
               </Button>
            </div>
         </div>
         <DataTableFilterChips table={table} />
         {editError ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
               {editError}
            </div>
         ) : null}
         <TooltipProvider>
            <ScrollArea className="flex-1 min-h-0 rounded-md border bg-card">
               <Table>
                  <DataTableHeader table={table} />
                  <DataImportSection
                     api={importApi}
                     config={importConfig}
                     table={table}
                  />
                  <DataTableBody<RelationshipsCollectionRow> table={table} />
               </Table>
               {!isLoading && table.getRowCount() === 0 ? (
                  <Empty>
                     <EmptyMedia>
                        <EmptyIcon className="size-10" />
                     </EmptyMedia>
                     <EmptyHeader>
                        <EmptyTitle>{emptyTitle}</EmptyTitle>
                        <EmptyDescription>{emptyDescription}</EmptyDescription>
                     </EmptyHeader>
                  </Empty>
               ) : null}
            </ScrollArea>
         </TooltipProvider>
         <DataTablePagination table={table} />
      </div>
   );
}
