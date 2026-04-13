import { Button } from "@packages/ui/components/button";
import {
   CredenzaBody,
   CredenzaFooter,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import {
   Dropzone,
   DropzoneContent,
   DropzoneEmptyState,
} from "@packages/ui/components/dropzone";
import { Field, FieldGroup, FieldLabel } from "@packages/ui/components/field";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
import { defineStepper } from "@packages/ui/components/stepper";
import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
} from "@packages/ui/components/table";
import { useMutation } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, FileSpreadsheet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useCsvFile } from "@/hooks/use-csv-file";
import { useXlsxFile } from "@/hooks/use-xlsx-file";
import { orpc } from "@/integrations/orpc/client";

const { Stepper, useStepper } = defineStepper(
   { id: "upload", title: "Arquivo" },
   { id: "map", title: "Mapeamento" },
   { id: "preview", title: "Prévia" },
   { id: "importar", title: "Importar" },
);

type StepperMethods = ReturnType<typeof useStepper>;

type ColumnMapping = {
   nome: string;
   limite_credito: string;
   dia_fechamento: string;
   dia_vencimento: string;
   conta_bancaria_id: string;
   status: string;
   bandeira: string;
};

type ParsedCard = {
   nome: string;
   creditLimit: string;
   closingDay: string;
   dueDay: string;
   bankAccountId: string;
   status: string;
   brand: string;
   errors: string[];
};

type RawFileData = {
   headers: string[];
   rows: string[][];
};

const FIELD_LABELS: Record<keyof ColumnMapping, string> = {
   nome: "Nome *",
   limite_credito: "Limite de Crédito *",
   dia_fechamento: "Dia de Fechamento *",
   dia_vencimento: "Dia de Vencimento *",
   conta_bancaria_id: "ID da Conta Bancária *",
   status: "Status",
   bandeira: "Bandeira",
};

const REQUIRED_FIELDS: (keyof ColumnMapping)[] = [
   "nome",
   "limite_credito",
   "dia_fechamento",
   "dia_vencimento",
   "conta_bancaria_id",
];

const NONE = "__none__";

function guessMapping(headers: string[]): Partial<ColumnMapping> {
   const mapping: Partial<ColumnMapping> = {};
   const lower = headers.map((h) => h.toLowerCase().trim());

   const patterns: Record<keyof ColumnMapping, string[]> = {
      nome: ["nome", "name", "cartao", "card"],
      limite_credito: ["limite", "credito", "credit_limit", "limite_credito"],
      dia_fechamento: [
         "fechamento",
         "closing",
         "dia_fechamento",
         "closing_day",
      ],
      dia_vencimento: ["vencimento", "due", "dia_vencimento", "due_day"],
      conta_bancaria_id: ["conta", "bank", "conta_bancaria", "bank_account"],
      status: ["status", "estado"],
      bandeira: ["bandeira", "brand", "bandeira_cartao"],
   };

   for (const [field, candidates] of Object.entries(patterns)) {
      const idx = lower.findIndex((h) => candidates.some((c) => h.includes(c)));
      if (idx !== -1) {
         mapping[field as keyof ColumnMapping] = headers[idx];
      }
   }

   return mapping;
}

function parseCards(
   headers: string[],
   rows: string[][],
   mapping: ColumnMapping,
): ParsedCard[] {
   const get = (row: string[], field: keyof ColumnMapping): string => {
      const header = mapping[field];
      if (!header) return "";
      const idx = headers.indexOf(header);
      return idx !== -1 ? (row[idx] ?? "").trim() : "";
   };

   return rows.map((row) => {
      const nome = get(row, "nome");
      const creditLimit = get(row, "limite_credito").replace(/[^\d.]/g, "");
      const closingDay = get(row, "dia_fechamento");
      const dueDay = get(row, "dia_vencimento");
      const bankAccountId = get(row, "conta_bancaria_id");
      const status = get(row, "status") || "active";
      const brand = get(row, "bandeira");

      const errors: string[] = [];
      if (!nome) errors.push("Nome obrigatório");
      if (!creditLimit || Number.isNaN(Number(creditLimit)))
         errors.push("Limite de crédito inválido");
      const cd = Number(closingDay);
      if (!closingDay || cd < 1 || cd > 31)
         errors.push("Dia de fechamento inválido (1-31)");
      const dd = Number(dueDay);
      if (!dueDay || dd < 1 || dd > 31)
         errors.push("Dia de vencimento inválido (1-31)");
      if (!bankAccountId) errors.push("ID da conta bancária obrigatório");

      return {
         nome,
         creditLimit,
         closingDay,
         dueDay,
         bankAccountId,
         status,
         brand,
         errors,
      };
   });
}

