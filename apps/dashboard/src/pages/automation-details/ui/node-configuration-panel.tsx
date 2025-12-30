import type {
   ActionType,
   CategorySplitConfig,
   CategorySplitMode,
   TriggerType,
} from "@packages/database/schema";
import {
   Alert,
   AlertDescription,
   AlertTitle,
} from "@packages/ui/components/alert";
import { Button } from "@packages/ui/components/button";
import { Combobox } from "@packages/ui/components/combobox";
import {
   Field,
   FieldDescription,
   FieldGroup,
   FieldLabel,
} from "@packages/ui/components/field";
import { Input } from "@packages/ui/components/input";
import { MoneyInput } from "@packages/ui/components/money-input";
import { MultiSelect } from "@packages/ui/components/multi-select";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
import { Skeleton } from "@packages/ui/components/skeleton";
import { Switch } from "@packages/ui/components/switch";
import { Textarea } from "@packages/ui/components/textarea";
import {
   getPercentageRemaining,
   isPercentageSumValid,
} from "@packages/utils/split";
import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, FileText, Tag, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { IconName } from "@/features/icon-selector/lib/available-icons";
import { IconDisplay } from "@/features/icon-selector/ui/icon-display";
import { useTRPC } from "@/integrations/clients";
import {
   validateActionNode,
   validateConditionNode,
} from "../lib/node-validation";
import type {
   ActionNodeData,
   AutomationNode,
   ConditionNodeData,
   TriggerNodeData,
} from "../lib/types";
import {
   ACTION_TYPE_LABELS,
   CONDITION_OPERATOR_LABELS,
   DAYS_OF_WEEK,
   isScheduleTrigger,
   TRANSACTION_FIELDS,
   TRIGGER_TYPE_LABELS,
} from "../lib/types";

type NodeConfigurationPanelProps = {
   node: AutomationNode | null;
   onClose: () => void;
   onUpdate: (nodeId: string, data: Partial<AutomationNode["data"]>) => void;
   activeTab?: "config" | "about" | "filters";
};

export function NodeConfigurationPanel({
   node,
   onClose: _onClose,
   onUpdate,
   activeTab = "config",
}: NodeConfigurationPanelProps) {
   if (!node) return null;

   return (
      <div className="space-y-4">
         {node.type === "trigger" && (
            <TriggerConfigurationForm
               data={node.data as TriggerNodeData}
               nodeId={node.id}
               onUpdate={onUpdate}
            />
         )}
         {node.type === "condition" && (
            <ConditionConfigurationForm
               data={node.data as ConditionNodeData}
               nodeId={node.id}
               onUpdate={onUpdate}
            />
         )}
         {node.type === "action" && (
            <ActionConfigurationForm
               data={node.data as ActionNodeData}
               nodeId={node.id}
               onUpdate={onUpdate}
               activeTab={activeTab}
            />
         )}
      </div>
   );
}

type TriggerConfigurationFormProps = {
   nodeId: string;
   data: TriggerNodeData;
   onUpdate: (nodeId: string, data: Partial<TriggerNodeData>) => void;
};

function TriggerConfigurationForm({
   nodeId,
   data,
   onUpdate,
}: TriggerConfigurationFormProps) {
   const form = useForm({
      defaultValues: {
         triggerType: data.triggerType,
         time: (data.config?.time as string) ?? "09:00",
         timezone: (data.config?.timezone as string) ?? "America/Sao_Paulo",
         dayOfWeek: (data.config?.dayOfWeek as number) ?? 1,
         cronPattern: (data.config?.cronPattern as string) ?? "",
      },
   });

   useEffect(() => {
      form.setFieldValue("triggerType", data.triggerType);
      form.setFieldValue("time", (data.config?.time as string) ?? "09:00");
      form.setFieldValue(
         "timezone",
         (data.config?.timezone as string) ?? "America/Sao_Paulo",
      );
      form.setFieldValue("dayOfWeek", (data.config?.dayOfWeek as number) ?? 1);
      form.setFieldValue(
         "cronPattern",
         (data.config?.cronPattern as string) ?? "",
      );
   }, [data, form]);

   const handleFieldChange = useCallback(
      (field: string, value: unknown) => {
         onUpdate(nodeId, { [field]: value });
      },
      [nodeId, onUpdate],
   );

   const handleConfigChange = useCallback(
      (field: string, value: unknown) => {
         const currentConfig = data.config ?? {};
         onUpdate(nodeId, {
            config: { ...currentConfig, [field]: value } as TriggerNodeData["config"],
         });
      },
      [nodeId, data.config, onUpdate],
   );

   const isSchedule = isScheduleTrigger(data.triggerType);

   return (
      <div className="space-y-4">
         <FieldGroup>
            <form.Field name="triggerType">
               {(field) => (
                  <Field>
                     <FieldLabel htmlFor={field.name}>
                        Tipo de Gatilho
                     </FieldLabel>
                     <Select
                        onValueChange={(value) => {
                           field.handleChange(value as TriggerType);
                           handleFieldChange("triggerType", value);
                        }}
                        value={field.state.value}
                     >
                        <SelectTrigger id={field.name}>
                           <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                           {(
                              Object.keys(TRIGGER_TYPE_LABELS) as TriggerType[]
                           ).map((type) => (
                              <SelectItem key={type} value={type}>
                                 {TRIGGER_TYPE_LABELS[type]}
                              </SelectItem>
                           ))}
                        </SelectContent>
                     </Select>
                  </Field>
               )}
            </form.Field>
         </FieldGroup>

         {isSchedule && (
            <>
               <FieldGroup>
                  <form.Field name="time">
                     {(field) => (
                        <Field>
                           <FieldLabel htmlFor={field.name}>Horário</FieldLabel>
                           <Input
                              id={field.name}
                              type="time"
                              value={field.state.value}
                              onChange={(e) => {
                                 field.handleChange(e.target.value);
                                 handleConfigChange("time", e.target.value);
                              }}
                           />
                           <FieldDescription>
                              Horário de execução do agendamento
                           </FieldDescription>
                        </Field>
                     )}
                  </form.Field>
               </FieldGroup>

               <FieldGroup>
                  <form.Field name="timezone">
                     {(field) => (
                        <Field>
                           <FieldLabel htmlFor={field.name}>
                              Fuso Horário
                           </FieldLabel>
                           <Select
                              value={field.state.value}
                              onValueChange={(v) => {
                                 field.handleChange(v);
                                 handleConfigChange("timezone", v);
                              }}
                           >
                              <SelectTrigger id={field.name}>
                                 <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                 <SelectItem value="America/Sao_Paulo">
                                    Brasília (GMT-3)
                                 </SelectItem>
                                 <SelectItem value="America/New_York">
                                    Nova York (GMT-5)
                                 </SelectItem>
                                 <SelectItem value="Europe/London">
                                    Londres (GMT+0)
                                 </SelectItem>
                                 <SelectItem value="UTC">UTC</SelectItem>
                              </SelectContent>
                           </Select>
                        </Field>
                     )}
                  </form.Field>
               </FieldGroup>

               {data.triggerType === "schedule.weekly" && (
                  <FieldGroup>
                     <form.Field name="dayOfWeek">
                        {(field) => (
                           <Field>
                              <FieldLabel htmlFor={field.name}>
                                 Dia da Semana
                              </FieldLabel>
                              <Select
                                 value={String(field.state.value)}
                                 onValueChange={(v) => {
                                    const num = Number(v);
                                    field.handleChange(num);
                                    handleConfigChange("dayOfWeek", num);
                                 }}
                              >
                                 <SelectTrigger id={field.name}>
                                    <SelectValue />
                                 </SelectTrigger>
                                 <SelectContent>
                                    {DAYS_OF_WEEK.map((day) => (
                                       <SelectItem
                                          key={day.value}
                                          value={String(day.value)}
                                       >
                                          {day.label}
                                       </SelectItem>
                                    ))}
                                 </SelectContent>
                              </Select>
                           </Field>
                        )}
                     </form.Field>
                  </FieldGroup>
               )}

               {data.triggerType === "schedule.custom" && (
                  <FieldGroup>
                     <form.Field name="cronPattern">
                        {(field) => (
                           <Field>
                              <FieldLabel htmlFor={field.name}>
                                 Padrão CRON
                              </FieldLabel>
                              <Input
                                 id={field.name}
                                 placeholder="0 9 * * 1-5"
                                 value={field.state.value}
                                 onChange={(e) => {
                                    field.handleChange(e.target.value);
                                    handleConfigChange(
                                       "cronPattern",
                                       e.target.value,
                                    );
                                 }}
                              />
                              <FieldDescription>
                                 Formato: minuto hora dia mês dia-da-semana
                              </FieldDescription>
                           </Field>
                        )}
                     </form.Field>
                  </FieldGroup>
               )}
            </>
         )}
      </div>
   );
}

