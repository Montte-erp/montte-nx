import type { ReportType } from "@packages/database/schemas/custom-reports";
import {
   Alert,
   AlertDescription,
   AlertTitle,
} from "@packages/ui/components/alert";
import { Button } from "@packages/ui/components/button";
import {
   Choicebox,
   ChoiceboxIndicator,
   ChoiceboxItem,
   ChoiceboxItemDescription,
   ChoiceboxItemHeader,
   ChoiceboxItemTitle,
} from "@packages/ui/components/choicebox";
import { DateRangePickerPopover } from "@packages/ui/components/date-range-picker-popover";
import {
   Field,
   FieldDescription,
   FieldError,
   FieldGroup,
   FieldLabel,
} from "@packages/ui/components/field";
import { Input } from "@packages/ui/components/input";
import { MultiSelect } from "@packages/ui/components/multi-select";
import {
   SheetDescription,
   SheetFooter,
   SheetHeader,
   SheetTitle,
} from "@packages/ui/components/sheet";
import { Slider } from "@packages/ui/components/slider";
import { defineStepper } from "@packages/ui/components/stepper";
import { Textarea } from "@packages/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
   ArrowLeft,
   ArrowRight,
   BarChart3,
   Calculator,
   Check,
   Info,
   PieChart,
   Target,
   TrendingUp,
   Users,
   Wallet,
} from "lucide-react";
import { type FormEvent, useCallback, useMemo } from "react";
import { z } from "zod";
import { usePlanFeatures } from "@/hooks/use-plan-features";
import { useSheet } from "@/hooks/use-sheet";
import { useTRPC } from "@/integrations/clients";
import type { CustomReport } from "@/pages/custom-reports/ui/custom-reports-page";

const reportTypeConfig: Record<
   ReportType,
   { description: string; icon: typeof BarChart3; label: string }
> = {
   budget_vs_actual: {
      description: "Compare orçamento planejado vs gastos reais por categoria",
      icon: Target,
      label: "Budget vs Atual",
   },
   cash_flow_forecast: {
      description:
         "Projeção de fluxo de caixa baseado em contas a pagar/receber",
      icon: Wallet,
      label: "Fluxo de Caixa",
   },
   category_analysis: {
      description:
         "Análise percentual de transações por categoria de receitas e despesas",
      icon: PieChart,
      label: "Análise por Categoria",
   },
   counterparty_analysis: {
      description: "Análise de vendas por cliente e compras por fornecedor",
      icon: Users,
      label: "Análise de Parceiros",
   },
   dre_fiscal: {
      description: "DRE com formato fiscal para fins tributários",
      icon: Calculator,
      label: "DRE Fiscal",
   },
   dre_gerencial: {
      description: "Demonstração de resultado para análise gerencial interna",
      icon: BarChart3,
      label: "DRE Gerencial",
   },
   spending_trends: {
      description: "Tendências de gastos mensais e comparação ano a ano",
      icon: TrendingUp,
      label: "Tendências de Gastos",
   },
};

const steps = [
   { id: "type", title: "Tipo" },
   { id: "period", title: "Período" },
   { id: "filters", title: "Filtros" },
   { id: "details", title: "Detalhes" },
] as const;

const { Stepper } = defineStepper(...steps);

type Option = {
   label: string;
   value: string;
};

type ManageCustomReportFormProps = {
   report?: CustomReport;
};

