import { Button } from "@packages/ui/components/button";
import {
   CredenzaBody,
   CredenzaDescription,
   CredenzaFooter,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
import { Separator } from "@packages/ui/components/separator";
import { Spinner } from "@packages/ui/components/spinner";
import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
} from "@packages/ui/components/table";
import { defineStepper } from "@packages/ui/components/stepper";
import { useMutation } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { AlertCircle, CheckCircle2, Upload } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useCsvFile } from "@/hooks/use-csv-file";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";
import { cn } from "@packages/ui/lib/utils";

const { Stepper, steps } = defineStepper(
   { id: "upload", label: "Upload" },
   { id: "mapping", label: "Mapeamento" },
   { id: "preview", label: "Revisão" },
);

type ParsedRow = Record<string, string>;

const FIELD_OPTIONS = [
   { value: "__skip__", label: "Ignorar" },
   { value: "name", label: "Nome" },
   { value: "type", label: "Tipo" },
   { value: "color", label: "Cor" },
   { value: "icon", label: "Ícone" },
   { value: "keywords", label: "Palavras-chave" },
   { value: "subcategory", label: "Subcategoria" },
   { value: "subcategoryKeywords", label: "Palavras-chave (Sub)" },
];

function guessMapping(headers: string[]): Record<string, string> {
   const mapping: Record<string, string> = {};
   const patterns: Record<string, RegExp> = {
      name: /^(nome|name|categoria|category)$/i,
      type: /^(tipo|type)$/i,
      color: /^(cor|color)$/i,
      icon: /^(icone|ícone|icon)$/i,
      keywords: /^(palavras?.?chave|keywords?)$/i,
      subcategory: /^(subcategoria|subcategory|sub)$/i,
      subcategoryKeywords: /^(palavras?.?chave.*sub|sub.*keywords?)$/i,
   };
   for (const header of headers) {
      let matched = false;
      for (const [field, regex] of Object.entries(patterns)) {
         if (regex.test(header)) {
            mapping[header] = field;
            matched = true;
            break;
         }
      }
      if (!matched) mapping[header] = "__skip__";
   }
   return mapping;
}

interface MappedCategory {
   name: string;
   type: "income" | "expense" | null;
   color: string | null;
   icon: string | null;
   keywords: string[] | null;
   subcategories: { name: string; keywords: string[] | null }[];
   valid: boolean;
}

function applyMapping(
   rows: ParsedRow[],
   headers: string[],
   mapping: Record<string, string>,
): MappedCategory[] {
   const getField = (row: ParsedRow, field: string): string => {
      const header = headers.find((h) => mapping[h] === field);
      return header ? (row[header] ?? "").trim() : "";
   };

   const categoryMap = new Map<string, MappedCategory>();

   for (const row of rows) {
      const name = getField(row, "name");
      if (!name) continue;

      const typeRaw = getField(row, "type").toLowerCase();
      let type: "income" | "expense" | null = null;
      if (typeRaw === "receita" || typeRaw === "income") type = "income";
      else if (typeRaw === "despesa" || typeRaw === "expense") type = "expense";

      const color = getField(row, "color") || null;
      const icon = getField(row, "icon") || null;
      const keywordsRaw = getField(row, "keywords");
      const keywords = keywordsRaw
         ? keywordsRaw
              .split(/[;,]/)
              .map((k) => k.trim())
              .filter(Boolean)
         : null;

      const subName = getField(row, "subcategory");
      const subKeywordsRaw = getField(row, "subcategoryKeywords");
      const subKeywords = subKeywordsRaw
         ? subKeywordsRaw
              .split(/[;,]/)
              .map((k) => k.trim())
              .filter(Boolean)
         : null;

      if (!categoryMap.has(name)) {
         categoryMap.set(name, {
            name,
            type,
            color,
            icon,
            keywords,
            subcategories: [],
            valid: type !== null,
         });
      }

      if (subName) {
         categoryMap
            .get(name)
            ?.subcategories.push({ name: subName, keywords: subKeywords });
      }
   }

   return Array.from(categoryMap.values());
}

interface CategoryImportCredenzaProps {
   onSuccess: () => void;
}