function StepIndicator({ methods }: { methods: StepperMethods }) {
   const steps = methods.state.all;
   const currentIndex = methods.lookup.getIndex(methods.state.current.data.id);

   return (
      <div className="flex items-center gap-2">
         {steps.map((step, idx) => (
            <div
               className={[
                  "h-1 rounded-full transition-all duration-300 flex-1",
                  idx === currentIndex
                     ? "bg-primary"
                     : idx < currentIndex
                       ? "bg-primary/50"
                       : "bg-muted",
               ].join(" ")}
               key={step.id}
            />
         ))}
      </div>
   );
}

interface UploadStepProps {
   methods: StepperMethods;
   onFileReady: (data: RawFileData) => void;
}

function UploadStep({ methods, onFileReady }: UploadStepProps) {
   const [isParsing, setIsParsing] = useState(false);
   const [selectedFile, setSelectedFile] = useState<File | undefined>();
   const { parse: parseCsv } = useCsvFile();
   const { parse: parseXlsx } = useXlsxFile();

   async function processFile(file: File) {
      setSelectedFile(file);
      setIsParsing(true);
      try {
         const isCsv = file.name.toLowerCase().endsWith(".csv");
         const data = isCsv ? await parseCsv(file) : await parseXlsx(file);
         onFileReady(data);
         methods.navigation.next();
      } catch {
         toast.error("Erro ao processar arquivo. Verifique o formato.");
         setSelectedFile(undefined);
      } finally {
         setIsParsing(false);
      }
   }

   return (
      <>
         <CredenzaBody>
            <div className="flex flex-col gap-4">
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
                     <div className="flex flex-col gap-2 items-center">
                        <FileSpreadsheet className="size-8 text-muted-foreground" />
                        <p className="font-medium text-sm">
                           Arraste e solte ou clique para selecionar
                        </p>
                        <p className="text-xs text-muted-foreground">
                           Suporta arquivos <strong>.CSV</strong> e{" "}
                           <strong>.XLSX</strong>
                        </p>
                     </div>
                  </DropzoneEmptyState>
                  <DropzoneContent />
               </Dropzone>
               {isParsing && (
                  <p className="text-muted-foreground text-sm text-center">
                     Processando arquivo...
                  </p>
               )}
            </div>
         </CredenzaBody>
      </>
   );
}

interface MapStepProps {
   methods: StepperMethods;
   headers: string[];
   mapping: Partial<ColumnMapping>;
   onMappingChange: (mapping: Partial<ColumnMapping>) => void;
   onNext: () => void;
}

function MapStep({
   methods,
   headers,
   mapping,
   onMappingChange,
   onNext,
}: MapStepProps) {
   function canProceed() {
      return REQUIRED_FIELDS.every((f) => Boolean(mapping[f]));
   }

   return (
      <>
         <CredenzaBody>
            <FieldGroup>
               {(Object.keys(FIELD_LABELS) as (keyof ColumnMapping)[]).map(
                  (field) => (
                     <Field key={field}>
                        <FieldLabel>{FIELD_LABELS[field]}</FieldLabel>
                        <Select
                           onValueChange={(val) =>
                              onMappingChange({
                                 ...mapping,
                                 [field]: val === NONE ? "" : val,
                              })
                           }
                           value={mapping[field] ?? NONE}
                        >
                           <SelectTrigger>
                              <SelectValue placeholder="Selecionar coluna" />
                           </SelectTrigger>
                           <SelectContent>
                              <SelectItem value={NONE}>
                                 — Não mapear —
                              </SelectItem>
                              {headers.map((h) => (
                                 <SelectItem key={h} value={h}>
                                    {h}
                                 </SelectItem>
                              ))}
                           </SelectContent>
                        </Select>
                     </Field>
                  ),
               )}
            </FieldGroup>
         </CredenzaBody>
         <CredenzaFooter>
            <Button
               onClick={() => methods.navigation.prev()}
               type="button"
               variant="outline"
            >
               Voltar
            </Button>
            <Button disabled={!canProceed()} onClick={onNext} type="button">
               Próximo
            </Button>
         </CredenzaFooter>
      </>
   );
}

