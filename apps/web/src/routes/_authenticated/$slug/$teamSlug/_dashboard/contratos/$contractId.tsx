import { Plate, PlateContent, usePlateEditor } from "@udecode/plate/react";
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import {
   ContextPanel,
   ContextPanelContent,
   ContextPanelFooter,
   ContextPanelHeader,
   ContextPanelTitle,
} from "@packages/ui/components/context-panel";
import { DatePicker } from "@packages/ui/components/date-picker";
import { Field, FieldLabel } from "@packages/ui/components/field";
import { Input } from "@packages/ui/components/input";
import { MoneyInput } from "@packages/ui/components/money-input";
import { NumberInput } from "@packages/ui/components/number-input";
import { ScrollArea } from "@packages/ui/components/scroll-area";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
import { Separator } from "@packages/ui/components/separator";
import { Textarea } from "@packages/ui/components/textarea";
import { toast } from "@packages/ui/hooks/use-toast";
import { createFileRoute } from "@tanstack/react-router";
import dayjs from "dayjs";
import {
   ArrowLeft,
   PauseCircle,
   PlayCircle,
   RotateCcw,
   Save,
} from "lucide-react";
import { useMemo } from "react";
import { DefaultHeader } from "../../-layout/default-header";
import {
   contractTemplates,
   deriveContractCharges,
   formatCurrency,
   formatDate,
   getContractPartyName,
   initialContracts,
   initialCustomers,
   initialSuppliers,
   replaceTemplateVariables,
   statusLabel,
   type ContractFrequency,
   type ContractStatus,
   type DemoContract,
   useDemoContracts,
   useDemoCustomers,
   useDemoSuppliers,
} from "../-local-first-demo/demo-data";
import type React from "react";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/contratos/$contractId",
)({
   head: () => ({ meta: [{ title: "Editar contrato - Montte" }] }),
   component: ContratoEditorPage,
});

function ContratoEditorPage() {
   const params = Route.useParams();
   const navigate = Route.useNavigate();
   const [customers] = useDemoCustomers();
   const [suppliers] = useDemoSuppliers();
   const [contracts, setContracts] = useDemoContracts();
   const customersData = customers ?? initialCustomers;
   const suppliersData = suppliers ?? initialSuppliers;
   const contractsData = contracts ?? initialContracts;
   const contract = contractsData.find((item) => item.id === params.contractId);

   function backToList() {
      navigate({
         to: "/$slug/$teamSlug/contratos",
         params,
      });
   }

   function updateContract(next: DemoContract) {
      setContracts((current) =>
         (current ?? initialContracts).map((item) =>
            item.id === next.id ? { ...next, updatedAt: "2026-05-22" } : item,
         ),
      );
   }

   if (!contract) {
      return (
         <main className="flex flex-1 flex-col gap-4">
            <DefaultHeader
               actions={
                  <Button onClick={backToList} variant="outline">
                     <ArrowLeft />
                     Voltar
                  </Button>
               }
               description="O contrato não existe no localStorage desta demo."
               title="Contrato não encontrado"
            />
         </main>
      );
   }

   return (
      <main className="flex flex-1 min-h-0 flex-col gap-4 overflow-hidden">
         <DefaultHeader
            actions={
               <div className="flex flex-wrap gap-2">
                  <Button onClick={backToList} variant="outline">
                     <ArrowLeft />
                     Voltar
                  </Button>
                  <Button
                     onClick={() =>
                        toast.success("Contrato salvo no localStorage.")
                     }
                  >
                     <Save />
                     Salvar
                  </Button>
               </div>
            }
            description={`${contract.number} · ${getContractPartyName({
               contract,
               customers: customersData,
               suppliers: suppliersData,
            })}`}
            title={contract.title}
         />
         <div className="grid flex-1 min-h-0 gap-4 xl:grid-cols-[minmax(0,1fr)_392px]">
            <ContractDocumentEditor
               contract={contract}
               customers={customersData}
               onChange={updateContract}
               suppliers={suppliersData}
            />
            <ContractContextPanel
               contract={contract}
               customers={customersData}
               onChange={updateContract}
               suppliers={suppliersData}
            />
         </div>
      </main>
   );
}

