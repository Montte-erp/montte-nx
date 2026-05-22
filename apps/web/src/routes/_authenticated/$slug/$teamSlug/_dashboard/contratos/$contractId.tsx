import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import { Combobox } from "@packages/ui/components/combobox";
import {
   ContextPanel,
   ContextPanelContent,
   ContextPanelHeader,
   ContextPanelTitle,
} from "@packages/ui/components/context-panel";
import { DatePicker } from "@packages/ui/components/date-picker";
import { BasicNodesKit } from "@packages/ui/components/editor/plugins/basic-nodes-kit";
import { Editor, EditorContainer } from "@packages/ui/components/editor";
import { FixedToolbar } from "@packages/ui/components/fixed-toolbar";
import { Field, FieldLabel } from "@packages/ui/components/field";
import { Input } from "@packages/ui/components/input";
import { MarkToolbarButton } from "@packages/ui/components/mark-toolbar-button";
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
import { Textarea } from "@packages/ui/components/textarea";
import {
   ToolbarButton,
   ToolbarSeparator,
} from "@packages/ui/components/toolbar";
import { toast } from "@packages/ui/hooks/use-toast";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import dayjs from "dayjs";
import {
   Bold,
   Heading1,
   Heading2,
   Italic,
   Quote,
   Save,
   Strikethrough,
   Underline,
} from "lucide-react";
import { Plate, useEditorState, usePlateEditor } from "platejs/react";
import { useEffect, useMemo } from "react";
import { QueryBoundary } from "@/components/query-boundary";
import { orpc } from "@/integrations/orpc/client";
import {
   closeContextPanel,
   openContextPanel,
   useContextPanelInfo,
} from "../../-context-panel/use-context-panel";
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
               description="O contrato não existe no localStorage desta demo."
               onBack={backToList}
               title="Contrato não encontrado"
            />
         </main>
      );
   }

   return (
      <main className="flex flex-1 min-h-0 flex-col gap-4 overflow-hidden">
         <ContractContextPanelRegistration
            contract={contract}
            customers={customersData}
            onChange={updateContract}
            suppliers={suppliersData}
         />
         <DefaultHeader
            description={`${contract.number} · ${getContractPartyName({
               contract,
               customers: customersData,
               suppliers: suppliersData,
            })}`}
            onBack={backToList}
            title={contract.title}
         />
         <div className="flex flex-1 min-h-0">
            <ContractDocumentEditor
               contract={contract}
               customers={customersData}
               onCancel={backToList}
               onChange={updateContract}
               onSave={() => toast.success("Contrato salvo no localStorage.")}
               suppliers={suppliersData}
            />
         </div>
      </main>
   );
}