interface PreviewStepProps {
   methods: StepperMethods;
   cards: ParsedCard[];
   onNext: () => void;
}

function PreviewStep({ methods, cards, onNext }: PreviewStepProps) {
   const validCount = cards.filter((c) => c.errors.length === 0).length;
   const invalidCount = cards.length - validCount;

   return (
      <>
         <CredenzaBody>
            <div className="flex flex-col gap-4">
               <div className="flex gap-4 text-sm">
                  <span className="text-green-600">{validCount} válidos</span>
                  {invalidCount > 0 && (
                     <span className="text-destructive">
                        {invalidCount} com erros
                     </span>
                  )}
               </div>
               <div className="max-h-64 overflow-auto rounded-md border">
                  <Table>
                     <TableHeader>
                        <TableRow>
                           <TableHead className="w-8" />
                           <TableHead>Nome</TableHead>
                           <TableHead>Limite</TableHead>
                           <TableHead>Fechamento</TableHead>
                           <TableHead>Vencimento</TableHead>
                        </TableRow>
                     </TableHeader>
                     <TableBody>
                        {cards.map((card, idx) => (
                           <TableRow key={`card-${idx + 1}`}>
                              <TableCell>
                                 {card.errors.length === 0 ? (
                                    <CheckCircle2 className="size-4 text-green-600" />
                                 ) : (
                                    <AlertCircle
                                       aria-label={card.errors.join(", ")}
                                       className="size-4 text-destructive"
                                    />
                                 )}
                              </TableCell>
                              <TableCell>{card.nome}</TableCell>
                              <TableCell>{card.creditLimit}</TableCell>
                              <TableCell>{card.closingDay}</TableCell>
                              <TableCell>{card.dueDay}</TableCell>
                           </TableRow>
                        ))}
                     </TableBody>
                  </Table>
               </div>
            </div>
         </CredenzaBody>
         <CredenzaFooter>
            <Button
               onClick={() => methods.navigation.prev()}
               type="button"
               variant="outline"
            >
               Voltar
            </Button>
            <Button disabled={validCount === 0} onClick={onNext} type="button">
               Importar {validCount} cartão{validCount !== 1 ? "ões" : ""}
            </Button>
         </CredenzaFooter>
      </>
   );
}

type BrandValue =
   | "visa"
   | "mastercard"
   | "elo"
   | "amex"
   | "hipercard"
   | "other";

const VALID_BRANDS: BrandValue[] = [
   "visa",
   "mastercard",
   "elo",
   "amex",
   "hipercard",
   "other",
];

function toBrand(value: string): BrandValue | undefined {
   const lower = value.toLowerCase();
   if ((VALID_BRANDS as string[]).includes(lower)) {
      return lower as BrandValue;
   }
   return undefined;
}

interface ImportStepProps {
   methods: StepperMethods;
   cards: ParsedCard[];
   onClose: () => void;
}