function ContractDocumentEditor({
   contract,
   customers,
   onChange,
   suppliers,
}: {
   contract: DemoContract;
   customers: typeof initialCustomers;
   onChange: (contract: DemoContract) => void;
   suppliers: typeof initialSuppliers;
}) {
   const renderedDocument = useMemo(
      () => replaceTemplateVariables({ contract, customers, suppliers }),
      [contract, customers, suppliers],
   );
   const editor = usePlateEditor(
      {
         value: renderedDocument,
      },
      [contract.id, contract.templateId],
   );

   return (
      <section className="flex min-h-0 flex-col overflow-hidden rounded-md border bg-card">
         <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2">
            <div className="flex items-center gap-2">
               <StatusBadge status={contract.status} />
               <span className="text-sm text-muted-foreground">
                  Documento do contrato
               </span>
            </div>
            <Button
               onClick={() => toast.success("Documento salvo no localStorage.")}
               size="sm"
               variant="outline"
            >
               <Save />
               Salvar documento
            </Button>
         </div>
         <ScrollArea className="flex-1 min-h-0 bg-muted/30">
            <div className="mx-auto w-full max-w-5xl p-4">
               <Plate
                  editor={editor}
                  onChange={({ value }) =>
                     onChange({
                        ...contract,
                        document: value,
                     })
                  }
               >
                  <PlateContent
                     className="min-h-[calc(100vh-220px)] rounded-md border bg-background px-12 py-10 text-base leading-8 shadow-sm outline-none"
                     placeholder="Escreva o contrato..."
                  />
               </Plate>
            </div>
         </ScrollArea>
      </section>
   );
}