type ConditionConfigurationFormProps = {
   nodeId: string;
   data: ConditionNodeData;
   onUpdate: (nodeId: string, data: Partial<ConditionNodeData>) => void;
};

function ConditionConfigurationForm({
   nodeId,
   data,
   onUpdate,
}: ConditionConfigurationFormProps) {
   const validation = validateConditionNode(data);

   const form = useForm({
      defaultValues: {
         operator: data.operator,
      },
   });

   useEffect(() => {
      form.setFieldValue("operator", data.operator);
   }, [data.operator, form]);

   const handleFieldChange = useCallback(
      (field: string, value: unknown) => {
         onUpdate(nodeId, { [field]: value });
      },
      [nodeId, onUpdate],
   );

   const handleAddCondition = useCallback(() => {
      const newCondition = {
         field: "description",
         id: crypto.randomUUID(),
         operator: "contains" as const,
         type: "string" as const,
         value: "",
      };
      onUpdate(nodeId, { conditions: [...data.conditions, newCondition] });
   }, [nodeId, data.conditions, onUpdate]);

   const handleRemoveCondition = useCallback(
      (conditionId: string) => {
         onUpdate(nodeId, {
            conditions: data.conditions.filter((c) => c.id !== conditionId),
         });
      },
      [nodeId, data.conditions, onUpdate],
   );

   const handleConditionFieldChange = useCallback(
      (conditionId: string, field: string) => {
         onUpdate(nodeId, {
            conditions: data.conditions.map((c) =>
               c.id === conditionId ? { ...c, field } : c,
            ),
         });
      },
      [nodeId, data.conditions, onUpdate],
   );

   const handleConditionOperatorChange = useCallback(
      (conditionId: string, operator: string) => {
         onUpdate(nodeId, {
            conditions: data.conditions.map((c) =>
               c.id === conditionId
                  ? { ...c, operator: operator as typeof c.operator }
                  : c,
            ),
         });
      },
      [nodeId, data.conditions, onUpdate],
   );

   const handleConditionValueChange = useCallback(
      (conditionId: string, value: string) => {
         onUpdate(nodeId, {
            conditions: data.conditions.map((c) =>
               c.id === conditionId ? { ...c, value } : c,
            ),
         });
      },
      [nodeId, data.conditions, onUpdate],
   );

   return (
      <div className="space-y-4">
         {!validation.valid && (
            <Alert variant="destructive">
               <AlertTriangle className="size-4" />
               <AlertTitle>Configuração incompleta</AlertTitle>
               <AlertDescription>
                  {validation.errors.map((error) => (
                     <div key={error}>{error}</div>
                  ))}
               </AlertDescription>
            </Alert>
         )}

         <FieldGroup>
            <form.Field name="operator">
               {(field) => (
                  <Field>
                     <FieldLabel htmlFor={field.name}>
                        Operador Lógico
                     </FieldLabel>
                     <Select
                        onValueChange={(value) => {
                           field.handleChange(value as "AND" | "OR");
                           handleFieldChange("operator", value);
                        }}
                        value={field.state.value}
                     >
                        <SelectTrigger id={field.name}>
                           <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                           <SelectItem value="AND">
                              E (todas devem corresponder)
                           </SelectItem>
                           <SelectItem value="OR">
                              OU (qualquer pode corresponder)
                           </SelectItem>
                        </SelectContent>
                     </Select>
                  </Field>
               )}
            </form.Field>
         </FieldGroup>

         <div className="space-y-2">
            <div className="flex items-center justify-between">
               <FieldLabel>Condições</FieldLabel>
               <Button onClick={handleAddCondition} size="sm" variant="outline">
                  Adicionar
               </Button>
            </div>
            {data.conditions.map((condition) => (
               <div
                  className="space-y-2 rounded-md border p-2"
                  key={condition.id}
               >
                  <div className="flex items-center justify-between">
                     <span className="text-xs text-muted-foreground">
                        Condição
                     </span>
                     <Button
                        className="size-6"
                        onClick={() => handleRemoveCondition(condition.id)}
                        size="icon"
                        variant="ghost"
                     >
                        <X className="size-3" />
                     </Button>
                  </div>
                  <Select
                     onValueChange={(v) =>
                        handleConditionFieldChange(condition.id, v)
                     }
                     value={condition.field}
                  >
                     <SelectTrigger className="h-8">
                        <SelectValue placeholder="Campo" />
                     </SelectTrigger>
                     <SelectContent>
                        {TRANSACTION_FIELDS.map((field) => (
                           <SelectItem key={field.value} value={field.value}>
                              {field.label}
                           </SelectItem>
                        ))}
                     </SelectContent>
                  </Select>
                  <Select
                     onValueChange={(v) =>
                        handleConditionOperatorChange(condition.id, v)
                     }
                     value={condition.operator}
                  >
                     <SelectTrigger className="h-8">
                        <SelectValue placeholder="Operador" />
                     </SelectTrigger>
                     <SelectContent>
                        {Object.entries(CONDITION_OPERATOR_LABELS).map(
                           ([key, label]) => (
                              <SelectItem key={key} value={key}>
                                 {label}
                              </SelectItem>
                           ),
                        )}
                     </SelectContent>
                  </Select>
                  <Input
                     className="h-8"
                     onChange={(e) =>
                        handleConditionValueChange(condition.id, e.target.value)
                     }
                     placeholder="Valor"
                     value={String(condition.value ?? "")}
                  />
               </div>
            ))}
         </div>
      </div>
   );
}