function ContractContextPanelRegistration({
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
   useContextPanelInfo(() => (
      <ContractContextPanel
         contract={contract}
         customers={customers}
         onChange={onChange}
         suppliers={suppliers}
      />
   ));

   useEffect(() => {
      openContextPanel();
      return closeContextPanel;
   }, []);

   return null;
}

function ContractDocumentEditor({
   contract,
   customers,
   onCancel,
   onChange,
   onSave,
   suppliers,
}: {
   contract: DemoContract;
   customers: typeof initialCustomers;
   onCancel: () => void;
   onChange: (contract: DemoContract) => void;
   onSave: () => void;
   suppliers: typeof initialSuppliers;
}) {
   const renderedDocument = useMemo(
      () => replaceTemplateVariables({ contract, customers, suppliers }),
      [contract, customers, suppliers],
   );
   const editor = usePlateEditor(
      {
         plugins: BasicNodesKit,
         value: renderedDocument,
      },
      [contract.id, contract.templateId],
   );

   return (
      <Plate
         editor={editor}
         onChange={({ value }) =>
            onChange({
               ...contract,
               document: value,
            })
         }
      >
         <section className="flex min-h-0 flex-1 flex-col overflow-hidden border bg-background">
            <ContractEditorToolbar
               onCancel={onCancel}
               onSave={onSave}
               status={contract.status}
            />
            <ScrollArea className="flex-1 min-h-0">
               <EditorContainer className="min-h-[calc(100vh-214px)]">
                  <Editor
                     className="leading-8"
                     placeholder="Escreva o contrato..."
                  />
               </EditorContainer>
            </ScrollArea>
         </section>
      </Plate>
   );
}

function ContractEditorToolbar({
   onCancel,
   onSave,
   status,
}: {
   onCancel: () => void;
   onSave: () => void;
   status: ContractStatus;
}) {
   const editor = useEditorState();

   function toggleBlock(block: "h1" | "h2" | "blockquote") {
      editor.tf.toggleBlock(block, { defaultType: "p" });
      editor.tf.focus();
   }

   return (
      <FixedToolbar className="rounded-none">
         <div className="flex items-center gap-1">
            <StatusBadge status={status} />
            <ToolbarSeparator />
            <MarkToolbarButton nodeType="bold" tooltip="Negrito">
               <Bold />
            </MarkToolbarButton>
            <MarkToolbarButton nodeType="italic" tooltip="Itálico">
               <Italic />
            </MarkToolbarButton>
            <MarkToolbarButton nodeType="underline" tooltip="Sublinhado">
               <Underline />
            </MarkToolbarButton>
            <MarkToolbarButton nodeType="strikethrough" tooltip="Tachado">
               <Strikethrough />
            </MarkToolbarButton>
            <ToolbarSeparator />
            <ToolbarButton onClick={() => toggleBlock("h1")} tooltip="Título 1">
               <Heading1 />
            </ToolbarButton>
            <ToolbarButton onClick={() => toggleBlock("h2")} tooltip="Título 2">
               <Heading2 />
            </ToolbarButton>
            <ToolbarButton
               onClick={() => toggleBlock("blockquote")}
               tooltip="Citação"
            >
               <Quote />
            </ToolbarButton>
         </div>
         <div className="flex items-center gap-2">
            <Button onClick={onCancel} size="sm" variant="outline">
               Cancelar
            </Button>
            <Button onClick={onSave} size="sm">
               <Save />
               Salvar
            </Button>
         </div>
      </FixedToolbar>
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
   return (
      <QueryBoundary
         fallback={
            <ContextPanel className="overflow-hidden">
               <ContextPanelHeader>
                  <ContextPanelTitle>Contexto do contrato</ContextPanelTitle>
               </ContextPanelHeader>
               <ContextPanelContent>
                  <div className="h-8 rounded-md bg-muted" />
                  <div className="h-8 rounded-md bg-muted" />
                  <div className="h-8 rounded-md bg-muted" />
               </ContextPanelContent>
            </ContextPanel>
         }
         errorTitle="Erro ao carregar contexto do contrato"
      >
         <ContractContextPanelContent
            contract={contract}
            customers={customers}
            onChange={onChange}
            suppliers={suppliers}
         />
      </QueryBoundary>
   );
}

function ContractContextPanelContent({
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
   const categoryType = contract.direction === "receita" ? "income" : "expense";
   const { data: categories } = useSuspenseQuery(
      orpc.categories.getAll.queryOptions({ input: { type: categoryType } }),
   );
   const { data: tagsResult } = useSuspenseQuery(
      orpc.tags.getAll.queryOptions({ input: { pageSize: 100 } }),
   );
   const categoryOptions = categories.map((category) => ({
      value: category.id,
      label: category.parentId
         ? `${categories.find((item) => item.id === category.parentId)?.name ?? "Categoria"} / ${category.name}`
         : category.name,
   }));
   const tagOptions = tagsResult.data.map((tag) => ({
      value: tag.id,
      label: tag.name,
   }));
   const selectedCategoryId =
      categoryOptions.find(
         (option) =>
            option.label === contract.billing.category ||
            option.value === contract.billing.category,
      )?.value ?? "";
   const selectedTagId =
      tagOptions.find(
         (option) =>
            option.label === contract.billing.costCenter ||
            option.value === contract.billing.costCenter,
      )?.value ?? "";

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
      <ContextPanel className="overflow-hidden">
         <ContextPanelHeader>
            <ContextPanelTitle>Contexto do contrato</ContextPanelTitle>
         </ContextPanelHeader>
         <ContextPanelContent>
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
                  <ComboboxField
                     emptyMessage="Nenhuma categoria encontrada."
                     label="Categoria"
                     onChange={(value) => {
                        const option = categoryOptions.find(
                           (item) => item.value === value,
                        );
                        onChange({
                           ...contract,
                           billing: {
                              ...contract.billing,
                              category: option?.label ?? "",
                           },
                        });
                     }}
                     options={categoryOptions}
                     placeholder="Selecionar categoria..."
                     searchPlaceholder="Buscar categoria..."
                     value={selectedCategoryId}
                  />
                  <ComboboxField
                     emptyMessage="Nenhum Centro de Custo encontrado."
                     label="Centro de Custo"
                     onChange={(value) => {
                        const option = tagOptions.find(
                           (item) => item.value === value,
                        );
                        onChange({
                           ...contract,
                           billing: {
                              ...contract.billing,
                              costCenter: option?.label ?? "",
                           },
                        });
                     }}
                     options={tagOptions}
                     placeholder="Selecionar Centro de Custo..."
                     searchPlaceholder="Buscar Centro de Custo..."
                     value={selectedTagId}
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
      </ContextPanel>
   );
}

function ComboboxField({
   emptyMessage,
   label,
   onChange,
   options,
   placeholder,
   searchPlaceholder,
   value,
}: {
   emptyMessage: string;
   label: string;
   onChange: (value: string) => void;
   options: Array<{ label: string; value: string }>;
   placeholder: string;
   searchPlaceholder: string;
   value: string;
}) {
   return (
      <Field>
         <FieldLabel>{label}</FieldLabel>
         <Combobox
            className="w-full"
            emptyMessage={emptyMessage}
            onValueChange={onChange}
            options={options}
            placeholder={placeholder}
            searchPlaceholder={searchPlaceholder}
            value={value}
         />
      </Field>
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
      <section className="flex flex-col gap-4 rounded-xl bg-background p-4">
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