function ContractContextPanel({
   contract,
   customers,
   onChange,
   suppliers,
}: {
   contract: DemoContract;
   customers: typeof initialCustomers;
   onChange: (contract: DemoContract) => void;
   suppliers: typeof initialSuppliers;
}) {
   const charges = useMemo(() => deriveContractCharges(contract), [contract]);

   function applyTemplate(templateId: string) {
      const template = contractTemplates.find((item) => item.id === templateId);
      if (!template) return;
      onChange({
         ...contract,
         templateId,
         document: template.document,
         direction:
            template.direction === "ambos"
               ? contract.direction
               : template.direction,
      });
      toast.success("Modelo aplicado ao contrato.");
   }

   return (
      <ContextPanel className="rounded-md border bg-card px-0 pt-0">
         <ContextPanelHeader className="rounded-none border-b px-4 py-3">
            <ContextPanelTitle>Contexto do contrato</ContextPanelTitle>
         </ContextPanelHeader>
         <ContextPanelContent className="gap-4 px-4 py-4">
            <PanelSection title="Modelo e parte">
               <Field>
                  <FieldLabel>Modelo</FieldLabel>
                  <Select
                     onValueChange={applyTemplate}
                     value={contract.templateId}
                  >
                     <SelectTrigger>
                        <SelectValue />
                     </SelectTrigger>
                     <SelectContent>
                        {contractTemplates.map((template) => (
                           <SelectItem key={template.id} value={template.id}>
                              {template.title}
                           </SelectItem>
                        ))}
                     </SelectContent>
                  </Select>
               </Field>
               <TextField
                  label="Título"
                  onChange={(value) => onChange({ ...contract, title: value })}
                  value={contract.title}
               />
               <Field>
                  <FieldLabel>Tipo</FieldLabel>
                  <Select
                     onValueChange={(value) => {
                        if (value !== "receita" && value !== "despesa") return;
                        onChange({
                           ...contract,
                           direction: value,
                           customerId:
                              value === "receita"
                                 ? (customers[0]?.id ?? "")
                                 : "",
                           supplierId:
                              value === "despesa"
                                 ? (suppliers[0]?.id ?? "")
                                 : "",
                        });
                     }}
                     value={contract.direction}
                  >
                     <SelectTrigger>
                        <SelectValue />
                     </SelectTrigger>
                     <SelectContent>
                        <SelectItem value="receita">Receita</SelectItem>
                        <SelectItem value="despesa">Despesa</SelectItem>
                     </SelectContent>
                  </Select>
               </Field>
               {contract.direction === "receita" ? (
                  <Field>
                     <FieldLabel>Cliente</FieldLabel>
                     <Select
                        onValueChange={(value) =>
                           onChange({ ...contract, customerId: value })
                        }
                        value={contract.customerId}
                     >
                        <SelectTrigger>
                           <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                           {customers.map((customer) => (
                              <SelectItem key={customer.id} value={customer.id}>
                                 {customer.name}
                              </SelectItem>
                           ))}
                        </SelectContent>
                     </Select>
                  </Field>
               ) : (
                  <Field>
                     <FieldLabel>Fornecedor</FieldLabel>
                     <Select
                        onValueChange={(value) =>
                           onChange({ ...contract, supplierId: value })
                        }
                        value={contract.supplierId}
                     >
                        <SelectTrigger>
                           <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                           {suppliers.map((supplier) => (
                              <SelectItem key={supplier.id} value={supplier.id}>
                                 {supplier.name}
                              </SelectItem>
                           ))}
                        </SelectContent>
                     </Select>
                  </Field>
               )}
            </PanelSection>

            <PanelSection title="Cobrança recorrente">
               <Field>
                  <FieldLabel>Valor recorrente</FieldLabel>
                  <MoneyInput
                     id="contract-amount"
                     name="contract-amount"
                     onChange={(amount) =>
                        onChange({
                           ...contract,
                           billing: {
                              ...contract.billing,
                              amount: amount ?? 0,
                           },
                        })
                     }
                     value={contract.billing.amount}
                     valueInCents={false}
                  />
               </Field>
               <Field>
                  <FieldLabel>Frequência</FieldLabel>
                  <Select
                     onValueChange={(value) => {
                        const frequency = parseFrequency(value);
                        if (!frequency) return;
                        onChange({
                           ...contract,
                           billing: { ...contract.billing, frequency },
                        });
                     }}
                     value={contract.billing.frequency}
                  >
                     <SelectTrigger>
                        <SelectValue />
                     </SelectTrigger>
                     <SelectContent>
                        <SelectItem value="monthly">Mensal</SelectItem>
                        <SelectItem value="quarterly">Trimestral</SelectItem>
                        <SelectItem value="semiannual">Semestral</SelectItem>
                        <SelectItem value="annual">Anual</SelectItem>
                     </SelectContent>
                  </Select>
               </Field>
               <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                     <FieldLabel>Primeiro vencimento</FieldLabel>
                     <DatePicker
                        className="w-full overflow-hidden [&>span]:truncate"
                        date={toDate(contract.billing.firstDueDate)}
                        onSelect={(date) =>
                           onChange({
                              ...contract,
                              billing: {
                                 ...contract.billing,
                                 firstDueDate: toIsoDate(date),
                              },
                           })
                        }
                        placeholder="Sem data"
                     />
                  </Field>
                  <Field>
                     <FieldLabel>Dia fixo</FieldLabel>
                     <NumberInput
                        max={31}
                        min={1}
                        onChange={(dueDay) =>
                           onChange({
                              ...contract,
                              billing: { ...contract.billing, dueDay },
                           })
                        }
                        value={contract.billing.dueDay}
                     />
                  </Field>
               </div>
               <Field>
                  <FieldLabel>Fim do contrato</FieldLabel>
                  <DatePicker
                     className="w-full overflow-hidden [&>span]:truncate"
                     date={toDate(contract.billing.endDate)}
                     onSelect={(date) =>
                        onChange({
                           ...contract,
                           billing: {
                              ...contract.billing,
                              endDate: toIsoDate(date),
                           },
                        })
                     }
                     placeholder="Prazo indeterminado"
                  />
               </Field>
               <div className="grid gap-4 sm:grid-cols-2">
                  <TextField
                     label="Categoria"
                     onChange={(value) =>
                        onChange({
                           ...contract,
                           billing: { ...contract.billing, category: value },
                        })
                     }
                     value={contract.billing.category}
                  />
                  <TextField
                     label="Centro de Custo"
                     onChange={(value) =>
                        onChange({
                           ...contract,
                           billing: { ...contract.billing, costCenter: value },
                        })
                     }
                     value={contract.billing.costCenter}
                  />
               </div>
            </PanelSection>

            <PanelSection title="Objeto e status">
               <TextAreaField
                  label="Descrição do serviço"
                  onChange={(value) =>
                     onChange({ ...contract, serviceDescription: value })
                  }
                  value={contract.serviceDescription}
               />
               <Field>
                  <FieldLabel>Status</FieldLabel>
                  <Select
                     onValueChange={(value) => {
                        const status = parseStatus(value);
                        if (!status) return;
                        onChange({ ...contract, status });
                     }}
                     value={contract.status}
                  >
                     <SelectTrigger>
                        <SelectValue />
                     </SelectTrigger>
                     <SelectContent>
                        <SelectItem value="draft">Rascunho</SelectItem>
                        <SelectItem value="active">Ativo</SelectItem>
                        <SelectItem value="paused">Pausado</SelectItem>
                        <SelectItem value="ended">Encerrado</SelectItem>
                     </SelectContent>
                  </Select>
               </Field>
            </PanelSection>

            <PanelSection title="Próximas cobranças">
               <div className="flex flex-col gap-2">
                  {charges.slice(0, 4).map((charge) => (
                     <div
                        className="flex items-center justify-between gap-4 rounded-md border p-2 text-sm"
                        key={charge.id}
                     >
                        <div className="flex flex-col">
                           <span className="font-medium">
                              {charge.competence}
                           </span>
                           <span className="text-xs text-muted-foreground">
                              {formatDate(charge.dueDate)}
                           </span>
                        </div>
                        <span className="font-medium tabular-nums">
                           {contract.direction === "despesa" ? "-" : ""}
                           {formatCurrency(charge.amount)}
                        </span>
                     </div>
                  ))}
               </div>
            </PanelSection>
         </ContextPanelContent>
         <Separator />
         <ContextPanelFooter className="gap-2">
            <div className="flex gap-2">
               <Button
                  className="flex-1"
                  onClick={() => onChange({ ...contract, status: "active" })}
               >
                  <PlayCircle />
                  Ativar
               </Button>
               <Button
                  className="flex-1"
                  onClick={() => onChange({ ...contract, status: "paused" })}
                  variant="outline"
               >
                  <PauseCircle />
                  Pausar
               </Button>
            </div>
            <Button
               onClick={() => {
                  const template = contractTemplates.find(
                     (item) => item.id === contract.templateId,
                  );
                  if (!template) return;
                  onChange({ ...contract, document: template.document });
               }}
               variant="outline"
            >
               <RotateCcw />
               Restaurar modelo
            </Button>
         </ContextPanelFooter>
      </ContextPanel>
   );
}