type ActionConfigurationFormProps = {
   nodeId: string;
   data: ActionNodeData;
   onUpdate: (nodeId: string, data: Partial<ActionNodeData>) => void;
   activeTab?: "config" | "about" | "filters";
};

function ActionConfigurationForm({
   nodeId,
   data,
   onUpdate,
   activeTab = "config",
}: ActionConfigurationFormProps) {
   const validation = validateActionNode(data);
   const trpc = useTRPC();

   const { data: tags = [], isLoading: tagsLoading } = useQuery(
      trpc.tags.getAll.queryOptions(),
   );
   const { data: categories = [], isLoading: categoriesLoading } = useQuery(
      trpc.categories.getAll.queryOptions(),
   );
   const { data: costCenters = [], isLoading: costCentersLoading } = useQuery(
      trpc.costCenters.getAll.queryOptions(),
   );
   const { data: bankAccounts = [], isLoading: bankAccountsLoading } = useQuery(
      trpc.bankAccounts.getAll.queryOptions(),
   );

   const form = useForm({
      defaultValues: {
         actionType: data.actionType,
         body: (data.config.body as string) ?? "",
         categoryId: (data.config.categoryId as string) ?? "",
         continueOnError: data.continueOnError ?? false,
         costCenterId: (data.config.costCenterId as string) ?? "",
         customEmail: (data.config.customEmail as string) ?? "",
         mode: (data.config.mode as string) ?? "replace",
         reason: (data.config.reason as string) ?? "",
         subject: (data.config.subject as string) ?? "",
         tagIds: (data.config.tagIds as string[]) ?? [],
         title: (data.config.title as string) ?? "",
         to: (data.config.to as string) ?? "owner",
         toBankAccountId: (data.config.toBankAccountId as string) ?? "",
         value: (data.config.value as string) ?? "",
         // Bills digest fields
         recipients: (data.config.recipients as string) ?? "owner",
         detailLevel: (data.config.detailLevel as string) ?? "detailed",
         includePending: (data.config.includePending as boolean) ?? true,
         includeOverdue: (data.config.includeOverdue as boolean) ?? true,
         daysAhead: (data.config.daysAhead as number) ?? 7,
         billTypes: (data.config.billTypes as string[]) ?? ["expense"],
      },
   });

   useEffect(() => {
      form.setFieldValue("actionType", data.actionType);
      form.setFieldValue("continueOnError", data.continueOnError ?? false);
      form.setFieldValue("tagIds", (data.config.tagIds as string[]) ?? []);
      form.setFieldValue(
         "categoryId",
         (data.config.categoryId as string) ?? "",
      );
      form.setFieldValue(
         "costCenterId",
         (data.config.costCenterId as string) ?? "",
      );
      form.setFieldValue("mode", (data.config.mode as string) ?? "replace");
      form.setFieldValue("value", (data.config.value as string) ?? "");
      form.setFieldValue("title", (data.config.title as string) ?? "");
      form.setFieldValue("body", (data.config.body as string) ?? "");
      form.setFieldValue("to", (data.config.to as string) ?? "owner");
      form.setFieldValue(
         "customEmail",
         (data.config.customEmail as string) ?? "",
      );
      form.setFieldValue("subject", (data.config.subject as string) ?? "");
      form.setFieldValue("reason", (data.config.reason as string) ?? "");
      form.setFieldValue(
         "toBankAccountId",
         (data.config.toBankAccountId as string) ?? "",
      );
      // Bills digest fields
      form.setFieldValue(
         "recipients",
         (data.config.recipients as string) ?? "owner",
      );
      form.setFieldValue(
         "detailLevel",
         (data.config.detailLevel as string) ?? "detailed",
      );
      form.setFieldValue(
         "includePending",
         (data.config.includePending as boolean) ?? true,
      );
      form.setFieldValue(
         "includeOverdue",
         (data.config.includeOverdue as boolean) ?? true,
      );
      form.setFieldValue("daysAhead", (data.config.daysAhead as number) ?? 7);
      form.setFieldValue(
         "billTypes",
         (data.config.billTypes as string[]) ?? ["expense"],
      );
   }, [data, form]);

   const handleFieldChange = useCallback(
      (field: string, value: unknown) => {
         if (field === "continueOnError") {
            onUpdate(nodeId, { continueOnError: value as boolean });
         } else if (field === "actionType") {
            const newType = value as ActionType;
            onUpdate(nodeId, {
               actionType: newType,
               config: {},
               label: ACTION_TYPE_LABELS[newType],
            });
         } else {
            onUpdate(nodeId, { config: { ...data.config, [field]: value } });
         }
      },
      [nodeId, data.config, onUpdate],
   );

   const tagOptions = tags.map((tag) => ({
      icon: <Tag className="size-4" style={{ color: tag.color }} />,
      label: tag.name,
      value: tag.id,
   }));

   const costCenterOptions = [
      { label: "Nenhum", value: "" },
      ...costCenters.map((cc) => ({
         label: cc.code ? `${cc.name} (${cc.code})` : cc.name,
         value: cc.id,
      })),
   ];

   const bankAccountOptions = bankAccounts.map((account) => ({
      label: account.name ?? "Sem nome",
      value: account.id,
   }));

   // Check if this action type has special tabs
   const hasSpecialTabs =
      data.actionType === "fetch_bills_report" ||
      data.actionType === "send_bills_digest" ||
      data.actionType === "format_data" ||
      data.actionType === "send_email";

   // Content for "Sobre" tab
   const renderAboutContent = () => {
      const aboutContent = {
         fetch_bills_report: {
            title: "Buscar Relatório de Contas",
            description:
               "Esta ação busca contas a pagar/receber e disponibiliza os dados para as próximas ações. Use em conjunto com 'Formatar Dados' e 'Enviar E-mail' para enviar relatórios personalizados.",
            howTo: [
               "Configure os filtros na aba 'Filtros'",
               "Adicione 'Formatar Dados' para gerar CSV, HTML ou JSON",
               "Adicione 'Enviar E-mail' com 'Incluir Anexo' ativado",
            ],
         },
         send_bills_digest: {
            title: "Enviar Resumo de Contas",
            description:
               "Esta ação busca contas a pagar/receber e envia um resumo formatado por e-mail usando o template de resumo de contas.",
            howTo: [
               "Configure os destinatários na aba 'Geral'",
               "Configure os filtros na aba 'Filtros'",
               "O e-mail será enviado automaticamente quando executado",
            ],
         },
         format_data: {
            title: "Formatar Dados",
            description:
               "Esta ação transforma dados de ações anteriores em diferentes formatos (CSV, HTML, JSON). Os dados formatados podem ser usados como anexo em e-mails.",
            howTo: [
               "Adicione uma ação que retorna dados antes (ex: 'Buscar Relatório de Contas')",
               "Escolha o formato desejado (CSV, HTML, JSON)",
               "Configure o nome do arquivo com variáveis: {{period}}, {{date}}",
               "Adicione 'Enviar E-mail' após com 'Incluir Anexo' ativado",
            ],
            templates: {
               fileName: [
                  "{{period}} - Substitui pelo período do relatório",
                  "{{date}} - Substitui pela data atual (YYYY-MM-DD)",
                  "{{timestamp}} - Substitui pelo timestamp atual",
               ],
            },
         },
         send_email: {
            title: "Enviar E-mail",
            description:
               "Envia e-mails personalizados ou usando templates pré-definidos. Suporta anexos de ações anteriores como 'Formatar Dados'.",
            howTo: [
               "Escolha o modo: Personalizado ou Resumo de Contas",
               "Configure o destinatário (dono ou e-mail personalizado)",
               "Para anexar arquivos, ative 'Incluir Anexo'",
               "Os anexos vêm da ação 'Formatar Dados'",
            ],
            templates: {
               body: [
                  "{{description}} - Descrição da transação",
                  "{{amount}} - Valor da transação",
                  "{{date}} - Data da transação",
                  "{{bankAccount.name}} - Nome da conta bancária",
                  "{{category.name}} - Nome da categoria",
               ],
            },
         },
      };

      const content = aboutContent[data.actionType as keyof typeof aboutContent];
      if (!content) return null;

      return (
         <div className="space-y-4">
            <Alert>
               <FileText className="size-4" />
               <AlertTitle>{content.title}</AlertTitle>
               <AlertDescription>{content.description}</AlertDescription>
            </Alert>

            <div className="rounded-lg border p-4 space-y-2">
               <p className="text-sm font-medium">Como usar</p>
               <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  {content.howTo.map((step) => (
                     <li key={step}>{step}</li>
                  ))}
               </ol>
            </div>

            {"templates" in content && content.templates && (
               <div className="rounded-lg border p-4 space-y-2">
                  <p className="text-sm font-medium">Variáveis disponíveis</p>
                  <div className="text-sm text-muted-foreground space-y-2">
                     {Object.entries(content.templates).map(([key, vars]) => (
                        <div key={key} className="space-y-1">
                           <p className="font-medium text-foreground capitalize">{key}:</p>
                           <ul className="list-disc list-inside pl-2">
                              {(vars as string[]).map((v: string) => (
                                 <li key={v} className="font-mono text-xs">{v}</li>
                              ))}
                           </ul>
                        </div>
                     ))}
                  </div>
               </div>
            )}
         </div>
      );
   };

   // Content for "Filtros" tab
   const renderFiltersContent = () => (
      <div className="space-y-4">
         <FieldGroup>
            <form.Field name="billTypes">
               {(field) => (
                  <Field>
                     <FieldLabel htmlFor={field.name}>
                        Tipos de Conta
                     </FieldLabel>
                     <MultiSelect
                        className="w-full"
                        emptyMessage="Nenhum tipo selecionado"
                        onChange={(val) => {
                           field.handleChange(val);
                           handleFieldChange("billTypes", val);
                        }}
                        options={[
                           { label: "Despesas (a pagar)", value: "expense" },
                           { label: "Receitas (a receber)", value: "income" },
                        ]}
                        placeholder="Selecione os tipos..."
                        selected={field.state.value}
                     />
                  </Field>
               )}
            </form.Field>
         </FieldGroup>

         <FieldGroup>
            <form.Field name="daysAhead">
               {(field) => (
                  <Field>
                     <FieldLabel htmlFor={field.name}>
                        Período de Previsão
                     </FieldLabel>
                     <div className="flex items-center gap-2">
                        <Input
                           id={field.name}
                           type="number"
                           min={1}
                           max={90}
                           className="w-20"
                           value={field.state.value}
                           onChange={(e) => {
                              const num = Number(e.target.value);
                              field.handleChange(num);
                              handleFieldChange("daysAhead", num);
                           }}
                        />
                        <span className="text-sm text-muted-foreground">
                          dias à frente
                        </span>
                     </div>
                     <FieldDescription>
                        Incluir contas com vencimento nos próximos X dias
                     </FieldDescription>
                  </Field>
               )}
            </form.Field>
         </FieldGroup>

         <div className="space-y-3 rounded-lg border p-3">
            <p className="text-sm font-medium">Incluir no relatório</p>

            <div className="flex items-center justify-between">
               <div>
                  <p className="text-sm">Contas Pendentes</p>
                  <p className="text-xs text-muted-foreground">
                     Contas a vencer no período
                  </p>
               </div>
               <form.Field name="includePending">
                  {(field) => (
                     <Switch
                        checked={field.state.value}
                        onCheckedChange={(checked) => {
                           field.handleChange(checked);
                           handleFieldChange("includePending", checked);
                        }}
                     />
                  )}
               </form.Field>
            </div>

            <div className="flex items-center justify-between">
               <div>
                  <p className="text-sm">Contas Vencidas</p>
                  <p className="text-xs text-muted-foreground">
                     Contas atrasadas não pagas
                  </p>
               </div>
               <form.Field name="includeOverdue">
                  {(field) => (
                     <Switch
                        checked={field.state.value}
                        onCheckedChange={(checked) => {
                           field.handleChange(checked);
                           handleFieldChange("includeOverdue", checked);
                        }}
                     />
                  )}
               </form.Field>
            </div>
         </div>
      </div>
   );

   // Actions that have a Filters tab (for configuring bill filters)
   const hasFiltersTab =
      data.actionType === "fetch_bills_report" ||
      data.actionType === "send_bills_digest";

   // Handle special tabs
   if (hasSpecialTabs && activeTab === "about") {
      return renderAboutContent();
   }

   if (hasFiltersTab && activeTab === "filters") {
      return renderFiltersContent();
   }

   // Default "config" tab content
   return (
      <div className="space-y-4">
         {!validation.valid && (
            <Alert variant="destructive">
               <AlertTriangle className="size-4" />
               <AlertTitle>Configuração incompleta</AlertTitle>
               <AlertDescription>
                  {validation.errors.map((error) => (
                     <div key={error}>{error}</div>
                  ))}
               </AlertDescription>
            </Alert>
         )}

         <FieldGroup>
            <form.Field name="actionType">
               {(field) => (
                  <Field>
                     <FieldLabel htmlFor={field.name}>Tipo de Ação</FieldLabel>
                     <Select
                        onValueChange={(value) => {
                           field.handleChange(value as ActionType);
                           handleFieldChange("actionType", value);
                        }}
                        value={field.state.value}
                     >
                        <SelectTrigger id={field.name}>
                           <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                           {(
                              Object.keys(ACTION_TYPE_LABELS) as ActionType[]
                           ).map((type) => (
                              <SelectItem key={type} value={type}>
                                 {ACTION_TYPE_LABELS[type]}
                              </SelectItem>
                           ))}
                        </SelectContent>
                     </Select>
                  </Field>
               )}
            </form.Field>
         </FieldGroup>

         {(data.actionType === "add_tag" ||
            data.actionType === "remove_tag") && (
            <FieldGroup>
               <form.Field name="tagIds">
                  {(field) => (
                     <Field>
                        <FieldLabel htmlFor={field.name}>
                           {data.actionType === "add_tag"
                              ? "Tags para adicionar"
                              : "Tags para remover"}
                        </FieldLabel>
                        {tagsLoading ? (
                           <Skeleton className="h-10 w-full" />
                        ) : (
                           <MultiSelect
                              className="w-full"
                              emptyMessage="Nenhuma tag encontrada"
                              onChange={(val) => {
                                 field.handleChange(val);
                                 handleFieldChange("tagIds", val);
                              }}
                              options={tagOptions}
                              placeholder="Selecione as tags..."
                              selected={field.state.value}
                           />
                        )}
                        <FieldDescription>
                           {data.actionType === "add_tag"
                              ? "Selecione as tags que serão adicionadas à transação"
                              : "Selecione as tags que serão removidas da transação"}
                        </FieldDescription>
                     </Field>
                  )}
               </form.Field>
            </FieldGroup>
         )}

         {data.actionType === "set_category" && (
            <CategorySplitConfiguration
               categories={categories}
               categoriesLoading={categoriesLoading}
               config={data.config}
               onUpdate={(updates) =>
                  onUpdate(nodeId, { config: { ...data.config, ...updates } })
               }
            />
         )}

         {data.actionType === "set_cost_center" && (
            <FieldGroup>
               <form.Field name="costCenterId">
                  {(field) => (
                     <Field>
                        <FieldLabel htmlFor={field.name}>
                           Centro de Custo
                        </FieldLabel>
                        {costCentersLoading ? (
                           <Skeleton className="h-10 w-full" />
                        ) : (
                           <Combobox
                              className="w-full"
                              emptyMessage="Nenhum centro de custo encontrado"
                              onValueChange={(value) => {
                                 field.handleChange(value);
                                 handleFieldChange("costCenterId", value);
                              }}
                              options={costCenterOptions}
                              placeholder="Selecione o centro de custo..."
                              searchPlaceholder="Buscar centro de custo..."
                              value={field.state.value}
                           />
                        )}
                        <FieldDescription>
                           O centro de custo que será definido para a transação
                        </FieldDescription>
                     </Field>
                  )}
               </form.Field>
            </FieldGroup>
         )}

         {data.actionType === "update_description" && (
            <>
               <FieldGroup>
                  <form.Field name="mode">
                     {(field) => (
                        <Field>
                           <FieldLabel htmlFor={field.name}>Modo</FieldLabel>
                           <Select
                              onValueChange={(v) => {
                                 field.handleChange(v);
                                 handleFieldChange("mode", v);
                              }}
                              value={field.state.value}
                           >
                              <SelectTrigger id={field.name}>
                                 <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                 <SelectItem value="replace">
                                    Substituir
                                 </SelectItem>
                                 <SelectItem value="append">
                                    Adicionar ao final
                                 </SelectItem>
                                 <SelectItem value="prepend">
                                    Adicionar ao início
                                 </SelectItem>
                              </SelectContent>
                           </Select>
                        </Field>
                     )}
                  </form.Field>
               </FieldGroup>
               <FieldGroup>
                  <form.Field name="value">
                     {(field) => (
                        <Field>
                           <FieldLabel htmlFor={field.name}>Valor</FieldLabel>
                           <Textarea
                              id={field.name}
                              onBlur={field.handleBlur}
                              onChange={(e) => {
                                 field.handleChange(e.target.value);
                                 handleFieldChange("value", e.target.value);
                              }}
                              placeholder="Nova descrição ou padrão"
                              value={field.state.value}
                           />
                        </Field>
                     )}
                  </form.Field>
               </FieldGroup>
            </>
         )}

         {data.actionType === "send_push_notification" && (
            <>
               <FieldGroup>
                  <form.Field name="title">
                     {(field) => (
                        <Field>
                           <FieldLabel htmlFor={field.name}>Título</FieldLabel>
                           <Input
                              id={field.name}
                              onBlur={field.handleBlur}
                              onChange={(e) => {
                                 field.handleChange(e.target.value);
                                 handleFieldChange("title", e.target.value);
                              }}
                              placeholder="Título da notificação"
                              value={field.state.value}
                           />
                        </Field>
                     )}
                  </form.Field>
               </FieldGroup>
               <FieldGroup>
                  <form.Field name="body">
                     {(field) => (
                        <Field>
                           <FieldLabel htmlFor={field.name}>Corpo</FieldLabel>
                           <Textarea
                              id={field.name}
                              onBlur={field.handleBlur}
                              onChange={(e) => {
                                 field.handleChange(e.target.value);
                                 handleFieldChange("body", e.target.value);
                              }}
                              placeholder="Corpo da notificação"
                              value={field.state.value}
                           />
                        </Field>
                     )}
                  </form.Field>
               </FieldGroup>
            </>
         )}

         {data.actionType === "send_email" && (
            <>
               <FieldGroup>
                  <form.Field name="to">
                     {(field) => (
                        <Field>
                           <FieldLabel htmlFor={field.name}>Para</FieldLabel>
                           <Select
                              onValueChange={(v) => {
                                 field.handleChange(v);
                                 handleFieldChange("to", v);
                              }}
                              value={field.state.value}
                           >
                              <SelectTrigger id={field.name}>
                                 <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                 <SelectItem value="owner">
                                    Proprietário da Organização
                                 </SelectItem>
                                 <SelectItem value="custom">
                                    E-mail Personalizado
                                 </SelectItem>
                              </SelectContent>
                           </Select>
                        </Field>
                     )}
                  </form.Field>
               </FieldGroup>
               {data.config.to === "custom" && (
                  <FieldGroup>
                     <form.Field name="customEmail">
                        {(field) => (
                           <Field>
                              <FieldLabel htmlFor={field.name}>
                                 E-mail Personalizado
                              </FieldLabel>
                              <Input
                                 id={field.name}
                                 onBlur={field.handleBlur}
                                 onChange={(e) => {
                                    field.handleChange(e.target.value);
                                    handleFieldChange(
                                       "customEmail",
                                       e.target.value,
                                    );
                                 }}
                                 placeholder="email@exemplo.com"
                                 value={field.state.value}
                              />
                           </Field>
                        )}
                     </form.Field>
                  </FieldGroup>
               )}
               <FieldGroup>
                  <form.Field name="subject">
                     {(field) => (
                        <Field>
                           <FieldLabel htmlFor={field.name}>Assunto</FieldLabel>
                           <Input
                              id={field.name}
                              onBlur={field.handleBlur}
                              onChange={(e) => {
                                 field.handleChange(e.target.value);
                                 handleFieldChange("subject", e.target.value);
                              }}
                              placeholder="Assunto do e-mail"
                              value={field.state.value}
                           />
                        </Field>
                     )}
                  </form.Field>
               </FieldGroup>
               <FieldGroup>
                  <form.Field name="body">
                     {(field) => (
                        <Field>
                           <FieldLabel htmlFor={field.name}>Corpo</FieldLabel>
                           <Textarea
                              id={field.name}
                              onBlur={field.handleBlur}
                              onChange={(e) => {
                                 field.handleChange(e.target.value);
                                 handleFieldChange("body", e.target.value);
                              }}
                              placeholder="Corpo do e-mail"
                              value={field.state.value}
                           />
                        </Field>
                     )}
                  </form.Field>
               </FieldGroup>
            </>
         )}

         {data.actionType === "mark_as_transfer" && (
            <FieldGroup>
               <form.Field name="toBankAccountId">
                  {(field) => (
                     <Field>
                        <FieldLabel htmlFor={field.name}>
                           Conta Destino
                        </FieldLabel>
                        {bankAccountsLoading ? (
                           <Skeleton className="h-10 w-full" />
                        ) : (
                           <Combobox
                              className="w-full"
                              emptyMessage="Nenhuma conta encontrada"
                              onValueChange={(value) => {
                                 field.handleChange(value);
                                 handleFieldChange("toBankAccountId", value);
                              }}
                              options={bankAccountOptions}
                              placeholder="Selecione a conta destino..."
                              searchPlaceholder="Buscar conta..."
                              value={field.state.value}
                           />
                        )}
                        <FieldDescription>
                           A conta para onde a transferência será feita
                        </FieldDescription>
                     </Field>
                  )}
               </form.Field>
            </FieldGroup>
         )}

         {data.actionType === "stop_execution" && (
            <FieldGroup>
               <form.Field name="reason">
                  {(field) => (
                     <Field>
                        <FieldLabel htmlFor={field.name}>Motivo</FieldLabel>
                        <Input
                           id={field.name}
                           onBlur={field.handleBlur}
                           onChange={(e) => {
                              field.handleChange(e.target.value);
                              handleFieldChange("reason", e.target.value);
                           }}
                           placeholder="Por que parar a execução?"
                           value={field.state.value}
                        />
                     </Field>
                  )}
               </form.Field>
            </FieldGroup>
         )}

         {data.actionType === "send_bills_digest" && (
            <>
               <FieldGroup>
                  <form.Field name="recipients">
                     {(field) => (
                        <Field>
                           <FieldLabel htmlFor={field.name}>
                              Destinatários
                           </FieldLabel>
                           <Select
                              value={field.state.value}
                              onValueChange={(v) => {
                                 field.handleChange(v);
                                 handleFieldChange("recipients", v);
                              }}
                           >
                              <SelectTrigger id={field.name}>
                                 <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                 <SelectItem value="owner">
                                    Dono da Organização
                                 </SelectItem>
                                 <SelectItem value="all_members">
                                    Todos os Membros
                                 </SelectItem>
                              </SelectContent>
                           </Select>
                           <FieldDescription>
                              Quem receberá o e-mail com o resumo das contas
                           </FieldDescription>
                        </Field>
                     )}
                  </form.Field>
               </FieldGroup>

               <FieldGroup>
                  <form.Field name="detailLevel">
                     {(field) => (
                        <Field>
                           <FieldLabel htmlFor={field.name}>
                              Nível de Detalhe
                           </FieldLabel>
                           <Select
                              value={field.state.value}
                              onValueChange={(v) => {
                                 field.handleChange(v);
                                 handleFieldChange("detailLevel", v);
                              }}
                           >
                              <SelectTrigger id={field.name}>
                                 <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                 <SelectItem value="summary">
                                    Resumo (apenas totais)
                                 </SelectItem>
                                 <SelectItem value="detailed">
                                    Detalhado (lista de contas)
                                 </SelectItem>
                                 <SelectItem value="full">
                                    Completo (com descrições)
                                 </SelectItem>
                              </SelectContent>
                           </Select>
                           <FieldDescription>
                              Define quanta informação será incluída no e-mail
                           </FieldDescription>
                        </Field>
                     )}
                  </form.Field>
               </FieldGroup>
            </>
         )}

         {/* fetch_bills_report doesn't need config tab content - it's all in About/Filters */}

         <div className="flex items-center justify-between rounded-md border p-3">
            <div>
               <FieldLabel className="font-medium">
                  Continuar em caso de erro
               </FieldLabel>
               <p className="text-xs text-muted-foreground">
                  Continuar com as próximas ações se esta falhar
               </p>
            </div>
            <form.Field name="continueOnError">
               {(field) => (
                  <Switch
                     checked={field.state.value}
                     onCheckedChange={(checked) => {
                        field.handleChange(checked);
                        handleFieldChange("continueOnError", checked);
                     }}
                  />
               )}
            </form.Field>
         </div>
      </div>
   );
}

