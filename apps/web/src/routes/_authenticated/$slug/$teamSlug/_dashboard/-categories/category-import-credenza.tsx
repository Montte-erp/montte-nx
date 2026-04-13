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
import { Spinner } from "@packages/ui/components/spinner";
import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
} from "@packages/ui/components/table";
import { useMutation } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Upload } from "lucide-react";
import { type ChangeEvent, useCallback, useState } from "react";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";

type Step = "upload" | "mapping" | "preview" | "confirm";

interface ParsedRow {
   [key: string]: string;
}

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

function parseCsvContent(content: string): {
   headers: string[];
   rows: ParsedRow[];
} {
   const lines = content.split(/\r?\n/).filter((line) => line.trim());
   if (lines.length === 0) return { headers: [], rows: [] };

   const delimiter = lines[0].includes(";") ? ";" : ",";
   const parseRow = (line: string): string[] => {
      const result: string[] = [];
      let current = "";
      let inQuotes = false;
      for (const char of line) {
         if (char === '"') {
            inQuotes = !inQuotes;
         } else if (char === delimiter && !inQuotes) {
            result.push(current.trim());
            current = "";
         } else {
            current += char;
         }
      }
      result.push(current.trim());
      return result;
   };

   const headers = parseRow(lines[0]);
   const rows = lines.slice(1).map((line) => {
      const values = parseRow(line);
      const row: ParsedRow = {};
      for (let i = 0; i < headers.length; i++) {
         row[headers[i]] = values[i] ?? "";
      }
      return row;
   });

   return { headers, rows };
}

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
      for (const [field, regex] of Object.entries(patterns)) {
         if (regex.test(header)) {
            mapping[header] = field;
            break;
         }
      }
      if (!mapping[header]) {
         mapping[header] = "__skip__";
      }
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
      const type =
         typeRaw === "receita" || typeRaw === "income"
            ? "income"
            : typeRaw === "despesa" || typeRaw === "expense"
              ? "expense"
              : null;

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
            valid: true,
         });
      }

      if (subName) {
         const cat = categoryMap.get(name);
         cat?.subcategories.push({ name: subName, keywords: subKeywords });
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
   const [step, setStep] = useState<Step>("upload");
   const [headers, setHeaders] = useState<string[]>([]);
   const [rows, setRows] = useState<ParsedRow[]>([]);
   const [mapping, setMapping] = useState<Record<string, string>>({});
   const [mapped, setMapped] = useState<MappedCategory[]>([]);

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

   const handleFileUpload = useCallback((e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
         const content = ev.target?.result as string;
         const parsed = parseCsvContent(content);
         setHeaders(parsed.headers);
         setRows(parsed.rows);
         setMapping(guessMapping(parsed.headers));
         setStep("mapping");
      };
      reader.readAsText(file);
   }, []);

   const handleMappingConfirm = useCallback(() => {
      const result = applyMapping(rows, headers, mapping);
      setMapped(result);
      setStep("preview");
   }, [rows, headers, mapping]);

   const handleImport = useCallback(() => {
      const payload = mapped
         .filter((cat) => cat.type === "income" || cat.type === "expense")
         .map((cat) => ({
            name: cat.name,
            type: cat.type as "income" | "expense",
            color: cat.color,
            icon: cat.icon,
            keywords: cat.keywords,
         }));
      importMutation.mutate({ categories: payload });
   }, [mapped, importMutation]);

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>Importar Categorias</CredenzaTitle>
            <CredenzaDescription>
               {step === "upload" &&
                  "Faça upload de um arquivo CSV com suas categorias."}
               {step === "mapping" &&
                  "Mapeie as colunas do CSV para os campos corretos."}
               {step === "preview" &&
                  "Revise as categorias que serão importadas."}
               {step === "confirm" && "Confirme a importação."}
            </CredenzaDescription>
         </CredenzaHeader>

         <CredenzaBody className="px-4">
            {step === "upload" && (
               <label className="flex flex-col items-center gap-4 rounded-lg border-2 border-dashed p-8 cursor-pointer hover:border-primary transition-colors">
                  <Upload className="size-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                     Clique ou arraste um arquivo CSV
                  </span>
                  <input
                     accept=".csv"
                     className="hidden"
                     onChange={handleFileUpload}
                     type="file"
                  />
               </label>
            )}

            {step === "mapping" && (
               <div className="flex flex-col gap-4">
                  <p className="text-sm text-muted-foreground">
                     {rows.length} linhas encontradas. Mapeie as colunas:
                  </p>
                  {headers.map((header) => (
                     <div className="flex items-center gap-4" key={header}>
                        <span className="text-sm font-medium w-1/3 truncate">
                           {header}
                        </span>
                        <Select
                           onValueChange={(v) =>
                              setMapping((prev) => ({ ...prev, [header]: v }))
                           }
                           value={mapping[header] ?? "__skip__"}
                        >
                           <SelectTrigger className="w-2/3">
                              <SelectValue />
                           </SelectTrigger>
                           <SelectContent>
                              {FIELD_OPTIONS.map((opt) => (
                                 <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                 </SelectItem>
                              ))}
                           </SelectContent>
                        </Select>
                     </div>
                  ))}
               </div>
            )}

            {step === "preview" && (
               <div className="flex flex-col gap-4">
                  <p className="text-sm text-muted-foreground">
                     {mapped.length} categorias serão importadas:
                  </p>
                  <Table>
                     <TableHeader>
                        <TableRow>
                           <TableHead>Nome</TableHead>
                           <TableHead>Tipo</TableHead>
                           <TableHead>Palavras-chave</TableHead>
                           <TableHead>Subcategorias</TableHead>
                           <TableHead>Status</TableHead>
                        </TableRow>
                     </TableHeader>
                     <TableBody>
                        {mapped.slice(0, 20).map((cat) => (
                           <TableRow key={cat.name}>
                              <TableCell className="font-medium">
                                 {cat.name}
                              </TableCell>
                              <TableCell>
                                 {cat.type === "income"
                                    ? "Receita"
                                    : cat.type === "expense"
                                      ? "Despesa"
                                      : "—"}
                              </TableCell>
                              <TableCell>{cat.keywords?.length ?? 0}</TableCell>
                              <TableCell>{cat.subcategories.length}</TableCell>
                              <TableCell>
                                 {cat.valid ? (
                                    <CheckCircle2 className="size-4 text-green-600" />
                                 ) : (
                                    <AlertCircle className="size-4 text-destructive" />
                                 )}
                              </TableCell>
                           </TableRow>
                        ))}
                     </TableBody>
                  </Table>
                  {mapped.length > 20 && (
                     <p className="text-sm text-muted-foreground">
                        ...e mais {mapped.length - 20} categorias
                     </p>
                  )}
               </div>
            )}
         </CredenzaBody>

         <CredenzaFooter>
            {step === "mapping" && (
               <div className="flex gap-2 w-full">
                  <Button
                     className="flex-1"
                     onClick={() => setStep("upload")}
                     variant="outline"
                  >
                     Voltar
                  </Button>
                  <Button className="flex-1" onClick={handleMappingConfirm}>
                     Continuar
                  </Button>
               </div>
            )}
            {step === "preview" && (
               <div className="flex gap-2 w-full">
                  <Button
                     className="flex-1"
                     onClick={() => setStep("mapping")}
                     variant="outline"
                  >
                     Voltar
                  </Button>
                  <Button
                     className="flex-1"
                     disabled={importMutation.isPending}
                     onClick={handleImport}
                  >
                     {importMutation.isPending && (
                        <Spinner className="size-4 mr-2" />
                     )}
                     Importar {mapped.length} categorias
                  </Button>
               </div>
            )}
         </CredenzaFooter>
      </>
   );
}