export function CategoryImportCredenza({
   onSuccess,
}: CategoryImportCredenzaProps) {
   const [headers, setHeaders] = useState<string[]>([]);
   const [rows, setRows] = useState<ParsedRow[]>([]);
   const [mapping, setMapping] = useState<Record<string, string>>({});
   const [mapped, setMapped] = useState<MappedCategory[]>([]);
   const [isDragging, setIsDragging] = useState(false);
   const previewRef = useRef<HTMLDivElement>(null);

   const importMutation = useMutation(
      orpc.categories.importBatch.mutationOptions({
         onSuccess: () => {
            toast.success("Categorias importadas com sucesso.");
            onSuccess();
         },
         onError: (e) => {
            toast.error(e.message || "Erro ao importar categorias.");
         },
      }),
   );

   const { parse } = useCsvFile();

   const processFile = useCallback(
      (file: File) => {
         parse(file).then(({ headers: parsedHeaders, rows: parsedRows }) => {
            const parsed = parsedRows.map((fields) => {
               const row: ParsedRow = {};
               for (let i = 0; i < parsedHeaders.length; i++) {
                  row[parsedHeaders[i]] = fields[i] ?? "";
               }
               return row;
            });
            setHeaders(parsedHeaders);
            setRows(parsed);
            setMapping(guessMapping(parsedHeaders));
         });
      },
      [parse],
   );

   const validCount = mapped.filter((c) => c.valid).length;
   const invalidCount = mapped.filter((c) => !c.valid).length;

   const rowVirtualizer = useVirtualizer({
      count: mapped.length,
      getScrollElement: () => previewRef.current,
      estimateSize: () => 48,
      overscan: 5,
   });

   return (
      <Stepper.Provider>
         {({ methods }) => {
            const currentStepId = methods.state.current.data.id;
            const currentIndex = methods.lookup.getIndex(currentStepId);

            return (
               <>
                  <CredenzaHeader>
                     <CredenzaTitle>Importar Categorias</CredenzaTitle>
                     <CredenzaDescription>
                        {currentStepId === "upload" &&
                           "Faça upload de um arquivo CSV com suas categorias."}
                        {currentStepId === "mapping" &&
                           "Mapeie as colunas do CSV para os campos corretos."}
                        {currentStepId === "preview" &&
                           `${validCount} categorias serão importadas${invalidCount > 0 ? `, ${invalidCount} inválidas` : ""}.`}
                     </CredenzaDescription>
                     <div className="flex items-center gap-2 pt-4">
                        {steps.map((step, index) => {
                           const isActive = currentStepId === step.id;
                           const isCompleted = index < currentIndex;
                           return (
                              <div
                                 className="flex items-center gap-2"
                                 key={step.id}
                              >
                                 <div
                                    className={cn(
                                       "flex size-6 items-center justify-center rounded-full text-xs font-medium",
                                       isActive
                                          ? "bg-primary text-primary-foreground"
                                          : isCompleted
                                            ? "bg-primary/20 text-primary"
                                            : "bg-muted text-muted-foreground",
                                    )}
                                 >
                                    {index + 1}
                                 </div>
                                 <span
                                    className={cn(
                                       "text-sm",
                                       isActive
                                          ? "font-medium"
                                          : "text-muted-foreground",
                                    )}
                                 >
                                    {step.label}
                                 </span>
                                 {index < steps.length - 1 && (
                                    <Separator
                                       orientation="horizontal"
                                       className="w-8"
                                    />
                                 )}
                              </div>
                           );
                        })}
                     </div>
                  </CredenzaHeader>

                  <CredenzaBody className="px-4">
                     {currentStepId === "upload" && (
                        <label
                           className={cn(
                              "flex flex-col items-center gap-4 rounded-lg border-2 border-dashed p-8 cursor-pointer transition-colors",
                              isDragging
                                 ? "border-primary bg-primary/5"
                                 : "hover:border-primary",
                           )}
                           onDragEnter={(e) => {
                              e.preventDefault();
                              setIsDragging(true);
                           }}
                           onDragLeave={() => setIsDragging(false)}
                           onDragOver={(e) => e.preventDefault()}
                           onDrop={(e) => {
                              e.preventDefault();
                              setIsDragging(false);
                              const file = e.dataTransfer.files?.[0];
                              if (file?.name.endsWith(".csv")) {
                                 processFile(file);
                                 methods.navigation.next();
                              }
                           }}
                        >
                           <Upload className="size-8 text-muted-foreground" />
                           <span className="text-sm text-muted-foreground text-center">
                              Clique para selecionar ou arraste um arquivo CSV
                           </span>
                           <input
                              accept=".csv"
                              className="hidden"
                              onChange={(e) => {
                                 const file = e.target.files?.[0];
                                 if (file) {
                                    processFile(file);
                                    methods.navigation.next();
                                 }
                              }}
                              type="file"
                           />
                        </label>
                     )}

                     {currentStepId === "mapping" && (
                        <div className="flex flex-col gap-4">
                           <p className="text-sm text-muted-foreground">
                              {rows.length} linhas encontradas. Mapeie as
                              colunas:
                           </p>
                           {headers.map((header) => (
                              <div
                                 className="flex items-center gap-4"
                                 key={header}
                              >
                                 <span className="text-sm font-medium w-1/3 truncate">
                                    {header}
                                 </span>
                                 <Select
                                    onValueChange={(v) =>
                                       setMapping((prev) => ({
                                          ...prev,
                                          [header]: v,
                                       }))
                                    }
                                    value={mapping[header] ?? "__skip__"}
                                 >
                                    <SelectTrigger className="w-2/3">
                                       <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                       {FIELD_OPTIONS.map((opt) => (
                                          <SelectItem
                                             key={opt.value}
                                             value={opt.value}
                                          >
                                             {opt.label}
                                          </SelectItem>
                                       ))}
                                    </SelectContent>
                                 </Select>
                              </div>
                           ))}
                        </div>
                     )}

                     {currentStepId === "preview" && (
                        <div className="flex flex-col gap-4">
                           <div className="flex gap-4 text-sm">
                              <span className="text-muted-foreground">
                                 Total: <strong>{mapped.length}</strong>
                              </span>
                              {invalidCount > 0 && (
                                 <span className="text-destructive">
                                    Inválidas: <strong>{invalidCount}</strong>
                                 </span>
                              )}
                           </div>
                           <div className="h-72 overflow-auto" ref={previewRef}>
                              <Table>
                                 <TableHeader>
                                    <TableRow>
                                       <TableHead>Nome</TableHead>
                                       <TableHead>Tipo</TableHead>
                                       <TableHead>Subcategorias</TableHead>
                                       <TableHead>Status</TableHead>
                                    </TableRow>
                                 </TableHeader>
                                 <TableBody>
                                    <tr
                                       style={{
                                          height: `${rowVirtualizer.getTotalSize()}px`,
                                          position: "relative",
                                          display: "block",
                                       }}
                                    >
                                       {rowVirtualizer
                                          .getVirtualItems()
                                          .map((virtualRow) => {
                                             const cat =
                                                mapped[virtualRow.index];
                                             return (
                                                <TableRow
                                                   key={cat.name}
                                                   style={{
                                                      position: "absolute",
                                                      top: 0,
                                                      width: "100%",
                                                      transform: `translateY(${virtualRow.start}px)`,
                                                      display: "table",
                                                      tableLayout: "fixed",
                                                   }}
                                                >
                                                   <TableCell className="font-medium">
                                                      {cat.name}
                                                   </TableCell>
                                                   <TableCell>
                                                      {cat.type === "income"
                                                         ? "Receita"
                                                         : cat.type ===
                                                             "expense"
                                                           ? "Despesa"
                                                           : "—"}
                                                   </TableCell>
                                                   <TableCell>
                                                      {cat.subcategories.length}
                                                   </TableCell>
                                                   <TableCell>
                                                      {cat.valid ? (
                                                         <CheckCircle2 className="size-4 text-green-600" />
                                                      ) : (
                                                         <AlertCircle className="size-4 text-destructive" />
                                                      )}
                                                   </TableCell>
                                                </TableRow>
                                             );
                                          })}
                                    </tr>
                                 </TableBody>
                              </Table>
                           </div>
                        </div>
                     )}
                  </CredenzaBody>

                  <CredenzaFooter>
                     {currentStepId === "mapping" && (
                        <div className="flex gap-2 w-full">
                           <Button
                              className="flex-1"
                              onClick={() => methods.navigation.prev()}
                              variant="outline"
                           >
                              Voltar
                           </Button>
                           <Button
                              className="flex-1"
                              onClick={() => {
                                 const result = applyMapping(
                                    rows,
                                    headers,
                                    mapping,
                                 );
                                 setMapped(result);
                                 methods.navigation.next();
                              }}
                           >
                              Continuar
                           </Button>
                        </div>
                     )}
                     {currentStepId === "preview" && (
                        <div className="flex gap-2 w-full">
                           <Button
                              className="flex-1"
                              onClick={() => methods.navigation.prev()}
                              variant="outline"
                           >
                              Voltar
                           </Button>
                           <Button
                              className="flex-1 gap-2"
                              disabled={
                                 importMutation.isPending || validCount === 0
                              }
                              onClick={() => {
                                 const payload = mapped
                                    .filter((cat) => cat.valid)
                                    .map((cat) => {
                                       if (
                                          cat.type !== "income" &&
                                          cat.type !== "expense"
                                       )
                                          return null;
                                       return {
                                          name: cat.name,
                                          type: cat.type,
                                          color: cat.color,
                                          icon: cat.icon,
                                          keywords: cat.keywords,
                                          subcategories: cat.subcategories.map(
                                             (s) => ({
                                                name: s.name,
                                             }),
                                          ),
                                       };
                                    })
                                    .filter(
                                       (
                                          item,
                                       ): item is NonNullable<typeof item> =>
                                          item !== null,
                                    );
                                 importMutation.mutate({ categories: payload });
                              }}
                           >
                              {importMutation.isPending && (
                                 <Spinner className="size-4" />
                              )}
                              Importar {validCount} categorias
                           </Button>
                        </div>
                     )}
                  </CredenzaFooter>
               </>
            );
         }}
      </Stepper.Provider>
   );
}