type CategorySplitConfigurationProps = {
   categories: {
      id: string;
      name: string;
      color: string;
      icon: string | null;
   }[];
   categoriesLoading: boolean;
   config: {
      categoryIds?: string[];
      categorySplitMode?: CategorySplitMode;
      categorySplits?: CategorySplitConfig[];
      dynamicSplitPattern?: string;
   };
   onUpdate: (
      updates: Partial<CategorySplitConfigurationProps["config"]>,
   ) => void;
};

const EMPTY_SPLITS: CategorySplitConfig[] = [];
const EMPTY_IDS: string[] = [];

function CategorySplitConfiguration({
   categories,
   categoriesLoading,
   config,
   onUpdate,
}: CategorySplitConfigurationProps) {
   const mode = config.categorySplitMode ?? "equal";
   const selectedIds = config.categoryIds ?? EMPTY_IDS;
   const dynamicPattern = config.dynamicSplitPattern ?? "";

   const splits = useMemo(
      () => config.categorySplits ?? EMPTY_SPLITS,
      [config.categorySplits],
   );

   const [localSplits, setLocalSplits] =
      useState<CategorySplitConfig[]>(splits);

   useEffect(() => {
      setLocalSplits(splits);
   }, [splits]);

   const handleModeChange = useCallback(
      (newMode: CategorySplitMode) => {
         onUpdate({
            categorySplitMode: newMode,
            categorySplits: newMode === "dynamic" ? [] : localSplits,
         });
      },
      [onUpdate, localSplits],
   );

   const handleCategoryChange = useCallback(
      (newCategoryIds: string[]) => {
         const newSplits = newCategoryIds.map((categoryId) => {
            const existing = localSplits.find(
               (s) => s.categoryId === categoryId,
            );
            if (existing) return existing;
            return { categoryId, value: 0 };
         });
         setLocalSplits(newSplits);
         onUpdate({
            categoryIds: newCategoryIds,
            categorySplits: newSplits,
         });
      },
      [onUpdate, localSplits],
   );

   const handleSplitValueChange = useCallback(
      (categoryId: string, value: number) => {
         const newSplits = localSplits.map((s) =>
            s.categoryId === categoryId ? { ...s, value } : s,
         );
         setLocalSplits(newSplits);
         onUpdate({ categorySplits: newSplits });
      },
      [onUpdate, localSplits],
   );

   const handlePatternChange = useCallback(
      (pattern: string) => {
         onUpdate({ dynamicSplitPattern: pattern });
      },
      [onUpdate],
   );

   const categoryOptions = categories.map((category) => ({
      icon: (
         <div
            className="flex size-4 items-center justify-center rounded"
            style={{ backgroundColor: category.color }}
         >
            <IconDisplay iconName={category.icon as IconName | null} size={10} />
         </div>
      ),
      label: category.name,
      value: category.id,
   }));

   const selectedCategories = categories.filter((c) =>
      selectedIds.includes(c.id),
   );

   const isPercentageMode = mode === "percentage";
   const isFixedMode = mode === "fixed";
   const isDynamicMode = mode === "dynamic";
   const showSplitValues =
      (isPercentageMode || isFixedMode) && selectedIds.length > 1;

   const percentageValid = isPercentageMode
      ? isPercentageSumValid(localSplits)
      : true;
   const percentageRemaining = isPercentageMode
      ? getPercentageRemaining(localSplits)
      : 0;

   return (
      <div className="space-y-4">
         <FieldGroup>
            <Field>
               <FieldLabel>Modo de Categorizacao</FieldLabel>
               <Select
                  onValueChange={(v) =>
                     handleModeChange(v as CategorySplitMode)
                  }
                  value={mode}
               >
                  <SelectTrigger>
                     <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                     <SelectItem value="equal">
                        Categoria Unica / Divisao Igual
                     </SelectItem>
                     <SelectItem value="percentage">Por Percentual</SelectItem>
                     <SelectItem value="fixed">Por Valor Fixo</SelectItem>
                     <SelectItem value="dynamic">
                        Extrair da Descricao
                     </SelectItem>
                  </SelectContent>
               </Select>
               <FieldDescription>
                  {mode === "equal" &&
                     "Selecione uma ou mais categorias. Se multiplas, o valor sera dividido igualmente."}
                  {mode === "percentage" &&
                     "Defina o percentual para cada categoria. A soma deve ser 100%."}
                  {mode === "fixed" &&
                     "Defina valores fixos. Serao ajustados proporcionalmente ao valor da transacao."}
                  {mode === "dynamic" &&
                     'Extrai categorias e percentuais da descricao. Ex: "alimentacao 80% limpeza 20%"'}
               </FieldDescription>
            </Field>
         </FieldGroup>

         {!isDynamicMode && (
            <FieldGroup>
               <Field>
                  <FieldLabel>Categorias</FieldLabel>
                  {categoriesLoading ? (
                     <Skeleton className="h-10 w-full" />
                  ) : (
                     <MultiSelect
                        className="w-full"
                        emptyMessage="Nenhuma categoria encontrada"
                        onChange={handleCategoryChange}
                        options={categoryOptions}
                        placeholder="Selecione as categorias..."
                        selected={selectedIds}
                     />
                  )}
               </Field>
            </FieldGroup>
         )}

         {showSplitValues && (
            <div className="space-y-3 rounded-lg border p-3">
               <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                     {isPercentageMode
                        ? "Percentual por categoria"
                        : "Valor por categoria"}
                  </span>
                  {isPercentageMode && (
                     <span
                        className={`text-sm ${
                           !percentageValid
                              ? "font-medium text-destructive"
                              : localSplits.some((s) => s.value > 0)
                                ? "font-medium text-green-600"
                                : "text-muted-foreground"
                        }`}
                     >
                        {localSplits.every((s) => s.value === 0)
                           ? "Defina os percentuais"
                           : percentageValid
                             ? "Soma = 100%"
                             : percentageRemaining > 0
                               ? `Falta: ${percentageRemaining.toFixed(1)}%`
                               : `Excede: ${Math.abs(percentageRemaining).toFixed(1)}%`}
                     </span>
                  )}
               </div>

               {selectedCategories.map((category) => {
                  const split = localSplits.find(
                     (s) => s.categoryId === category.id,
                  );
                  const value = split?.value ?? 0;

                  return (
                     <div className="flex items-center gap-2" key={category.id}>
                        <div className="flex min-w-[140px] items-center gap-2">
                           <div
                              className="flex size-6 items-center justify-center rounded"
                              style={{ backgroundColor: category.color }}
                           >
                              <IconDisplay
                                 iconName={category.icon as IconName | null}
                                 size={14}
                              />
                           </div>
                           <span className="truncate text-sm">
                              {category.name}
                           </span>
                        </div>

                        {isPercentageMode ? (
                           <div className="flex flex-1 items-center gap-1">
                              <Input
                                 className="flex-1"
                                 max={100}
                                 min={0}
                                 onChange={(e) =>
                                    handleSplitValueChange(
                                       category.id,
                                       Number(e.target.value) || 0,
                                    )
                                 }
                                 placeholder="0"
                                 type="number"
                                 value={value || ""}
                              />
                              <span className="text-sm text-muted-foreground">
                                 %
                              </span>
                           </div>
                        ) : (
                           <MoneyInput
                              className="flex-1"
                              onChange={(v) =>
                                 handleSplitValueChange(category.id, v || 0)
                              }
                              placeholder="0,00"
                              value={value}
                              valueInCents
                           />
                        )}
                     </div>
                  );
               })}
            </div>
         )}

         {isDynamicMode && (
            <FieldGroup>
               <Field>
                  <FieldLabel>Padrao de Extracao (Regex)</FieldLabel>
                  <Input
                     onChange={(e) => handlePatternChange(e.target.value)}
                     placeholder="(\w+)\s+(\d+)%"
                     value={dynamicPattern}
                  />
                  <FieldDescription>
                     Regex para extrair categoria e percentual da descricao. O
                     padrao default captura: "alimentacao 80% limpeza 20%"
                  </FieldDescription>
               </Field>
            </FieldGroup>
         )}
      </div>
   );
}