function PanelSection({
   children,
   title,
}: {
   children: React.ReactNode;
   title: string;
}) {
   return (
      <section className="flex flex-col gap-4">
         <h2 className="text-sm font-semibold">{title}</h2>
         <div className="flex flex-col gap-4">{children}</div>
      </section>
   );
}

function TextField({
   label,
   onChange,
   value,
}: {
   label: string;
   onChange: (value: string) => void;
   value: string;
}) {
   return (
      <Field>
         <FieldLabel>{label}</FieldLabel>
         <Input
            onChange={(event) => onChange(event.target.value)}
            value={value}
         />
      </Field>
   );
}

function TextAreaField({
   label,
   onChange,
   value,
}: {
   label: string;
   onChange: (value: string) => void;
   value: string;
}) {
   return (
      <Field>
         <FieldLabel>{label}</FieldLabel>
         <Textarea
            onChange={(event) => onChange(event.target.value)}
            value={value}
         />
      </Field>
   );
}

function StatusBadge({ status }: { status: ContractStatus }) {
   if (status === "active")
      return <Badge variant="success">{statusLabel(status)}</Badge>;
   if (status === "ended")
      return <Badge variant="destructive">{statusLabel(status)}</Badge>;
   if (status === "paused") return <Badge variant="outline">Pausado</Badge>;
   return <Badge variant="secondary">Rascunho</Badge>;
}

function parseFrequency(value: string): ContractFrequency | undefined {
   if (value === "monthly") return value;
   if (value === "quarterly") return value;
   if (value === "semiannual") return value;
   if (value === "annual") return value;
   return undefined;
}

function parseStatus(value: string): ContractStatus | undefined {
   if (value === "draft") return value;
   if (value === "active") return value;
   if (value === "paused") return value;
   if (value === "ended") return value;
   return undefined;
}

function toDate(value: string) {
   if (!value) return undefined;
   const parsed = dayjs(value);
   if (!parsed.isValid()) return undefined;
   return parsed.toDate();
}

function toIsoDate(value: Date | undefined) {
   if (!value) return "";
   return dayjs(value).format("YYYY-MM-DD");
}