function ImportStep({ methods, cards, onClose }: ImportStepProps) {
   const [result, setResult] = useState<{ created: number } | null>(null);

   const importMutation = useMutation(
      orpc.creditCards.bulkCreate.mutationOptions({
         onSuccess: (data) => {
            setResult(data);
            toast.success(
               `${data.created} cartão${data.created !== 1 ? "ões" : ""} importado${data.created !== 1 ? "s" : ""} com sucesso.`,
            );
         },
         onError: (error) => {
            toast.error(error.message || "Erro ao importar cartões.");
         },
      }),
   );

   const validCards = cards.filter((c) => c.errors.length === 0);

   function handleImport() {
      importMutation.mutate({
         cards: validCards.map((c) => ({
            name: c.nome,
            creditLimit: c.creditLimit,
            closingDay: Number(c.closingDay),
            dueDay: Number(c.dueDay),
            bankAccountId: c.bankAccountId,
            status:
               c.status === "active" ||
               c.status === "blocked" ||
               c.status === "cancelled"
                  ? c.status
                  : undefined,
            brand: toBrand(c.brand),
         })),
      });
   }

   if (result) {
      return (
         <>
            <CredenzaBody>
               <div className="flex items-center gap-2 text-green-600 py-4">
                  <CheckCircle2 className="size-5" />
                  <p>
                     {result.created} cartão
                     {result.created !== 1 ? "ões" : ""} importado
                     {result.created !== 1 ? "s" : ""} com sucesso.
                  </p>
               </div>
            </CredenzaBody>
            <CredenzaFooter>
               <Button onClick={onClose} type="button">
                  Fechar
               </Button>
            </CredenzaFooter>
         </>
      );
   }

   return (
      <>
         <CredenzaBody>
            <p className="text-muted-foreground text-sm py-2">
               {validCards.length} cartão{validCards.length !== 1 ? "ões" : ""}{" "}
               pronto{validCards.length !== 1 ? "s" : ""} para importação.
            </p>
         </CredenzaBody>
         <CredenzaFooter>
            <Button
               onClick={() => methods.navigation.prev()}
               type="button"
               variant="outline"
            >
               Voltar
            </Button>
            <Button
               disabled={importMutation.isPending}
               onClick={handleImport}
               type="button"
            >
               {importMutation.isPending
                  ? "Importando..."
                  : "Confirmar Importação"}
            </Button>
         </CredenzaFooter>
      </>
   );
}

function ImportWizard({
   methods,
   onClose,
}: {
   methods: StepperMethods;
   onClose: () => void;
}) {
   const currentId = methods.state.current.data.id;

   const [rawData, setRawData] = useState<RawFileData | null>(null);
   const [mapping, setMapping] = useState<Partial<ColumnMapping>>({});
   const [parsedCards, setParsedCards] = useState<ParsedCard[]>([]);

   function handleFileReady(data: RawFileData) {
      setRawData(data);
      setMapping(guessMapping(data.headers));
   }

   function handleMappingNext() {
      if (!rawData) return;
      const fullMapping: ColumnMapping = {
         nome: mapping.nome ?? "",
         limite_credito: mapping.limite_credito ?? "",
         dia_fechamento: mapping.dia_fechamento ?? "",
         dia_vencimento: mapping.dia_vencimento ?? "",
         conta_bancaria_id: mapping.conta_bancaria_id ?? "",
         status: mapping.status ?? "",
         bandeira: mapping.bandeira ?? "",
      };
      const cards = parseCards(rawData.headers, rawData.rows, fullMapping);
      setParsedCards(cards);
      methods.navigation.next();
   }

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>Importar Cartões de Crédito</CredenzaTitle>
            <StepIndicator methods={methods} />
         </CredenzaHeader>

         {currentId === "upload" && (
            <UploadStep methods={methods} onFileReady={handleFileReady} />
         )}

         {currentId === "map" && (
            <MapStep
               headers={rawData?.headers ?? []}
               mapping={mapping}
               methods={methods}
               onMappingChange={setMapping}
               onNext={handleMappingNext}
            />
         )}

         {currentId === "preview" && (
            <PreviewStep
               cards={parsedCards}
               methods={methods}
               onNext={() => methods.navigation.next()}
            />
         )}

         {currentId === "importar" && (
            <ImportStep
               cards={parsedCards}
               methods={methods}
               onClose={onClose}
            />
         )}
      </>
   );
}

export function CreditCardsImportCredenza({
   onClose,
}: {
   onClose: () => void;
}) {
   return (
      <Stepper.Provider variant="line">
         {({ methods }) => <ImportWizard methods={methods} onClose={onClose} />}
      </Stepper.Provider>
   );
}
