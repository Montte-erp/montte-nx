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
import {
   getPercentageRemaining,
   isPercentageSumValid,
} from "@packages/utils/split";
import {
   getAction,
   getActionTabs,
   getFieldsForTab,
} from "@packages/workflows/config/actions";
import type { ActionField } from "@packages/workflows/schemas/action-field.schema";
import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, FileText, X } from "lucide-react";
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
import { DynamicFieldRenderer } from "./dynamic-field-renderer";

type NodeConfigurationPanelProps = {
   node: AutomationNode | null;
   onClose: () => void;
   onUpdate: (nodeId: string, data: Partial<AutomationNode["data"]>) => void;
   activeTab?: string;
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
               activeTab={activeTab}
               data={node.data as ActionNodeData}
               nodeId={node.id}
               onUpdate={onUpdate}
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
            config: {
               ...currentConfig,
               [field]: value,
            } as TriggerNodeData["config"],
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
                              onChange={(e) => {
                                 field.handleChange(e.target.value);
                                 handleConfigChange("time", e.target.value);
                              }}
                              type="time"
                              value={field.state.value}
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
                              onValueChange={(v) => {
                                 field.handleChange(v);
                                 handleConfigChange("timezone", v);
                              }}
                              value={field.state.value}
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
                                 onValueChange={(v) => {
                                    const num = Number(v);
                                    field.handleChange(num);
                                    handleConfigChange("dayOfWeek", num);
                                 }}
                                 value={String(field.state.value)}
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
                                 onChange={(e) => {
                                    field.handleChange(e.target.value);
                                    handleConfigChange(
                                       "cronPattern",
                                       e.target.value,
                                    );
                                 }}
                                 placeholder="0 9 * * 1-5"
                                 value={field.state.value}
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
   activeTab?: string;
};

function ActionConfigurationForm({
   nodeId,
   data,
   onUpdate,
   activeTab = "config",
}: ActionConfigurationFormProps) {
   const validation = validateActionNode(data);
   const trpc = useTRPC();

   // Fetch data needed for CategorySplitConfiguration
   const { data: categories = [], isLoading: categoriesLoading } = useQuery(
      trpc.categories.getAll.queryOptions(),
   );

   const form = useForm({
      defaultValues: {
         actionType: data.actionType,
         continueOnError: data.continueOnError ?? false,
      },
   });

   useEffect(() => {
      form.setFieldValue("actionType", data.actionType);
      form.setFieldValue("continueOnError", data.continueOnError ?? false);
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

   // Get action definition from config
   const actionDefinition = getAction(data.actionType);
   const actionTabs = actionDefinition.tabs ?? [];

   // Check if action has documentation (for "Sobre" tab)
   const hasAboutTab =
      actionDefinition.documentation !== undefined ||
      ["fetch_bills_report", "format_data", "send_email"].includes(
         data.actionType,
      );

   // Check if action has a Filters tab (config-driven)
   const hasFiltersTab = actionTabs.some((tab) => tab.id === "filters");

   // Get fields for the current tab
   const getFieldsToRender = (): ActionField[] => {
      // About and settings tabs don't have dynamic fields
      if (activeTab === "about" || activeTab === "settings") {
         return [];
      }

      const actionTabs = getActionTabs(data.actionType);

      // If action has custom tabs, get fields for the active tab directly
      if (actionTabs.length > 0) {
         return getFieldsForTab(data.actionType, activeTab);
      }

      // No custom tabs defined - return all fields (for "config" tab)
      return actionDefinition.fields;
   };

   // Convert config to allValues format for DynamicFieldRenderer
   const allValues: Record<string, unknown> = data.config ?? {};

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

      const content =
         aboutContent[data.actionType as keyof typeof aboutContent];
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
                        <div className="space-y-1" key={key}>
                           <p className="font-medium text-foreground capitalize">
                              {key}:
                           </p>
                           <ul className="list-disc list-inside pl-2">
                              {(vars as string[]).map((v: string) => (
                                 <li className="font-mono text-xs" key={v}>
                                    {v}
                                 </li>
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

   // Content for "Filtros" tab - render using dynamic fields from config
   const renderFiltersContent = () => {
      const filterFields = getFieldsForTab(data.actionType, "filters");

      if (filterFields.length === 0) {
         // Fallback for actions without explicit filters tab fields
         return null;
      }

      return (
         <div className="space-y-4">
            {filterFields.map((field) => (
               <DynamicFieldRenderer
                  allValues={allValues}
                  field={field}
                  key={field.key}
                  onChange={(value) => handleFieldChange(field.key, value)}
                  value={allValues[field.key]}
               />
            ))}
         </div>
      );
   };

   // Handle special tabs
   if (hasAboutTab && activeTab === "about") {
      return renderAboutContent();
   }

   if (hasFiltersTab && activeTab === "filters") {
      return renderFiltersContent();
   }

   const fieldsToRender = getFieldsToRender();

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

         {/* Dynamic field rendering */}
         {fieldsToRender.map((field) => {
            // Special case: category-split is handled by CategorySplitConfiguration
            if (field.type === "category-split") {
               return (
                  <CategorySplitConfiguration
                     categories={categories}
                     categoriesLoading={categoriesLoading}
                     config={data.config}
                     key={field.key}
                     onUpdate={(updates) =>
                        onUpdate(nodeId, {
                           config: { ...data.config, ...updates },
                        })
                     }
                  />
               );
            }

            return (
               <DynamicFieldRenderer
                  allValues={allValues}
                  field={field}
                  key={field.key}
                  onChange={(value) => handleFieldChange(field.key, value)}
                  value={allValues[field.key]}
               />
            );
         })}

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
            <IconDisplay
               iconName={category.icon as IconName | null}
               size={10}
            />
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