export function ManageCustomReportForm({
   report,
}: ManageCustomReportFormProps) {
   const trpc = useTRPC();
   const { closeSheet } = useSheet();
   const { canAccessTags, canAccessCostCenters } = usePlanFeatures();
   const isEditMode = !!report;

   const modeTexts = useMemo(() => {
      const createTexts = {
         description: "Crie um novo relatório para análise financeira",
         title: "Criar Relatório",
      };

      const editTexts = {
         description: `Edite o relatório "${report?.name}"`,
         title: "Editar Relatório",
      };

      return isEditMode ? editTexts : createTexts;
   }, [isEditMode, report?.name]);

   const createReportMutation = useMutation(
      trpc.customReports.create.mutationOptions({
         onSuccess: () => {
            closeSheet();
         },
      }),
   );

   const updateReportMutation = useMutation(
      trpc.customReports.update.mutationOptions({
         onSuccess: () => {
            closeSheet();
         },
      }),
   );

   const schema = z.object({
      bankAccountIds: z.array(z.string()),
      categoryIds: z.array(z.string()),
      costCenterIds: z.array(z.string()),
      description: z.string(),
      endDate: z.date(),
      forecastDays: z.number().min(7).max(365),
      name: z.string().min(1, "Nome é obrigatório"),
      startDate: z.date(),
      tagIds: z.array(z.string()),
      type: z.enum([
         "dre_gerencial",
         "dre_fiscal",
         "budget_vs_actual",
         "spending_trends",
         "cash_flow_forecast",
         "counterparty_analysis",
         "category_analysis",
      ]),
   });

   const form = useForm({
      defaultValues: {
         bankAccountIds: [] as string[],
         categoryIds: [] as string[],
         costCenterIds: [] as string[],
         description: report?.description || "",
         endDate: report?.endDate ? new Date(report.endDate) : new Date(),
         forecastDays: 30,
         name: report?.name || "",
         startDate: report?.startDate
            ? new Date(report.startDate)
            : new Date(new Date().setMonth(new Date().getMonth() - 1)),
         tagIds: [] as string[],
         type: (report?.type || "dre_gerencial") as ReportType,
      },
      onSubmit: async ({ value, formApi }) => {
         if (!value.name) return;

         try {
            if (isEditMode && report) {
               await updateReportMutation.mutateAsync({
                  description: value.description || undefined,
                  id: report.id,
                  name: value.name,
               });
            } else {
               const filterConfig = {
                  bankAccountIds:
                     value.bankAccountIds.length > 0
                        ? value.bankAccountIds
                        : undefined,
                  categoryIds:
                     value.categoryIds.length > 0
                        ? value.categoryIds
                        : undefined,
                  costCenterIds:
                     value.costCenterIds.length > 0
                        ? value.costCenterIds
                        : undefined,
                  tagIds: value.tagIds.length > 0 ? value.tagIds : undefined,
               };

               const hasFilters =
                  filterConfig.bankAccountIds ||
                  filterConfig.categoryIds ||
                  filterConfig.costCenterIds ||
                  filterConfig.tagIds;

               await createReportMutation.mutateAsync({
                  description: value.description || undefined,
                  endDate: value.endDate.toISOString(),
                  filterConfig: hasFilters ? filterConfig : undefined,
                  forecastDays:
                     value.type === "cash_flow_forecast"
                        ? value.forecastDays
                        : undefined,
                  name: value.name,
                  startDate: value.startDate.toISOString(),
                  type: value.type,
               });
            }
            formApi.reset();
         } catch (error) {
            console.error(
               `Failed to ${isEditMode ? "update" : "create"} report:`,
               error,
            );
         }
      },
      validators: {
         onBlur: schema,
      },
   });

   const bankAccountsQuery = useQuery(trpc.bankAccounts.getAll.queryOptions());
   const categoriesQuery = useQuery(trpc.categories.getAll.queryOptions());
   const costCentersQuery = useQuery(trpc.costCenters.getAll.queryOptions());
   const tagsQuery = useQuery(trpc.tags.getAll.queryOptions());

   const bankAccountOptions: Option[] = useMemo(
      () =>
         (bankAccountsQuery.data || []).map((ba) => ({
            label: ba.name || ba.bank,
            value: ba.id,
         })),
      [bankAccountsQuery.data],
   );

   const categoryOptions: Option[] = useMemo(
      () =>
         (categoriesQuery.data || []).map((cat) => ({
            label: cat.name,
            value: cat.id,
         })),
      [categoriesQuery.data],
   );

   const costCenterOptions: Option[] = useMemo(
      () =>
         (costCentersQuery.data || []).map((cc) => ({
            label: cc.code ? `${cc.code} - ${cc.name}` : cc.name,
            value: cc.id,
         })),
      [costCentersQuery.data],
   );

   const tagOptions: Option[] = useMemo(
      () =>
         (tagsQuery.data || []).map((tag) => ({
            label: tag.name,
            value: tag.id,
         })),
      [tagsQuery.data],
   );

   const handleSubmit = useCallback(
      (e: FormEvent) => {
         e.preventDefault();
         e.stopPropagation();
         form.handleSubmit();
      },
      [form],
   );

   function TypeStep() {
      return (
         <div className="grid gap-4">
            <p className="text-sm text-muted-foreground">
               Selecione o tipo de relatório que deseja criar.
            </p>
            <form.Field name="type">
               {(field) => (
                  <Choicebox
                     className="grid grid-cols-1 gap-2"
                     onValueChange={(value) =>
                        field.handleChange(value as ReportType)
                     }
                     value={field.state.value}
                  >
                     {(Object.keys(reportTypeConfig) as ReportType[]).map(
                        (value) => {
                           const config = reportTypeConfig[value];
                           const Icon = config.icon;
                           return (
                              <ChoiceboxItem
                                 id={value}
                                 key={value}
                                 value={value}
                              >
                                 <div className="flex items-center gap-3 p-1">
                                    <Icon className="size-5 text-muted-foreground shrink-0" />
                                    <ChoiceboxItemHeader className="flex-1 min-w-0">
                                       <ChoiceboxItemTitle className="text-sm">
                                          {config.label}
                                       </ChoiceboxItemTitle>
                                       <ChoiceboxItemDescription className="text-xs">
                                          {config.description}
                                       </ChoiceboxItemDescription>
                                    </ChoiceboxItemHeader>
                                 </div>
                                 <ChoiceboxIndicator id={value} />
                              </ChoiceboxItem>
                           );
                        },
                     )}
                  </Choicebox>
               )}
            </form.Field>
         </div>
      );
   }

   function PeriodStep() {
      return (
         <div className="grid gap-4">
            <p className="text-sm text-muted-foreground">
               Selecione o período de análise do relatório.
            </p>

            <FieldGroup>
               <form.Field name="startDate">
                  {(startDateField) => (
                     <form.Field name="endDate">
                        {(endDateField) => (
                           <Field>
                              <FieldLabel>Período</FieldLabel>
                              <DateRangePickerPopover
                                 className="w-full justify-start"
                                 endDate={endDateField.state.value}
                                 onRangeChange={({ startDate, endDate }) => {
                                    if (startDate && endDate) {
                                       startDateField.handleChange(startDate);
                                       endDateField.handleChange(endDate);
                                    }
                                 }}
                                 placeholder="Selecione o período"
                                 startDate={startDateField.state.value}
                              />
                           </Field>
                        )}
                     </form.Field>
                  )}
               </form.Field>
            </FieldGroup>

            <form.Subscribe selector={(state) => state.values.type}>
               {(type) =>
                  type === "cash_flow_forecast" && (
                     <FieldGroup>
                        <form.Field name="forecastDays">
                           {(field) => (
                              <Field>
                                 <FieldLabel>
                                    Dias de Projeção: {field.state.value}
                                 </FieldLabel>
                                 <Slider
                                    max={365}
                                    min={7}
                                    onValueChange={(values) => {
                                       const newValue = values[0];
                                       if (newValue !== undefined) {
                                          field.handleChange(newValue);
                                       }
                                    }}
                                    step={1}
                                    value={[field.state.value]}
                                 />
                                 <span className="text-xs text-muted-foreground">
                                    Projeção de {field.state.value} dias a
                                    partir da data inicial
                                 </span>
                              </Field>
                           )}
                        </form.Field>
                     </FieldGroup>
                  )
               }
            </form.Subscribe>
         </div>
      );
   }

   function FiltersStep() {
      return (
         <div className="grid gap-4">
            <p className="text-sm text-muted-foreground">
               Aplique filtros opcionais para refinar os dados do relatório. Se
               nenhum filtro for selecionado, todas as transações serão
               consideradas.
            </p>

            <FieldGroup>
               <form.Field name="bankAccountIds">
                  {(field) => (
                     <Field>
                        <FieldLabel>Contas Bancárias</FieldLabel>
                        <MultiSelect
                           onChange={(selected) => field.handleChange(selected)}
                           options={bankAccountOptions}
                           placeholder="Todas as contas"
                           selected={field.state.value}
                        />
                        <FieldDescription>
                           Opcional. Filtre por contas bancárias específicas.
                        </FieldDescription>
                     </Field>
                  )}
               </form.Field>
            </FieldGroup>

            <FieldGroup>
               <form.Field name="categoryIds">
                  {(field) => (
                     <Field>
                        <FieldLabel>Categorias</FieldLabel>
                        <MultiSelect
                           onChange={(selected) => field.handleChange(selected)}
                           options={categoryOptions}
                           placeholder="Todas as categorias"
                           selected={field.state.value}
                        />
                        <FieldDescription>
                           Opcional. Filtre por categorias específicas.
                        </FieldDescription>
                     </Field>
                  )}
               </form.Field>
            </FieldGroup>

            {canAccessCostCenters && (
               <FieldGroup>
                  <form.Field name="costCenterIds">
                     {(field) => (
                        <Field>
                           <FieldLabel>Centros de Custo</FieldLabel>
                           <MultiSelect
                              onChange={(selected) =>
                                 field.handleChange(selected)
                              }
                              options={costCenterOptions}
                              placeholder="Todos os centros de custo"
                              selected={field.state.value}
                           />
                           <FieldDescription>
                              Opcional. Filtre por centros de custo específicos.
                           </FieldDescription>
                        </Field>
                     )}
                  </form.Field>
               </FieldGroup>
            )}

            {canAccessTags && (
               <FieldGroup>
                  <form.Field name="tagIds">
                     {(field) => (
                        <Field>
                           <FieldLabel>Tags</FieldLabel>
                           <MultiSelect
                              onChange={(selected) =>
                                 field.handleChange(selected)
                              }
                              options={tagOptions}
                              placeholder="Todas as tags"
                              selected={field.state.value}
                           />
                           <FieldDescription>
                              Opcional. Filtre por tags específicas.
                           </FieldDescription>
                        </Field>
                     )}
                  </form.Field>
               </FieldGroup>
            )}
         </div>
      );
   }

   function DetailsStep() {
      return (
         <div className="grid gap-4">
            <FieldGroup>
               <form.Field name="name">
                  {(field) => {
                     const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid;
                     return (
                        <Field data-invalid={isInvalid}>
                           <FieldLabel htmlFor={field.name}>Nome</FieldLabel>
                           <Input
                              aria-invalid={isInvalid}
                              id={field.name}
                              name={field.name}
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                 field.handleChange(e.target.value)
                              }
                              placeholder="Ex: DRE Janeiro 2024"
                              value={field.state.value}
                           />
                           {isInvalid && (
                              <FieldError errors={field.state.meta.errors} />
                           )}
                        </Field>
                     );
                  }}
               </form.Field>
            </FieldGroup>

            <FieldGroup>
               <form.Field name="description">
                  {(field) => (
                     <Field>
                        <FieldLabel htmlFor={field.name}>
                           Descrição (opcional)
                        </FieldLabel>
                        <Textarea
                           id={field.name}
                           name={field.name}
                           onBlur={field.handleBlur}
                           onChange={(e) => field.handleChange(e.target.value)}
                           placeholder="Descrição do relatório..."
                           rows={3}
                           value={field.state.value}
                        />
                     </Field>
                  )}
               </form.Field>
            </FieldGroup>

            <form.Subscribe
               selector={(state) => ({
                  endDate: state.values.endDate,
                  forecastDays: state.values.forecastDays,
                  startDate: state.values.startDate,
                  type: state.values.type,
               })}
            >
               {({ endDate, forecastDays, startDate, type }) => (
                  <Alert>
                     <Info className="size-4" />
                     <AlertTitle>Resumo do Relatório</AlertTitle>
                     <AlertDescription>
                        <div className="space-y-1">
                           <p>
                              <span className="font-medium">Tipo:</span>{" "}
                              {reportTypeConfig[type].label}
                           </p>
                           <p>
                              <span className="font-medium">Período:</span>{" "}
                              {startDate.toLocaleDateString()} -{" "}
                              {endDate.toLocaleDateString()}
                           </p>
                           {type === "cash_flow_forecast" && (
                              <p>
                                 <span className="font-medium">Projeção:</span>{" "}
                                 {forecastDays} dias
                              </p>
                           )}
                        </div>
                     </AlertDescription>
                  </Alert>
               )}
            </form.Subscribe>
         </div>
      );
   }

   // Edit mode: simple form with name and description only
   if (isEditMode) {
      return (
         <form className="h-full flex flex-col" onSubmit={handleSubmit}>
            <SheetHeader>
               <SheetTitle>{modeTexts.title}</SheetTitle>
               <SheetDescription>{modeTexts.description}</SheetDescription>
            </SheetHeader>

            <div className="grid gap-4 px-4 flex-1">
               <FieldGroup>
                  <form.Field name="name">
                     {(field) => {
                        const isInvalid =
                           field.state.meta.isTouched &&
                           !field.state.meta.isValid;
                        return (
                           <Field data-invalid={isInvalid}>
                              <FieldLabel htmlFor={field.name}>Nome</FieldLabel>
                              <Input
                                 aria-invalid={isInvalid}
                                 id={field.name}
                                 name={field.name}
                                 onBlur={field.handleBlur}
                                 onChange={(e) =>
                                    field.handleChange(e.target.value)
                                 }
                                 placeholder="Ex: DRE Janeiro 2024"
                                 value={field.state.value}
                              />
                              {isInvalid && (
                                 <FieldError errors={field.state.meta.errors} />
                              )}
                           </Field>
                        );
                     }}
                  </form.Field>
               </FieldGroup>

               <FieldGroup>
                  <form.Field name="description">
                     {(field) => (
                        <Field>
                           <FieldLabel htmlFor={field.name}>
                              Descrição (opcional)
                           </FieldLabel>
                           <Textarea
                              id={field.name}
                              name={field.name}
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                 field.handleChange(e.target.value)
                              }
                              placeholder="Descrição do relatório..."
                              rows={3}
                              value={field.state.value}
                           />
                        </Field>
                     )}
                  </form.Field>
               </FieldGroup>
            </div>

            <SheetFooter>
               <form.Subscribe>
                  {(state) => (
                     <Button
                        className="w-full"
                        disabled={
                           !state.canSubmit ||
                           state.isSubmitting ||
                           updateReportMutation.isPending
                        }
                        type="submit"
                     >
                        Salvar Alterações
                     </Button>
                  )}
               </form.Subscribe>
            </SheetFooter>
         </form>
      );
   }

   return (
      <Stepper.Provider className="h-full" variant="line">
         {({ methods }) => (
            <form className="h-full flex flex-col" onSubmit={handleSubmit}>
               <SheetHeader>
                  <SheetTitle>{modeTexts.title}</SheetTitle>
                  <SheetDescription>{modeTexts.description}</SheetDescription>
               </SheetHeader>

               <div className="px-4 py-2">
                  <Stepper.Navigation>
                     {steps.map((step) => (
                        <Stepper.Step key={step.id} of={step.id}>
                           <Stepper.Title>{step.title}</Stepper.Title>
                        </Stepper.Step>
                     ))}
                  </Stepper.Navigation>
               </div>

               <div className="flex-1 overflow-y-auto px-4">
                  {methods.switch({
                     details: () => <DetailsStep />,
                     filters: () => <FiltersStep />,
                     period: () => <PeriodStep />,
                     type: () => <TypeStep />,
                  })}
               </div>

               <SheetFooter className="px-4">
                  <Stepper.Controls className="flex flex-col w-full gap-2">
                     {methods.isLast ? (
                        <form.Subscribe>
                           {(state) => (
                              <>
                                 <Button
                                    className="w-full"
                                    disabled={
                                       !state.values.name ||
                                       !state.canSubmit ||
                                       state.isSubmitting ||
                                       createReportMutation.isPending
                                    }
                                    type="submit"
                                 >
                                    <Check className="size-4" />
                                    Criar Relatório
                                 </Button>
                                 <Button
                                    className="w-full"
                                    onClick={(e) => {
                                       e.preventDefault();
                                       e.stopPropagation();
                                       methods.prev();
                                    }}
                                    type="button"
                                    variant="ghost"
                                 >
                                    <ArrowLeft className="size-4" />
                                    Voltar
                                 </Button>
                              </>
                           )}
                        </form.Subscribe>
                     ) : methods.isFirst ? (
                        <form.Subscribe
                           selector={(state) => ({
                              type: state.values.type,
                           })}
                        >
                           {({ type }) => (
                              <Button
                                 className="w-full"
                                 disabled={!type}
                                 onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    methods.next();
                                 }}
                                 type="button"
                              >
                                 Próximo
                                 <ArrowRight className="size-4" />
                              </Button>
                           )}
                        </form.Subscribe>
                     ) : (
                        <form.Subscribe
                           selector={(state) => ({
                              endDate: state.values.endDate,
                              startDate: state.values.startDate,
                           })}
                        >
                           {({ endDate, startDate }) => (
                              <>
                                 <Button
                                    className="w-full"
                                    disabled={!startDate || !endDate}
                                    onClick={(e) => {
                                       e.preventDefault();
                                       e.stopPropagation();
                                       methods.next();
                                    }}
                                    type="button"
                                 >
                                    Próximo
                                    <ArrowRight className="size-4" />
                                 </Button>
                                 <Button
                                    className="w-full"
                                    onClick={(e) => {
                                       e.preventDefault();
                                       e.stopPropagation();
                                       methods.prev();
                                    }}
                                    type="button"
                                    variant="ghost"
                                 >
                                    <ArrowLeft className="size-4" />
                                    Voltar
                                 </Button>
                              </>
                           )}
                        </form.Subscribe>
                     )}
                  </Stepper.Controls>
               </SheetFooter>
            </form>
         )}
      </Stepper.Provider>
   );
}
