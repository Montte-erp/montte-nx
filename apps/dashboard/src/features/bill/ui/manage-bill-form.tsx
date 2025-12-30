import type { Bill } from "@packages/database/repositories/bill-repository";
import { translate } from "@packages/localization";
import { formatDecimalCurrency } from "@packages/money";
import {
   Alert,
   AlertDescription,
   AlertTitle,
} from "@packages/ui/components/alert";
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import {
   Choicebox,
   ChoiceboxIndicator,
   ChoiceboxItem,
   ChoiceboxItemDescription,
   ChoiceboxItemHeader,
   ChoiceboxItemTitle,
} from "@packages/ui/components/choicebox";
import {
   Collapsible,
   CollapsibleContent,
   CollapsibleTrigger,
} from "@packages/ui/components/collapsible";
import {
   Command,
   CommandEmpty,
   CommandGroup,
   CommandInput,
   CommandItem,
   CommandList,
} from "@packages/ui/components/command";
import { DatePicker } from "@packages/ui/components/date-picker";
import {
   Field,
   FieldError,
   FieldGroup,
   FieldLabel,
} from "@packages/ui/components/field";
import { Input } from "@packages/ui/components/input";
import { Label } from "@packages/ui/components/label";
import { MoneyInput } from "@packages/ui/components/money-input";
import {
   Popover,
   PopoverContent,
   PopoverTrigger,
} from "@packages/ui/components/popover";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
import {
   SheetDescription,
   SheetFooter,
   SheetHeader,
   SheetTitle,
} from "@packages/ui/components/sheet";
import { defineStepper } from "@packages/ui/components/stepper";
import { Textarea } from "@packages/ui/components/textarea";
import { formatDate } from "@packages/utils/date";
import type { RecurrencePattern } from "@packages/utils/recurrence";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
   ArrowDownLeft,
   ArrowUpRight,
   CalendarCheck,
   CalendarDays,
   Check,
   CheckIcon,
   ChevronDown,
   ChevronsUpDownIcon,
   Minus,
   Plus,
   Receipt,
   Repeat,
} from "lucide-react";
import {
   type FormEvent,
   type RefObject,
   useCallback,
   useMemo,
   useRef,
   useState,
} from "react";
import { z } from "zod";
import type { IconName } from "@/features/icon-selector/lib/available-icons";
import { IconDisplay } from "@/features/icon-selector/ui/icon-display";
import { useSheet } from "@/hooks/use-sheet";
import { useTRPC } from "@/integrations/clients";
import { useBillListOptional } from "../lib/bill-list-context";

export type FromTransactionData = {
   amount: number;
   bankAccountId?: string;
   categoryId?: string;
   description: string;
   type: "expense" | "income";
};

export type ManageBillFormProps = {
   bill?: Bill;
   fromTransaction?: FromTransactionData;
};

type BillCategory = "payable" | "receivable";
type BillMode = "onetime" | "recurring" | "installment";
type StepId =
   | "bill-type"
   | "bill-mode"
   | "details"
   | "recurrence"
   | "categorization";

const allSteps: Array<{ id: StepId; title: string }> = [
   { id: "bill-type", title: "bill-type" },
   { id: "bill-mode", title: "bill-mode" },
   { id: "details", title: "details" },
   { id: "recurrence", title: "recurrence" },
   { id: "categorization", title: "categorization" },
];

const { Stepper } = defineStepper(...allSteps);

function getCustomAmountsValidation(
   amount: number,
   installmentAmountType: string | null,
   installmentCustomAmounts: (number | null)[] | null,
) {
   const customAmountsSum = (installmentCustomAmounts || []).reduce(
      (sum, val) => sum + (val || 0),
      0,
   );
   const amountDifference = amount - customAmountsSum;
   const isValid =
      installmentAmountType !== "custom" || Math.abs(amountDifference) < 0.01;

   return { customAmountsSum, amountDifference, isValid };
}

function getActiveSteps(
   billCategory: BillCategory | null,
   billMode: BillMode | null,
   isEditMode: boolean,
): StepId[] {
   if (isEditMode) {
      return ["details", "recurrence", "categorization"];
   }

   if (!billCategory) {
      return ["bill-type"];
   }

   if (!billMode) {
      return ["bill-type", "bill-mode"];
   }

   if (billMode === "onetime") {
      return ["bill-type", "bill-mode", "details", "categorization"];
   }

   // recurring or installment - details comes before recurrence config
   return ["bill-type", "bill-mode", "details", "recurrence", "categorization"];
}

export function ManageBillForm({ bill, fromTransaction }: ManageBillFormProps) {
   const { closeSheet } = useSheet();
   const trpc = useTRPC();

   // Get context values first (needed for default calculations)
   const billListContext = useBillListOptional();
   const currentFilterType = billListContext?.currentFilterType;
   const isEditMode = !!bill;
   const isFromTransactionMode = !!fromTransaction;

   // Calculate default values based on context
   const getDefaultBillCategory = (): BillCategory | null => {
      if (bill) {
         return bill.type === "expense" ? "payable" : "receivable";
      }
      if (fromTransaction) {
         return fromTransaction.type === "expense" ? "payable" : "receivable";
      }
      if (currentFilterType === "payable") return "payable";
      if (currentFilterType === "receivable") return "receivable";
      return null;
   };

   const getDefaultBillMode = (): BillMode | null => {
      if (bill) {
         if (bill.installmentGroupId) return "installment";
         if (bill.isRecurring) return "recurring";
         return "onetime";
      }
      if (fromTransaction) return "recurring";
      return null;
   };

   // Initialize state with calculated defaults
   const [categoryComboboxOpen, setCategoryComboboxOpen] = useState(false);
   const [counterpartyComboboxOpen, setCounterpartyComboboxOpen] =
      useState(false);
   const [counterpartySearch, setCounterpartySearch] = useState("");
   const [selectedBillCategory, setSelectedBillCategory] =
      useState<BillCategory | null>(getDefaultBillCategory);
   const [selectedBillMode, setSelectedBillMode] = useState<BillMode | null>(
      getDefaultBillMode,
   );

   const activeSteps = useMemo(
      () => getActiveSteps(selectedBillCategory, selectedBillMode, isEditMode),
      [selectedBillCategory, selectedBillMode, isEditMode],
   );

   const { data: categories = [] } = useQuery(
      trpc.categories.getAll.queryOptions(),
   );

   const { data: bankAccounts = [] } = useQuery(
      trpc.bankAccounts.getAll.queryOptions(),
   );

   const { data: counterparties = [] } = useQuery(
      trpc.counterparties.getAll.queryOptions({ isActive: true }),
   );

   const { data: interestTemplates = [] } = useQuery(
      trpc.interestTemplates.getAll.queryOptions({ isActive: true }),
   );

   const { data: tags = [] } = useQuery(trpc.tags.getAll.queryOptions());

   const { data: costCenters = [] } = useQuery(
      trpc.costCenters.getAll.queryOptions(),
   );

   const activeBankAccounts = useMemo(
      () => bankAccounts.filter((account) => account.status === "active"),
      [bankAccounts],
   );

   const createBillMutation = useMutation(
      trpc.bills.create.mutationOptions({
         onSuccess: async () => {
            form.reset();
            closeSheet();
         },
      }),
   );

   const updateBillMutation = useMutation(
      trpc.bills.update.mutationOptions({
         onSuccess: () => {
            closeSheet();
         },
      }),
   );

   const createCounterpartyMutation = useMutation(
      trpc.counterparties.create.mutationOptions(),
   );

   const createWithInstallmentsMutation = useMutation(
      trpc.bills.createWithInstallments.mutationOptions({
         onSuccess: async () => {
            form.reset();
            closeSheet();
         },
      }),
   );

   const editValues = bill
      ? {
           amount: Number(bill.amount),
           bankAccountId: bill.bankAccountId || undefined,
           billCategory: getDefaultBillCategory(),
           billMode: getDefaultBillMode(),
           category: bill.categoryId || undefined,
           costCenterId: bill.costCenterId || undefined,
           counterpartyId: bill.counterpartyId || undefined,
           description: bill.description,
           dueDate: bill.dueDate ? new Date(bill.dueDate) : undefined,
           hasInstallments: !!bill.installmentGroupId,
           installmentAmountType: "equal" as "equal" | "custom",
           installmentCount: bill.totalInstallments || 2,
           installmentCustomAmounts: [] as number[],
           installmentCustomDays: 30,
           installmentIntervalType: "monthly" as
              | "monthly"
              | "biweekly"
              | "weekly"
              | "custom",
           interestTemplateId: bill.interestTemplateId || undefined,
           isRecurring: bill.isRecurring,
           issueDate: bill.issueDate ? new Date(bill.issueDate) : undefined,
           notes: bill.notes || undefined,
           occurrenceCount: 12,
           occurrenceType: undefined as
              | "auto"
              | "count"
              | "until-date"
              | undefined,
           occurrenceUntilDate: undefined as Date | undefined,
           recurrencePattern: bill.recurrencePattern as
              | RecurrencePattern
              | undefined,
           tagIds: [] as string[],
           type: bill.type as "expense" | "income",
        }
      : fromTransaction
        ? {
             amount: fromTransaction.amount,
             bankAccountId: fromTransaction.bankAccountId || undefined,
             billCategory: getDefaultBillCategory(),
             billMode: getDefaultBillMode(),
             category: fromTransaction.categoryId || undefined,
             costCenterId: undefined as string | undefined,
             counterpartyId: undefined as string | undefined,
             description: fromTransaction.description,
             dueDate: undefined as Date | undefined,
             hasInstallments: false,
             installmentAmountType: "equal" as "equal" | "custom",
             installmentCount: 2,
             installmentCustomAmounts: [] as number[],
             installmentCustomDays: 30,
             installmentIntervalType: "monthly" as
                | "monthly"
                | "biweekly"
                | "weekly"
                | "custom",
             interestTemplateId: undefined as string | undefined,
             isRecurring: true,
             issueDate: undefined as Date | undefined,
             notes: undefined as string | undefined,
             occurrenceCount: 12,
             occurrenceType: undefined as
                | "auto"
                | "count"
                | "until-date"
                | undefined,
             occurrenceUntilDate: undefined as Date | undefined,
             recurrencePattern: "monthly" as RecurrencePattern | undefined,
             tagIds: [] as string[],
             type: fromTransaction.type,
          }
        : {
             amount: 0,
             bankAccountId: undefined as string | undefined,
             billCategory: getDefaultBillCategory(),
             billMode: null as BillMode | null,
             category: undefined as string | undefined,
             costCenterId: undefined as string | undefined,
             counterpartyId: undefined as string | undefined,
             description: "",
             dueDate: undefined as Date | undefined,
             hasInstallments: false,
             installmentAmountType: "equal" as "equal" | "custom",
             installmentCount: 2,
             installmentCustomAmounts: [] as number[],
             installmentCustomDays: 30,
             installmentIntervalType: "monthly" as
                | "monthly"
                | "biweekly"
                | "weekly"
                | "custom",
             interestTemplateId: undefined as string | undefined,
             isRecurring: false,
             issueDate: undefined as Date | undefined,
             notes: undefined as string | undefined,
             occurrenceCount: 12,
             occurrenceType: undefined as
                | "auto"
                | "count"
                | "until-date"
                | undefined,
             occurrenceUntilDate: undefined as Date | undefined,
             recurrencePattern: undefined as RecurrencePattern | undefined,
             tagIds: [] as string[],
             type: (currentFilterType === "payable"
                ? "expense"
                : currentFilterType === "receivable"
                  ? "income"
                  : "expense") as "expense" | "income",
          };

   const billSchema = z.object({
      // Required fields
      amount: z.number().min(0.01, translate("common.validation.required")),
      billCategory: z.enum(["payable", "receivable"]).nullable(),
      billMode: z.enum(["onetime", "recurring", "installment"]).nullable(),
      description: z.string().min(1, translate("common.validation.required")),
      type: z.enum(["expense", "income"]),

      // Optional string fields (allow undefined or empty)
      bankAccountId: z.string().or(z.undefined()),
      category: z.string().or(z.undefined()),
      costCenterId: z.string().or(z.undefined()),
      counterpartyId: z.string().or(z.undefined()),
      interestTemplateId: z.string().or(z.undefined()),
      notes: z.string().or(z.undefined()),
      tagIds: z.array(z.string()),

      // Optional date fields
      dueDate: z.date().or(z.undefined()),
      issueDate: z.date().or(z.undefined()),

      // Boolean fields
      hasInstallments: z.boolean(),
      isRecurring: z.boolean(),

      // Recurring-specific
      recurrencePattern: z
         .enum(["monthly", "quarterly", "semiannual", "annual"])
         .or(z.undefined()),
      occurrenceType: z.enum(["auto", "count", "until-date"]).or(z.undefined()),
      occurrenceCount: z.number().min(1).max(365),
      occurrenceUntilDate: z.date().or(z.undefined()),

      // Installment-specific
      installmentAmountType: z.enum(["equal", "custom"]),
      installmentCount: z.number().min(2).max(120),
      installmentCustomAmounts: z.array(z.number()),
      installmentCustomDays: z.number().min(1).max(365),
      installmentIntervalType: z.enum([
         "monthly",
         "biweekly",
         "weekly",
         "custom",
      ]),
   });

   const form = useForm({
      defaultValues: editValues,
      validators: {
         onBlur: billSchema,
      },
      onSubmit: async ({ value }) => {
         const amount = Number(value.amount);

         try {
            if (isEditMode && bill) {
               await updateBillMutation.mutateAsync({
                  data: {
                     amount: amount,
                     bankAccountId: value.bankAccountId || undefined,
                     categoryId: value.category || undefined,
                     costCenterId: value.costCenterId || undefined,
                     counterpartyId: value.counterpartyId || undefined,
                     description: value.description || undefined,
                     dueDate: value.dueDate
                        ? formatDate(value.dueDate, "YYYY-MM-DD")
                        : undefined,
                     interestTemplateId: value.interestTemplateId || undefined,
                     isRecurring: value.isRecurring,
                     issueDate: value.issueDate
                        ? formatDate(value.issueDate, "YYYY-MM-DD")
                        : undefined,
                     notes: value.notes || undefined,
                     recurrencePattern: value.recurrencePattern,
                     tagIds: value.tagIds || undefined,
                     type: value.type,
                  },
                  id: bill.id,
               });
            } else if (value.hasInstallments && !value.isRecurring) {
               const intervalDays =
                  value.installmentIntervalType === "monthly"
                     ? 30
                     : value.installmentIntervalType === "biweekly"
                       ? 15
                       : value.installmentIntervalType === "weekly"
                         ? 7
                         : value.installmentCustomDays;

               const amounts =
                  value.installmentAmountType === "equal"
                     ? ("equal" as const)
                     : value.installmentCustomAmounts;

               await createWithInstallmentsMutation.mutateAsync({
                  amount: amount,
                  bankAccountId: value.bankAccountId || undefined,
                  categoryId: value.category || undefined,
                  costCenterId: value.costCenterId || undefined,
                  counterpartyId: value.counterpartyId || undefined,
                  description: value.description ?? "",
                  dueDate: value.dueDate ?? new Date(),
                  installments: {
                     amounts,
                     intervalDays,
                     totalInstallments: value.installmentCount,
                  },
                  interestTemplateId: value.interestTemplateId || undefined,
                  issueDate: value.issueDate
                     ? formatDate(value.issueDate, "YYYY-MM-DD")
                     : undefined,
                  notes: value.notes || undefined,
                  tagIds: value.tagIds || undefined,
                  type: value.type ?? "expense",
               });
            } else {
               await createBillMutation.mutateAsync({
                  amount: amount,
                  bankAccountId: value.bankAccountId || undefined,
                  categoryId: value.category || undefined,
                  costCenterId: value.costCenterId || undefined,
                  counterpartyId: value.counterpartyId || undefined,
                  description: value.description ?? "",
                  dueDate: value.dueDate ?? new Date(),
                  interestTemplateId: value.interestTemplateId || undefined,
                  isRecurring: value.isRecurring,
                  issueDate: value.issueDate
                     ? new Date(value.issueDate)
                     : undefined,
                  notes: value.notes || undefined,
                  recurrencePattern: value.isRecurring
                     ? value.recurrencePattern
                     : undefined,
                  tagIds: value.tagIds || undefined,
                  type: value.type ?? "expense",
               });
            }
         } catch (error) {
            console.error(
               `Failed to ${isEditMode ? "update" : "create"} bill:`,
               error,
            );
         }
      },
   });

   const modeTexts = useMemo(() => {
      const createTexts = {
         description: translate(
            "dashboard.routes.bills.features.create-bill.description",
         ),
         title: translate("dashboard.routes.bills.features.create-bill.title"),
      };

      const editTexts = {
         description: translate(
            "dashboard.routes.bills.features.edit-bill.description",
         ),
         title: translate("dashboard.routes.bills.features.edit-bill.title"),
      };

      const fromTransactionTexts = {
         description: translate(
            "dashboard.routes.bills.features.from-transaction.description",
         ),
         title: translate(
            "dashboard.routes.bills.features.from-transaction.title",
         ),
      };

      if (isEditMode) return editTexts;
      if (isFromTransactionMode) return fromTransactionTexts;
      return createTexts;
   }, [isEditMode, isFromTransactionMode]);

   const isPending =
      createBillMutation.isPending || updateBillMutation.isPending;

   const handleSubmit = useCallback(
      (e: FormEvent) => {
         e.preventDefault();
         e.stopPropagation();

         form.handleSubmit();
      },
      [form],
   );

   const handleQuickCreateCounterparty = useCallback(
      async (name: string, type: "expense" | "income") => {
         try {
            const counterpartyType = type === "expense" ? "supplier" : "client";
            const newCounterparty =
               await createCounterpartyMutation.mutateAsync({
                  name,
                  type: counterpartyType,
               });
            if (newCounterparty) {
               form.setFieldValue("counterpartyId", newCounterparty.id);
            }
            setCounterpartyComboboxOpen(false);
            setCounterpartySearch("");
         } catch (error) {
            console.error("Failed to create counterparty:", error);
         }
      },
      [createCounterpartyMutation, form],
   );

   function BillTypeStep() {
      const billCategoryOptions = [
         {
            description: translate(
               "dashboard.routes.bills.features.create-bill.steps.bill-type.options.payable.description",
            ),
            icon: ArrowUpRight,
            iconColor: "text-red-500",
            title: translate(
               "dashboard.routes.bills.features.create-bill.steps.bill-type.options.payable.title",
            ),
            value: "payable" as BillCategory,
         },
         {
            description: translate(
               "dashboard.routes.bills.features.create-bill.steps.bill-type.options.receivable.description",
            ),
            icon: ArrowDownLeft,
            iconColor: "text-emerald-500",
            title: translate(
               "dashboard.routes.bills.features.create-bill.steps.bill-type.options.receivable.title",
            ),
            value: "receivable" as BillCategory,
         },
      ];

      return (
         <div className="space-y-4">
            <div className="text-center mb-6">
               <p className="text-sm text-muted-foreground">
                  {translate(
                     "dashboard.routes.bills.features.create-bill.steps.bill-type.question",
                  )}
               </p>
            </div>

            <form.Field name="billCategory">
               {(field) => (
                  <Choicebox
                     className="grid gap-3"
                     onValueChange={(value) => {
                        const category = value as BillCategory;
                        field.handleChange(category);
                        setSelectedBillCategory(category);

                        // Update type based on category selection
                        form.setFieldValue(
                           "type",
                           category === "payable" ? "expense" : "income",
                        );
                     }}
                     value={field.state.value || ""}
                  >
                     {billCategoryOptions.map((option) => {
                        const IconComponent = option.icon;
                        return (
                           <ChoiceboxItem
                              className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-accent/50 transition-colors data-[state=checked]:border-primary data-[state=checked]:bg-primary/5"
                              id={option.value}
                              key={option.value}
                              value={option.value}
                           >
                              <div className="flex items-center gap-3">
                                 <div
                                    className={`p-2 rounded-lg bg-muted ${option.iconColor}`}
                                 >
                                    <IconComponent className="size-5" />
                                 </div>
                                 <ChoiceboxItemHeader>
                                    <ChoiceboxItemTitle>
                                       {option.title}
                                    </ChoiceboxItemTitle>
                                    <ChoiceboxItemDescription>
                                       {option.description}
                                    </ChoiceboxItemDescription>
                                 </ChoiceboxItemHeader>
                              </div>
                              <ChoiceboxIndicator id={option.value} />
                           </ChoiceboxItem>
                        );
                     })}
                  </Choicebox>
               )}
            </form.Field>
         </div>
      );
   }

   function BillModeStep() {
      const billModeOptions = [
         {
            description: translate(
               "dashboard.routes.bills.features.create-bill.steps.bill-mode.options.onetime.description",
            ),
            icon: Receipt,
            title: translate(
               "dashboard.routes.bills.features.create-bill.steps.bill-mode.options.onetime.title",
            ),
            value: "onetime" as BillMode,
         },
         {
            description: translate(
               "dashboard.routes.bills.features.create-bill.steps.bill-mode.options.recurring.description",
            ),
            icon: Repeat,
            title: translate(
               "dashboard.routes.bills.features.create-bill.steps.bill-mode.options.recurring.title",
            ),
            value: "recurring" as BillMode,
         },
         {
            description: translate(
               "dashboard.routes.bills.features.create-bill.steps.bill-mode.options.installment.description",
            ),
            icon: CalendarDays,
            title: translate(
               "dashboard.routes.bills.features.create-bill.steps.bill-mode.options.installment.title",
            ),
            value: "installment" as BillMode,
         },
      ];

      return (
         <div className="space-y-4">
            <div className="text-center mb-6">
               <p className="text-sm text-muted-foreground">
                  {translate(
                     "dashboard.routes.bills.features.create-bill.steps.bill-mode.question",
                  )}
               </p>
            </div>

            <form.Field name="billMode">
               {(field) => (
                  <Choicebox
                     className="grid gap-3"
                     onValueChange={(value) => {
                        const mode = value as BillMode;
                        field.handleChange(mode);
                        setSelectedBillMode(mode);

                        // Update form fields based on mode
                        form.setFieldValue("isRecurring", mode === "recurring");
                        form.setFieldValue(
                           "hasInstallments",
                           mode === "installment",
                        );

                        // Set default recurrence pattern for recurring bills
                        if (mode === "recurring") {
                           form.setFieldValue("recurrencePattern", "monthly");
                        }
                     }}
                     value={field.state.value || ""}
                  >
                     {billModeOptions.map((option) => {
                        const IconComponent = option.icon;
                        return (
                           <ChoiceboxItem
                              className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-accent/50 transition-colors data-[state=checked]:border-primary data-[state=checked]:bg-primary/5"
                              id={option.value}
                              key={option.value}
                              value={option.value}
                           >
                              <div className="flex items-center gap-3">
                                 <div className="p-2 rounded-lg bg-muted text-muted-foreground">
                                    <IconComponent className="size-5" />
                                 </div>
                                 <ChoiceboxItemHeader>
                                    <ChoiceboxItemTitle>
                                       {option.title}
                                    </ChoiceboxItemTitle>
                                    <ChoiceboxItemDescription>
                                       {option.description}
                                    </ChoiceboxItemDescription>
                                 </ChoiceboxItemHeader>
                              </div>
                              <ChoiceboxIndicator id={option.value} />
                           </ChoiceboxItem>
                        );
                     })}
                  </Choicebox>
               )}
            </form.Field>
         </div>
      );
   }

   function DetailsStep() {
      return (
         <div className="space-y-4">
            {/* Required Fields */}
            <FieldGroup>
               <form.Field name="description">
                  {(field) => {
                     const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid;
                     return (
                        <Field data-invalid={isInvalid}>
                           <FieldLabel htmlFor={field.name}>
                              {translate("common.form.description.label")}
                           </FieldLabel>
                           <Textarea
                              id={field.name}
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                 field.handleChange(e.target.value)
                              }
                              placeholder={translate(
                                 "common.form.description.placeholder",
                              )}
                              value={field.state.value || ""}
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
               <form.Field name="amount">
                  {(field) => {
                     const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid;
                     return (
                        <Field data-invalid={isInvalid}>
                           <FieldLabel htmlFor={field.name}>
                              {translate("common.form.amount.label")}
                           </FieldLabel>
                           <MoneyInput
                              id={field.name}
                              onBlur={field.handleBlur}
                              onChange={(value) => {
                                 field.handleChange(value || 0);
                              }}
                              placeholder="0,00"
                              value={field.state.value}
                              valueInCents={false}
                           />
                           {isInvalid && (
                              <FieldError errors={field.state.meta.errors} />
                           )}
                        </Field>
                     );
                  }}
               </form.Field>
            </FieldGroup>

            {/* Optional Fields Separator */}
            <div className="pt-2 pb-1">
               <span className="text-xs text-muted-foreground uppercase tracking-wide">
                  {translate("common.form.optional")}
               </span>
            </div>

            <FieldGroup>
               <form.Field name="dueDate">
                  {(field) => (
                     <Field>
                        <FieldLabel htmlFor={field.name}>
                           {translate(
                              "dashboard.routes.bills.features.create-bill.fields.dueDate",
                           )}
                        </FieldLabel>
                        <DatePicker
                           date={field.state.value}
                           onSelect={(date) => field.handleChange(date)}
                           placeholder={translate(
                              "common.form.date.placeholder",
                           )}
                        />
                     </Field>
                  )}
               </form.Field>
            </FieldGroup>

            <FieldGroup>
               <form.Field name="issueDate">
                  {(field) => (
                     <Field>
                        <FieldLabel htmlFor={field.name}>
                           {translate(
                              "dashboard.routes.bills.features.create-bill.fields.issueDate",
                           )}
                        </FieldLabel>
                        <DatePicker
                           date={field.state.value}
                           onSelect={(date) => field.handleChange(date)}
                           placeholder={translate(
                              "common.form.date.placeholder",
                           )}
                        />
                     </Field>
                  )}
               </form.Field>
            </FieldGroup>

            <FieldGroup>
               <form.Field name="notes">
                  {(field) => (
                     <Field>
                        <FieldLabel htmlFor={field.name}>
                           {translate("common.form.notes.label")}
                        </FieldLabel>
                        <Textarea
                           id={field.name}
                           onBlur={field.handleBlur}
                           onChange={(e) => field.handleChange(e.target.value)}
                           placeholder={translate(
                              "common.form.notes.placeholder",
                           )}
                           value={field.state.value}
                        />
                     </Field>
                  )}
               </form.Field>
            </FieldGroup>
         </div>
      );
   }

   type RecurringSection = "frequency" | "occurrence" | "review";
   type InstallmentSection = "count" | "interval" | "amounts" | "review";

   const frequencyOptions = [
      "monthly",
      "quarterly",
      "semiannual",
      "annual",
   ] as const;
   const occurrenceOptions = ["auto", "count", "until-date"] as const;
   const intervalOptions = ["monthly", "biweekly", "weekly", "custom"] as const;

   const frequencyLabels: Record<string, string> = {
      annual: translate(
         "dashboard.routes.bills.features.create-bill.recurrence.annual",
      ),
      monthly: translate(
         "dashboard.routes.bills.features.create-bill.recurrence.monthly",
      ),
      quarterly: translate(
         "dashboard.routes.bills.features.create-bill.recurrence.quarterly",
      ),
      semiannual: translate(
         "dashboard.routes.bills.features.create-bill.recurrence.semiannual",
      ),
   };

   const occurrenceLabels: Record<string, string> = {
      auto: translate(
         "dashboard.routes.bills.features.create-bill.recurrence-step.occurrence.options.auto.title",
      ),
      count: translate(
         "dashboard.routes.bills.features.create-bill.recurrence-step.occurrence.options.count.title",
      ),
      "until-date": translate(
         "dashboard.routes.bills.features.create-bill.recurrence-step.occurrence.options.until-date.title",
      ),
   };

   const intervalLabels: Record<string, string> = {
      biweekly: translate(
         "dashboard.routes.bills.features.create-bill.installments.intervalOptions.biweekly",
      ),
      custom: translate(
         "dashboard.routes.bills.features.create-bill.installments.intervalOptions.custom",
      ),
      monthly: translate(
         "dashboard.routes.bills.features.create-bill.installments.intervalOptions.monthly",
      ),
      weekly: translate(
         "dashboard.routes.bills.features.create-bill.installments.intervalOptions.weekly",
      ),
   };

   function RecurrenceStep() {
      const [recurringSection, setRecurringSection] =
         useState<RecurringSection>("frequency");
      const [installmentSection, setInstallmentSection] =
         useState<InstallmentSection>("count");

      // Refs for auto-scroll on mobile
      const frequencySectionRef = useRef<HTMLDivElement>(null);
      const occurrenceSectionRef = useRef<HTMLDivElement>(null);
      const countSectionRef = useRef<HTMLDivElement>(null);
      const intervalSectionRef = useRef<HTMLDivElement>(null);
      const amountsSectionRef = useRef<HTMLDivElement>(null);

      const scrollToSection = useCallback(
         (ref: RefObject<HTMLDivElement | null>) => {
            requestAnimationFrame(() => {
               ref.current?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
               });
               const focusable = ref.current?.querySelector<HTMLElement>(
                  'input, button:not([disabled]), [tabindex]:not([tabindex="-1"])',
               );
               focusable?.focus({ preventScroll: true });
            });
         },
         [],
      );

      return (
         <form.Subscribe
            selector={(state) => ({
               amount: state.values.amount,
               billMode: state.values.billMode,
               installmentAmountType: state.values.installmentAmountType,
               installmentCount: state.values.installmentCount,
               installmentCustomAmounts: state.values.installmentCustomAmounts,
               installmentIntervalType: state.values.installmentIntervalType,
               occurrenceCount: state.values.occurrenceCount,
               occurrenceType: state.values.occurrenceType,
               occurrenceUntilDate: state.values.occurrenceUntilDate,
               recurrencePattern: state.values.recurrencePattern,
            })}
         >
            {({
               amount,
               billMode,
               installmentAmountType,
               installmentCount,
               installmentCustomAmounts,
               installmentIntervalType,
               occurrenceCount,
               occurrenceType,
               occurrenceUntilDate,
               recurrencePattern,
            }) => {
               const {
                  customAmountsSum,
                  amountDifference,
                  isValid: isCustomAmountsValid,
               } = getCustomAmountsValidation(
                  amount,
                  installmentAmountType,
                  installmentCustomAmounts,
               );

               return (
                  <div className="space-y-4">
                     {billMode === "recurring" && (
                        <>
                           {/* Step 1: Frequency */}
                           <div ref={frequencySectionRef}>
                              <Collapsible
                                 onOpenChange={(open) => {
                                    if (open) setRecurringSection("frequency");
                                    else if (recurrencePattern) {
                                       setRecurringSection("occurrence");
                                       scrollToSection(occurrenceSectionRef);
                                    }
                                 }}
                                 open={recurringSection === "frequency"}
                              >
                                 <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border p-4 hover:bg-muted/50 transition-colors">
                                    <div className="flex items-center gap-3">
                                       <div
                                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                                             recurrencePattern
                                                ? "bg-primary text-primary-foreground"
                                                : "bg-muted text-muted-foreground"
                                          }`}
                                       >
                                          {recurrencePattern ? (
                                             <Check className="h-3.5 w-3.5" />
                                          ) : (
                                             "1"
                                          )}
                                       </div>
                                       <div className="text-left">
                                          <div className="font-medium">
                                             {translate(
                                                "dashboard.routes.bills.features.create-bill.recurrence-step.frequency.title",
                                             )}
                                          </div>
                                          <div className="text-sm text-muted-foreground">
                                             {recurrencePattern &&
                                             recurringSection !== "frequency"
                                                ? frequencyLabels[
                                                     recurrencePattern
                                                  ]
                                                : translate(
                                                     "dashboard.routes.bills.features.create-bill.recurrence-step.frequency.description",
                                                  )}
                                          </div>
                                       </div>
                                    </div>
                                    <ChevronDown
                                       className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                                          recurringSection === "frequency"
                                             ? "rotate-180"
                                             : ""
                                       }`}
                                    />
                                 </CollapsibleTrigger>
                                 <CollapsibleContent>
                                    <div className="pt-4">
                                       <form.Field name="recurrencePattern">
                                          {(field) => (
                                             <Choicebox
                                                onValueChange={(value) => {
                                                   field.handleChange(
                                                      value as RecurrencePattern,
                                                   );
                                                   setRecurringSection(
                                                      "occurrence",
                                                   );
                                                }}
                                                value={field.state.value || ""}
                                             >
                                                {frequencyOptions.map(
                                                   (option) => (
                                                      <ChoiceboxItem
                                                         id={`freq-${option}`}
                                                         key={option}
                                                         value={option}
                                                      >
                                                         <ChoiceboxItemHeader>
                                                            <ChoiceboxItemTitle>
                                                               {translate(
                                                                  `dashboard.routes.bills.features.create-bill.recurrence-step.frequency.options.${option}.title`,
                                                               )}
                                                            </ChoiceboxItemTitle>
                                                            <ChoiceboxItemDescription>
                                                               {translate(
                                                                  `dashboard.routes.bills.features.create-bill.recurrence-step.frequency.options.${option}.description`,
                                                               )}
                                                            </ChoiceboxItemDescription>
                                                         </ChoiceboxItemHeader>
                                                         <ChoiceboxIndicator
                                                            id={`freq-${option}`}
                                                         />
                                                      </ChoiceboxItem>
                                                   ),
                                                )}
                                             </Choicebox>
                                          )}
                                       </form.Field>
                                    </div>
                                 </CollapsibleContent>
                              </Collapsible>
                           </div>

                           {/* Step 2: Occurrence */}
                           <div ref={occurrenceSectionRef}>
                              <Collapsible
                                 onOpenChange={(open) => {
                                    if (open && recurrencePattern)
                                       setRecurringSection("occurrence");
                                    else if (occurrenceType)
                                       setRecurringSection("review");
                                    else if (recurrencePattern)
                                       setRecurringSection("frequency");
                                 }}
                                 open={recurringSection === "occurrence"}
                              >
                                 <CollapsibleTrigger
                                    className={`flex w-full items-center justify-between rounded-lg border p-4 transition-colors ${
                                       recurrencePattern
                                          ? "hover:bg-muted/50"
                                          : "opacity-50 cursor-not-allowed"
                                    }`}
                                    disabled={!recurrencePattern}
                                 >
                                    <div className="flex items-center gap-3">
                                       <div
                                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                                             occurrenceType
                                                ? "bg-primary text-primary-foreground"
                                                : "bg-muted text-muted-foreground"
                                          }`}
                                       >
                                          {occurrenceType ? (
                                             <Check className="h-3.5 w-3.5" />
                                          ) : (
                                             "2"
                                          )}
                                       </div>
                                       <div className="text-left">
                                          <div className="font-medium">
                                             {translate(
                                                "dashboard.routes.bills.features.create-bill.recurrence-step.occurrence.title",
                                             )}
                                          </div>
                                          <div className="text-sm text-muted-foreground">
                                             {occurrenceType &&
                                             recurringSection !==
                                                "occurrence" ? (
                                                <>
                                                   {
                                                      occurrenceLabels[
                                                         occurrenceType
                                                      ]
                                                   }
                                                   {occurrenceType ===
                                                      "count" &&
                                                      ` (${occurrenceCount}x)`}
                                                   {occurrenceType ===
                                                      "until-date" &&
                                                      occurrenceUntilDate &&
                                                      ` (${occurrenceUntilDate.toLocaleDateString("pt-BR")})`}
                                                </>
                                             ) : (
                                                translate(
                                                   "dashboard.routes.bills.features.create-bill.recurrence-step.occurrence.description",
                                                )
                                             )}
                                          </div>
                                       </div>
                                    </div>
                                    <ChevronDown
                                       className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                                          recurringSection === "occurrence"
                                             ? "rotate-180"
                                             : ""
                                       }`}
                                    />
                                 </CollapsibleTrigger>
                                 <CollapsibleContent>
                                    <div className="pt-4 space-y-4">
                                       <form.Field name="occurrenceType">
                                          {(field) => (
                                             <Choicebox
                                                onValueChange={(value) => {
                                                   const occ = value as
                                                      | "auto"
                                                      | "count"
                                                      | "until-date";
                                                   field.handleChange(occ);
                                                   if (occ === "auto") {
                                                      setRecurringSection(
                                                         "review",
                                                      );
                                                   }
                                                }}
                                                value={field.state.value || ""}
                                             >
                                                {occurrenceOptions.map(
                                                   (option) => (
                                                      <ChoiceboxItem
                                                         id={`occ-${option}`}
                                                         key={option}
                                                         value={option}
                                                      >
                                                         <ChoiceboxItemHeader>
                                                            <ChoiceboxItemTitle>
                                                               {translate(
                                                                  `dashboard.routes.bills.features.create-bill.recurrence-step.occurrence.options.${option}.title`,
                                                               )}
                                                            </ChoiceboxItemTitle>
                                                            <ChoiceboxItemDescription>
                                                               {translate(
                                                                  `dashboard.routes.bills.features.create-bill.recurrence-step.occurrence.options.${option}.description`,
                                                               )}
                                                            </ChoiceboxItemDescription>
                                                         </ChoiceboxItemHeader>
                                                         <ChoiceboxIndicator
                                                            id={`occ-${option}`}
                                                         />
                                                      </ChoiceboxItem>
                                                   ),
                                                )}
                                             </Choicebox>
                                          )}
                                       </form.Field>

                                       {occurrenceType === "count" && (
                                          <div className="space-y-2">
                                             <Label>
                                                {translate(
                                                   "dashboard.routes.bills.features.create-bill.recurrence-step.occurrence.options.count.input-label",
                                                )}
                                             </Label>
                                             <form.Field name="occurrenceCount">
                                                {(field) => (
                                                   <Input
                                                      max={365}
                                                      min={1}
                                                      onBlur={() => {
                                                         if (
                                                            field.state.value <
                                                            1
                                                         ) {
                                                            field.handleChange(
                                                               1,
                                                            );
                                                         }
                                                      }}
                                                      onChange={(e) => {
                                                         const val =
                                                            e.target.value;
                                                         if (val === "") {
                                                            field.handleChange(
                                                               0,
                                                            );
                                                         } else {
                                                            field.handleChange(
                                                               Number(val),
                                                            );
                                                         }
                                                      }}
                                                      type="number"
                                                      value={
                                                         field.state.value === 0
                                                            ? ""
                                                            : field.state.value
                                                      }
                                                   />
                                                )}
                                             </form.Field>
                                             <Button
                                                className="w-full mt-2"
                                                onClick={() =>
                                                   setRecurringSection("review")
                                                }
                                                size="sm"
                                                type="button"
                                             >
                                                {translate(
                                                   "common.actions.confirm",
                                                )}
                                             </Button>
                                          </div>
                                       )}

                                       {occurrenceType === "until-date" && (
                                          <div className="space-y-2">
                                             <form.Field name="occurrenceUntilDate">
                                                {(field) => (
                                                   <DatePicker
                                                      className="w-full"
                                                      date={field.state.value}
                                                      onSelect={(date) => {
                                                         field.handleChange(
                                                            date,
                                                         );
                                                         if (date) {
                                                            setRecurringSection(
                                                               "review",
                                                            );
                                                         }
                                                      }}
                                                   />
                                                )}
                                             </form.Field>
                                          </div>
                                       )}
                                    </div>
                                 </CollapsibleContent>
                              </Collapsible>
                           </div>

                           {/* Preview - Shows when all steps are complete */}
                           {recurrencePattern &&
                              occurrenceType &&
                              recurringSection === "review" && (
                                 <Alert>
                                    <CalendarCheck className="h-4 w-4" />
                                    <AlertTitle>
                                       {translate(
                                          "dashboard.routes.bills.features.create-bill.recurrence-step.preview.title",
                                       )}
                                    </AlertTitle>
                                    <AlertDescription>
                                       {translate(
                                          "dashboard.routes.bills.features.create-bill.recurrence-step.preview.message",
                                          {
                                             frequency:
                                                frequencyLabels[
                                                   recurrencePattern
                                                ],
                                             type:
                                                occurrenceType === "auto"
                                                   ? translate(
                                                        "dashboard.routes.bills.features.create-bill.recurrence-step.occurrence.options.auto.title",
                                                     )
                                                   : occurrenceType === "count"
                                                     ? `${occurrenceCount}x`
                                                     : occurrenceUntilDate?.toLocaleDateString(
                                                          "pt-BR",
                                                       ) || "",
                                          },
                                       )}
                                    </AlertDescription>
                                 </Alert>
                              )}
                        </>
                     )}

                     {billMode === "installment" && (
                        <>
                           {/* Step 1: Count */}
                           <div ref={countSectionRef}>
                              <Collapsible
                                 onOpenChange={(open) => {
                                    if (open) setInstallmentSection("count");
                                    else if (installmentCount > 0) {
                                       setInstallmentSection("interval");
                                       scrollToSection(intervalSectionRef);
                                    }
                                 }}
                                 open={installmentSection === "count"}
                              >
                                 <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border p-4 hover:bg-muted/50 transition-colors">
                                    <div className="flex items-center gap-3">
                                       <div
                                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                                             installmentCount > 0
                                                ? "bg-primary text-primary-foreground"
                                                : "bg-muted text-muted-foreground"
                                          }`}
                                       >
                                          {installmentCount > 0 ? (
                                             <Check className="h-3.5 w-3.5" />
                                          ) : (
                                             "1"
                                          )}
                                       </div>
                                       <div className="text-left">
                                          <div className="font-medium">
                                             {translate(
                                                "dashboard.routes.bills.features.create-bill.installments.count",
                                             )}
                                          </div>
                                          <div className="text-sm text-muted-foreground">
                                             {installmentSection !== "count" &&
                                             installmentCount > 0
                                                ? `${installmentCount}x`
                                                : translate(
                                                     "dashboard.routes.bills.features.create-bill.recurrence-step.installment.count.description",
                                                  )}
                                          </div>
                                       </div>
                                    </div>
                                    <ChevronDown
                                       className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                                          installmentSection === "count"
                                             ? "rotate-180"
                                             : ""
                                       }`}
                                    />
                                 </CollapsibleTrigger>
                                 <CollapsibleContent>
                                    <div className="pt-3 space-y-3">
                                       <form.Field name="installmentCount">
                                          {(field) => (
                                             <div className="space-y-3">
                                                <div className="flex items-center justify-center gap-4">
                                                   <Button
                                                      className="h-9 w-9 rounded-full"
                                                      disabled={
                                                         field.state.value <= 2
                                                      }
                                                      onClick={() =>
                                                         field.handleChange(
                                                            Math.max(
                                                               2,
                                                               field.state
                                                                  .value - 1,
                                                            ),
                                                         )
                                                      }
                                                      size="icon"
                                                      type="button"
                                                      variant="outline"
                                                   >
                                                      <Minus className="h-4 w-4" />
                                                   </Button>
                                                   <div className="flex flex-col items-center">
                                                      <span className="text-2xl font-bold tabular-nums">
                                                         {field.state.value}
                                                      </span>
                                                      <span className="text-xs text-muted-foreground">
                                                         parcelas
                                                      </span>
                                                   </div>
                                                   <Button
                                                      className="h-9 w-9 rounded-full"
                                                      disabled={
                                                         field.state.value >=
                                                         120
                                                      }
                                                      onClick={() =>
                                                         field.handleChange(
                                                            Math.min(
                                                               120,
                                                               field.state
                                                                  .value + 1,
                                                            ),
                                                         )
                                                      }
                                                      size="icon"
                                                      type="button"
                                                      variant="outline"
                                                   >
                                                      <Plus className="h-4 w-4" />
                                                   </Button>
                                                </div>
                                                <div className="flex flex-wrap justify-center gap-1.5">
                                                   {[2, 3, 6, 10, 12, 24].map(
                                                      (count) => (
                                                         <Button
                                                            className="h-7 px-2.5 text-xs"
                                                            key={`installment-${count}`}
                                                            onClick={() =>
                                                               field.handleChange(
                                                                  count,
                                                               )
                                                            }
                                                            size="sm"
                                                            type="button"
                                                            variant={
                                                               field.state
                                                                  .value ===
                                                               count
                                                                  ? "default"
                                                                  : "outline"
                                                            }
                                                         >
                                                            {count}x
                                                         </Button>
                                                      ),
                                                   )}
                                                </div>
                                             </div>
                                          )}
                                       </form.Field>
                                    </div>
                                 </CollapsibleContent>
                              </Collapsible>
                           </div>

                           {/* Step 2: Interval */}
                           <div ref={intervalSectionRef}>
                              <Collapsible
                                 onOpenChange={(open) => {
                                    if (open) setInstallmentSection("interval");
                                    else if (installmentIntervalType) {
                                       setInstallmentSection("amounts");
                                       scrollToSection(amountsSectionRef);
                                    }
                                 }}
                                 open={installmentSection === "interval"}
                              >
                                 <CollapsibleTrigger
                                    className={`flex w-full items-center justify-between rounded-lg border p-4 transition-colors ${
                                       installmentCount > 0
                                          ? "hover:bg-muted/50"
                                          : "opacity-50 cursor-not-allowed"
                                    }`}
                                    disabled={installmentCount <= 0}
                                 >
                                    <div className="flex items-center gap-3">
                                       <div
                                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                                             installmentIntervalType
                                                ? "bg-primary text-primary-foreground"
                                                : "bg-muted text-muted-foreground"
                                          }`}
                                       >
                                          {installmentIntervalType ? (
                                             <Check className="h-3.5 w-3.5" />
                                          ) : (
                                             "2"
                                          )}
                                       </div>
                                       <div className="text-left">
                                          <div className="font-medium">
                                             {translate(
                                                "dashboard.routes.bills.features.create-bill.installments.interval",
                                             )}
                                          </div>
                                          <div className="text-sm text-muted-foreground">
                                             {installmentSection !==
                                                "interval" &&
                                             installmentIntervalType
                                                ? intervalLabels[
                                                     installmentIntervalType
                                                  ]
                                                : translate(
                                                     "dashboard.routes.bills.features.create-bill.recurrence-step.installment.interval.description",
                                                  )}
                                          </div>
                                       </div>
                                    </div>
                                    <ChevronDown
                                       className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                                          installmentSection === "interval"
                                             ? "rotate-180"
                                             : ""
                                       }`}
                                    />
                                 </CollapsibleTrigger>
                                 <CollapsibleContent>
                                    <div className="pt-4 space-y-4">
                                       <form.Field name="installmentIntervalType">
                                          {(field) => (
                                             <Choicebox
                                                onValueChange={(value) => {
                                                   const interval = value as
                                                      | "monthly"
                                                      | "biweekly"
                                                      | "weekly"
                                                      | "custom";
                                                   field.handleChange(interval);
                                                   if (interval !== "custom") {
                                                      setInstallmentSection(
                                                         "amounts",
                                                      );
                                                   }
                                                }}
                                                value={field.state.value || ""}
                                             >
                                                {intervalOptions.map(
                                                   (option) => (
                                                      <ChoiceboxItem
                                                         id={`interval-${option}`}
                                                         key={option}
                                                         value={option}
                                                      >
                                                         <ChoiceboxItemHeader>
                                                            <ChoiceboxItemTitle>
                                                               {
                                                                  intervalLabels[
                                                                     option
                                                                  ]
                                                               }
                                                            </ChoiceboxItemTitle>
                                                         </ChoiceboxItemHeader>
                                                         <ChoiceboxIndicator
                                                            id={`interval-${option}`}
                                                         />
                                                      </ChoiceboxItem>
                                                   ),
                                                )}
                                             </Choicebox>
                                          )}
                                       </form.Field>

                                       {installmentIntervalType ===
                                          "custom" && (
                                          <div className="space-y-2">
                                             <Label>
                                                {translate(
                                                   "dashboard.routes.bills.features.create-bill.installments.customDays",
                                                )}
                                             </Label>
                                             <form.Field name="installmentCustomDays">
                                                {(field) => (
                                                   <Input
                                                      max={365}
                                                      min={1}
                                                      onBlur={() => {
                                                         if (
                                                            field.state.value <
                                                            1
                                                         ) {
                                                            field.handleChange(
                                                               1,
                                                            );
                                                         }
                                                      }}
                                                      onChange={(e) => {
                                                         const val =
                                                            e.target.value;
                                                         if (val === "") {
                                                            field.handleChange(
                                                               0,
                                                            );
                                                         } else {
                                                            field.handleChange(
                                                               Number(val),
                                                            );
                                                         }
                                                      }}
                                                      type="number"
                                                      value={
                                                         field.state.value === 0
                                                            ? ""
                                                            : field.state.value
                                                      }
                                                   />
                                                )}
                                             </form.Field>
                                             <Button
                                                className="w-full mt-2"
                                                onClick={() => {
                                                   setInstallmentSection(
                                                      "amounts",
                                                   );
                                                   scrollToSection(
                                                      amountsSectionRef,
                                                   );
                                                }}
                                                size="sm"
                                                type="button"
                                             >
                                                {translate(
                                                   "common.actions.confirm",
                                                )}
                                             </Button>
                                          </div>
                                       )}
                                    </div>
                                 </CollapsibleContent>
                              </Collapsible>
                           </div>

                           {/* Step 3: Amounts */}
                           <div ref={amountsSectionRef}>
                              <Collapsible
                                 onOpenChange={(open) => {
                                    if (open) setInstallmentSection("amounts");
                                    else setInstallmentSection("review");
                                 }}
                                 open={installmentSection === "amounts"}
                              >
                                 <CollapsibleTrigger
                                    className={`flex w-full items-center justify-between rounded-lg border p-4 transition-colors ${
                                       installmentIntervalType
                                          ? "hover:bg-muted/50"
                                          : "opacity-50 cursor-not-allowed"
                                    }`}
                                    disabled={!installmentIntervalType}
                                 >
                                    <div className="flex items-center gap-3">
                                       <div
                                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                                             installmentAmountType
                                                ? "bg-primary text-primary-foreground"
                                                : "bg-muted text-muted-foreground"
                                          }`}
                                       >
                                          {installmentAmountType ? (
                                             <Check className="h-3.5 w-3.5" />
                                          ) : (
                                             "3"
                                          )}
                                       </div>
                                       <div className="text-left">
                                          <div className="font-medium">
                                             {translate(
                                                "dashboard.routes.bills.features.create-bill.installments.amountType",
                                             )}
                                          </div>
                                          <div className="text-sm text-muted-foreground">
                                             {installmentSection !==
                                                "amounts" &&
                                             installmentAmountType
                                                ? installmentAmountType ===
                                                  "equal"
                                                   ? translate(
                                                        "dashboard.routes.bills.features.create-bill.installments.amountEqual",
                                                     )
                                                   : translate(
                                                        "dashboard.routes.bills.features.create-bill.installments.amountCustom",
                                                     )
                                                : translate(
                                                     "dashboard.routes.bills.features.create-bill.recurrence-step.installment.amounts.description",
                                                  )}
                                          </div>
                                       </div>
                                    </div>
                                    <ChevronDown
                                       className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                                          installmentSection === "amounts"
                                             ? "rotate-180"
                                             : ""
                                       }`}
                                    />
                                 </CollapsibleTrigger>
                                 <CollapsibleContent>
                                    <div className="pt-4 space-y-4">
                                       <form.Field name="installmentAmountType">
                                          {(field) => (
                                             <Choicebox
                                                onValueChange={(value) => {
                                                   field.handleChange(
                                                      value as
                                                         | "equal"
                                                         | "custom",
                                                   );
                                                   if (value === "equal") {
                                                      setInstallmentSection(
                                                         "review",
                                                      );
                                                   }
                                                }}
                                                value={field.state.value || ""}
                                             >
                                                <ChoiceboxItem
                                                   id="amount-equal"
                                                   value="equal"
                                                >
                                                   <ChoiceboxItemHeader>
                                                      <ChoiceboxItemTitle>
                                                         {translate(
                                                            "dashboard.routes.bills.features.create-bill.installments.amountEqual",
                                                         )}
                                                      </ChoiceboxItemTitle>
                                                      <ChoiceboxItemDescription>
                                                         {translate(
                                                            "dashboard.routes.bills.features.create-bill.recurrence-step.installment.amounts.equal-description",
                                                         )}
                                                      </ChoiceboxItemDescription>
                                                   </ChoiceboxItemHeader>
                                                   <ChoiceboxIndicator id="amount-equal" />
                                                </ChoiceboxItem>
                                                <ChoiceboxItem
                                                   id="amount-custom"
                                                   value="custom"
                                                >
                                                   <ChoiceboxItemHeader>
                                                      <ChoiceboxItemTitle>
                                                         {translate(
                                                            "dashboard.routes.bills.features.create-bill.installments.amountCustom",
                                                         )}
                                                      </ChoiceboxItemTitle>
                                                      <ChoiceboxItemDescription>
                                                         {translate(
                                                            "dashboard.routes.bills.features.create-bill.recurrence-step.installment.amounts.custom-description",
                                                         )}
                                                      </ChoiceboxItemDescription>
                                                   </ChoiceboxItemHeader>
                                                   <ChoiceboxIndicator id="amount-custom" />
                                                </ChoiceboxItem>
                                             </Choicebox>
                                          )}
                                       </form.Field>

                                       {installmentAmountType === "custom" && (
                                          <div className="space-y-2">
                                             {Array.from({
                                                length: installmentCount,
                                             }).map((_, index) => (
                                                <form.Field
                                                   key={`installment-${index + 1}`}
                                                   name="installmentCustomAmounts"
                                                >
                                                   {(field) => (
                                                      <Field>
                                                         <FieldLabel
                                                            htmlFor={`installment-amount-${index}`}
                                                         >
                                                            {translate(
                                                               "dashboard.routes.bills.features.create-bill.installments.installmentLabel",
                                                               {
                                                                  number:
                                                                     index + 1,
                                                               },
                                                            )}
                                                         </FieldLabel>
                                                         <MoneyInput
                                                            id={`installment-amount-${index}`}
                                                            onChange={(
                                                               value,
                                                            ) => {
                                                               const newAmounts =
                                                                  [
                                                                     ...(field
                                                                        .state
                                                                        .value ||
                                                                        []),
                                                                  ];
                                                               newAmounts[
                                                                  index
                                                               ] = value || 0;
                                                               field.handleChange(
                                                                  newAmounts,
                                                               );
                                                            }}
                                                            placeholder="0,00"
                                                            value={
                                                               (field.state
                                                                  .value || [])[
                                                                  index
                                                               ] || 0
                                                            }
                                                            valueInCents={false}
                                                         />
                                                      </Field>
                                                   )}
                                                </form.Field>
                                             ))}

                                             {/* Validation summary */}
                                             <div
                                                className={`p-3 rounded-lg space-y-1.5 text-sm ${
                                                   isCustomAmountsValid
                                                      ? "bg-muted/50"
                                                      : "bg-destructive/10 border border-destructive/20"
                                                }`}
                                             >
                                                <div className="flex justify-between">
                                                   <span className="text-muted-foreground">
                                                      {translate(
                                                         "dashboard.routes.bills.features.create-bill.installments.validation.total",
                                                      )}
                                                   </span>
                                                   <span
                                                      className={`font-medium ${
                                                         isCustomAmountsValid
                                                            ? ""
                                                            : "text-destructive"
                                                      }`}
                                                   >
                                                      {formatDecimalCurrency(
                                                         customAmountsSum,
                                                      )}{" "}
                                                      /{" "}
                                                      {formatDecimalCurrency(
                                                         amount,
                                                      )}
                                                   </span>
                                                </div>
                                                {!isCustomAmountsValid && (
                                                   <div className="text-destructive text-xs">
                                                      {amountDifference > 0
                                                         ? translate(
                                                              "dashboard.routes.bills.features.create-bill.installments.validation.remaining",
                                                              {
                                                                 amount:
                                                                    formatDecimalCurrency(
                                                                       amountDifference,
                                                                    ),
                                                              },
                                                           )
                                                         : translate(
                                                              "dashboard.routes.bills.features.create-bill.installments.validation.excess",
                                                              {
                                                                 amount:
                                                                    formatDecimalCurrency(
                                                                       Math.abs(
                                                                          amountDifference,
                                                                       ),
                                                                    ),
                                                              },
                                                           )}
                                                   </div>
                                                )}
                                             </div>
                                          </div>
                                       )}
                                    </div>
                                 </CollapsibleContent>
                              </Collapsible>
                           </div>
                        </>
                     )}
                  </div>
               );
            }}
         </form.Subscribe>
      );
   }

   function CategorizationStep() {
      return (
         <div className="space-y-4">
            {/* Optional hint */}
            <p className="text-sm text-muted-foreground">
               {translate(
                  "dashboard.routes.bills.features.create-bill.steps.categorization.optional-hint",
               )}
            </p>

            <FieldGroup>
               <form.Field name="category">
                  {(field) => {
                     const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid;

                     const selectedCategory = categories.find(
                        (category) => category.id === field.state.value,
                     );

                     return (
                        <Field data-invalid={isInvalid}>
                           <FieldLabel htmlFor={field.name}>
                              {translate("common.form.category.label")}
                           </FieldLabel>
                           <Popover
                              onOpenChange={setCategoryComboboxOpen}
                              open={categoryComboboxOpen}
                           >
                              <PopoverTrigger asChild>
                                 <Button
                                    aria-expanded={categoryComboboxOpen}
                                    className="w-full justify-between"
                                    role="combobox"
                                    variant="outline"
                                 >
                                    {selectedCategory ? (
                                       <div className="flex items-center gap-2">
                                          <IconDisplay
                                             iconName={
                                                selectedCategory.icon as IconName
                                             }
                                             size={16}
                                          />
                                          <span>{selectedCategory.name}</span>
                                       </div>
                                    ) : (
                                       <span className="text-muted-foreground">
                                          {translate(
                                             "common.form.category.placeholder",
                                          )}
                                       </span>
                                    )}
                                    <ChevronsUpDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                 </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-full p-0">
                                 <Command>
                                    <CommandInput
                                       placeholder={translate(
                                          "common.form.search.placeholder",
                                       )}
                                    />
                                    <CommandList>
                                       <CommandEmpty>
                                          {translate(
                                             "common.form.search.no-results",
                                          )}
                                       </CommandEmpty>
                                       <CommandGroup>
                                          {categories.map((category) => (
                                             <CommandItem
                                                key={category.id}
                                                onSelect={() => {
                                                   field.handleChange(
                                                      category.id ===
                                                         field.state.value
                                                         ? ""
                                                         : category.id,
                                                   );
                                                   setCategoryComboboxOpen(
                                                      false,
                                                   );
                                                }}
                                                value={category.name}
                                             >
                                                <div className="flex items-center gap-2 flex-1">
                                                   <IconDisplay
                                                      iconName={
                                                         category.icon as IconName
                                                      }
                                                      size={16}
                                                   />
                                                   <span>{category.name}</span>
                                                </div>
                                                {field.state.value ===
                                                   category.id && (
                                                   <CheckIcon className="ml-2 h-4 w-4" />
                                                )}
                                             </CommandItem>
                                          ))}
                                       </CommandGroup>
                                    </CommandList>
                                 </Command>
                              </PopoverContent>
                           </Popover>
                           {isInvalid && (
                              <FieldError errors={field.state.meta.errors} />
                           )}
                        </Field>
                     );
                  }}
               </form.Field>
            </FieldGroup>

            <FieldGroup>
               <form.Field name="counterpartyId">
                  {(field) => {
                     const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid;

                     const selectedCounterparty = counterparties.find(
                        (cp) => cp.id === field.state.value,
                     );

                     const filteredCounterparties = counterpartySearch
                        ? counterparties.filter((cp) =>
                             cp.name
                                .toLowerCase()
                                .includes(counterpartySearch.toLowerCase()),
                          )
                        : counterparties;

                     const showQuickCreate =
                        counterpartySearch.length > 0 &&
                        !filteredCounterparties.some(
                           (cp) =>
                              cp.name.toLowerCase() ===
                              counterpartySearch.toLowerCase(),
                        );

                     return (
                        <Field data-invalid={isInvalid}>
                           <FieldLabel htmlFor={field.name}>
                              {translate(
                                 "dashboard.routes.bills.features.create-bill.fields.counterparty",
                              )}
                           </FieldLabel>
                           <Popover
                              onOpenChange={setCounterpartyComboboxOpen}
                              open={counterpartyComboboxOpen}
                           >
                              <PopoverTrigger asChild>
                                 <Button
                                    aria-expanded={counterpartyComboboxOpen}
                                    className="w-full justify-between"
                                    role="combobox"
                                    variant="outline"
                                 >
                                    {selectedCounterparty ? (
                                       <span>{selectedCounterparty.name}</span>
                                    ) : (
                                       <span className="text-muted-foreground">
                                          {translate(
                                             "dashboard.routes.bills.features.create-bill.placeholders.counterparty",
                                          )}
                                       </span>
                                    )}
                                    <ChevronsUpDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                 </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-full p-0">
                                 <Command shouldFilter={false}>
                                    <CommandInput
                                       onValueChange={setCounterpartySearch}
                                       placeholder={translate(
                                          "common.form.search.placeholder",
                                       )}
                                       value={counterpartySearch}
                                    />
                                    <CommandList>
                                       <CommandEmpty>
                                          {translate(
                                             "common.form.search.no-results",
                                          )}
                                       </CommandEmpty>
                                       <CommandGroup>
                                          {filteredCounterparties.map((cp) => (
                                             <CommandItem
                                                key={cp.id}
                                                onSelect={() => {
                                                   field.handleChange(
                                                      cp.id ===
                                                         field.state.value
                                                         ? ""
                                                         : cp.id,
                                                   );
                                                   setCounterpartyComboboxOpen(
                                                      false,
                                                   );
                                                   setCounterpartySearch("");
                                                }}
                                                value={cp.name}
                                             >
                                                <span className="flex-1">
                                                   {cp.name}
                                                </span>
                                                {field.state.value ===
                                                   cp.id && (
                                                   <CheckIcon className="ml-2 h-4 w-4" />
                                                )}
                                             </CommandItem>
                                          ))}
                                       </CommandGroup>
                                       {showQuickCreate && (
                                          <CommandGroup>
                                             <form.Subscribe
                                                selector={(state) =>
                                                   state.values.type
                                                }
                                             >
                                                {(type) => (
                                                   <CommandItem
                                                      onSelect={() =>
                                                         handleQuickCreateCounterparty(
                                                            counterpartySearch,
                                                            type,
                                                         )
                                                      }
                                                   >
                                                      <Plus className="mr-2 h-4 w-4" />
                                                      {translate(
                                                         "dashboard.routes.bills.features.create-bill.quick-create-counterparty",
                                                      )}{" "}
                                                      "{counterpartySearch}"
                                                   </CommandItem>
                                                )}
                                             </form.Subscribe>
                                          </CommandGroup>
                                       )}
                                    </CommandList>
                                 </Command>
                              </PopoverContent>
                           </Popover>
                           {isInvalid && (
                              <FieldError errors={field.state.meta.errors} />
                           )}
                        </Field>
                     );
                  }}
               </form.Field>
            </FieldGroup>

            <FieldGroup>
               <form.Field name="bankAccountId">
                  {(field) => {
                     const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid;
                     return (
                        <Field data-invalid={isInvalid}>
                           <FieldLabel htmlFor={field.name}>
                              {translate("common.form.bank.label")}
                           </FieldLabel>
                           <Select
                              onValueChange={(value) =>
                                 field.handleChange(value)
                              }
                              value={field.state.value}
                           >
                              <SelectTrigger id={field.name}>
                                 <SelectValue
                                    placeholder={translate(
                                       "common.form.bank.placeholder",
                                    )}
                                 />
                              </SelectTrigger>
                              <SelectContent>
                                 {activeBankAccounts.map((account) => (
                                    <SelectItem
                                       key={account.id}
                                       value={account.id}
                                    >
                                       {account.name} - {account.bank}
                                    </SelectItem>
                                 ))}
                              </SelectContent>
                           </Select>
                           {isInvalid && (
                              <FieldError errors={field.state.meta.errors} />
                           )}
                        </Field>
                     );
                  }}
               </form.Field>
            </FieldGroup>

            {/* Cost Center Select */}
            <FieldGroup>
               <form.Field name="costCenterId">
                  {(field) => {
                     const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid;
                     return (
                        <Field data-invalid={isInvalid}>
                           <FieldLabel htmlFor={field.name}>
                              {translate("common.form.cost-center.label")}
                           </FieldLabel>
                           <Select
                              onValueChange={(value) =>
                                 field.handleChange(
                                    value === "none" ? undefined : value,
                                 )
                              }
                              value={field.state.value || "none"}
                           >
                              <SelectTrigger id={field.name}>
                                 <SelectValue
                                    placeholder={translate(
                                       "common.form.cost-center.placeholder",
                                    )}
                                 />
                              </SelectTrigger>
                              <SelectContent>
                                 <SelectItem value="none">-</SelectItem>
                                 {costCenters.map((cc) => (
                                    <SelectItem key={cc.id} value={cc.id}>
                                       {cc.code
                                          ? `${cc.code} - ${cc.name}`
                                          : cc.name}
                                    </SelectItem>
                                 ))}
                              </SelectContent>
                           </Select>
                           {isInvalid && (
                              <FieldError errors={field.state.meta.errors} />
                           )}
                        </Field>
                     );
                  }}
               </form.Field>
            </FieldGroup>

            {/* Tags Multi-Select */}
            <FieldGroup>
               <form.Field name="tagIds">
                  {(field) => {
                     const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid;
                     const selectedTagIds = field.state.value || [];
                     const selectedTags = tags.filter((t) =>
                        selectedTagIds.includes(t.id),
                     );

                     return (
                        <Field data-invalid={isInvalid}>
                           <FieldLabel htmlFor={field.name}>
                              {translate("common.form.tags.label")}
                           </FieldLabel>
                           <Popover>
                              <PopoverTrigger asChild>
                                 <Button
                                    className="w-full justify-between"
                                    variant="outline"
                                 >
                                    {selectedTags.length > 0 ? (
                                       <div className="flex gap-1 flex-wrap">
                                          {selectedTags.map((t) => (
                                             <Badge
                                                key={t.id}
                                                style={{
                                                   backgroundColor: t.color,
                                                }}
                                                variant="secondary"
                                             >
                                                {t.name}
                                             </Badge>
                                          ))}
                                       </div>
                                    ) : (
                                       <span className="text-muted-foreground">
                                          {translate(
                                             "common.form.tags.placeholder",
                                          )}
                                       </span>
                                    )}
                                    <ChevronsUpDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                 </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-full p-0">
                                 <Command>
                                    <CommandInput
                                       placeholder={translate(
                                          "common.form.search.placeholder",
                                       )}
                                    />
                                    <CommandList>
                                       <CommandEmpty>
                                          {translate(
                                             "common.form.search.no-results",
                                          )}
                                       </CommandEmpty>
                                       <CommandGroup>
                                          {tags.map((tag) => {
                                             const isSelected =
                                                selectedTagIds.includes(tag.id);
                                             return (
                                                <CommandItem
                                                   key={tag.id}
                                                   onSelect={() => {
                                                      const newTagIds =
                                                         isSelected
                                                            ? selectedTagIds.filter(
                                                                 (id) =>
                                                                    id !==
                                                                    tag.id,
                                                              )
                                                            : [
                                                                 ...selectedTagIds,
                                                                 tag.id,
                                                              ];
                                                      field.handleChange(
                                                         newTagIds,
                                                      );
                                                   }}
                                                   value={tag.name}
                                                >
                                                   <div className="flex items-center gap-2 flex-1">
                                                      <div
                                                         className="w-3 h-3 rounded-full"
                                                         style={{
                                                            backgroundColor:
                                                               tag.color,
                                                         }}
                                                      />
                                                      <span>{tag.name}</span>
                                                   </div>
                                                   {isSelected && (
                                                      <CheckIcon className="ml-2 h-4 w-4" />
                                                   )}
                                                </CommandItem>
                                             );
                                          })}
                                       </CommandGroup>
                                    </CommandList>
                                 </Command>
                              </PopoverContent>
                           </Popover>
                           {isInvalid && (
                              <FieldError errors={field.state.meta.errors} />
                           )}
                        </Field>
                     );
                  }}
               </form.Field>
            </FieldGroup>

            <form.Subscribe selector={(state) => state.values.type}>
               {(type) =>
                  type === "income" && (
                     <FieldGroup>
                        <form.Field name="interestTemplateId">
                           {(field) => {
                              const isInvalid =
                                 field.state.meta.isTouched &&
                                 !field.state.meta.isValid;
                              return (
                                 <Field data-invalid={isInvalid}>
                                    <FieldLabel htmlFor={field.name}>
                                       {translate(
                                          "dashboard.routes.bills.features.create-bill.fields.interestTemplate",
                                       )}
                                    </FieldLabel>
                                    <Select
                                       onValueChange={(value) =>
                                          field.handleChange(value)
                                       }
                                       value={field.state.value}
                                    >
                                       <SelectTrigger id={field.name}>
                                          <SelectValue
                                             placeholder={translate(
                                                "dashboard.routes.bills.features.create-bill.placeholders.interestTemplate",
                                             )}
                                          />
                                       </SelectTrigger>
                                       <SelectContent>
                                          {interestTemplates.map((template) => (
                                             <SelectItem
                                                key={template.id}
                                                value={template.id}
                                             >
                                                {template.name}
                                             </SelectItem>
                                          ))}
                                       </SelectContent>
                                    </Select>
                                    {isInvalid && (
                                       <FieldError
                                          errors={field.state.meta.errors}
                                       />
                                    )}
                                 </Field>
                              );
                           }}
                        </form.Field>
                     </FieldGroup>
                  )
               }
            </form.Subscribe>
         </div>
      );
   }

   return (
      <Stepper.Provider className="h-full" initialStep={activeSteps[0]}>
         {({ methods }) => {
            const currentId = methods.current.id;

            const goToNextStep = () => {
               if (currentId === undefined) return;
               const currentIndex = activeSteps.indexOf(currentId as StepId);
               const nextIndex = currentIndex + 1;
               const nextStep = activeSteps[nextIndex];
               if (nextStep !== undefined) {
                  methods.goTo(nextStep);
               }
            };

            const goToPrevStep = () => {
               if (currentId === undefined) return;
               const currentIndex = activeSteps.indexOf(currentId as StepId);
               const prevIndex = currentIndex - 1;
               const prevStep = activeSteps[prevIndex];
               if (prevStep !== undefined) {
                  methods.goTo(prevStep);
               }
            };

            const isLastActiveStep =
               currentId === activeSteps[activeSteps.length - 1];

            return (
               <form className="h-full flex flex-col" onSubmit={handleSubmit}>
                  <SheetHeader>
                     <SheetTitle className="flex items-center gap-2">
                        {modeTexts.title}
                        {isEditMode && bill?.installmentGroupId && (
                           <Badge variant="secondary">
                              {translate(
                                 "dashboard.routes.bills.features.create-bill.installments.badge",
                                 {
                                    current: bill.installmentNumber,
                                    total: bill.totalInstallments,
                                 },
                              )}
                           </Badge>
                        )}
                     </SheetTitle>
                     <SheetDescription>
                        {modeTexts.description}
                     </SheetDescription>
                  </SheetHeader>

                  <div className="px-4 py-2">
                     <Stepper.Navigation>
                        {allSteps
                           .filter((step) => activeSteps.includes(step.id))
                           .map((step) => (
                              <Stepper.Step key={step.id} of={step.id} />
                           ))}
                     </Stepper.Navigation>
                  </div>

                  <div className="px-4 flex-1 overflow-y-auto">
                     {methods.switch({
                        "bill-mode": () => <BillModeStep />,
                        "bill-type": () => <BillTypeStep />,
                        categorization: () => <CategorizationStep />,
                        details: () => <DetailsStep />,
                        recurrence: () => <RecurrenceStep />,
                     })}
                  </div>

                  <SheetFooter className="px-4">
                     <Stepper.Controls className="flex flex-col w-full gap-2">
                        {methods.current.id === "bill-type" ? (
                           <form.Subscribe
                              selector={(state) => ({
                                 billCategoryValue: state.values.billCategory,
                              })}
                           >
                              {({ billCategoryValue }) => (
                                 <Button
                                    className="w-full"
                                    disabled={!billCategoryValue}
                                    onClick={(e) => {
                                       e.preventDefault();
                                       e.stopPropagation();
                                       goToNextStep();
                                    }}
                                    type="button"
                                 >
                                    {translate("common.actions.next")}
                                 </Button>
                              )}
                           </form.Subscribe>
                        ) : methods.current.id === "bill-mode" ? (
                           <form.Subscribe
                              selector={(state) => ({
                                 billModeValue: state.values.billMode,
                              })}
                           >
                              {({ billModeValue }) => (
                                 <>
                                    <Button
                                       className="w-full"
                                       onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          goToPrevStep();
                                       }}
                                       type="button"
                                       variant="ghost"
                                    >
                                       {translate("common.actions.previous")}
                                    </Button>
                                    <Button
                                       className="w-full"
                                       disabled={!billModeValue}
                                       onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          goToNextStep();
                                       }}
                                       type="button"
                                    >
                                       {translate("common.actions.next")}
                                    </Button>
                                 </>
                              )}
                           </form.Subscribe>
                        ) : methods.current.id === "details" ? (
                           <form.Subscribe
                              selector={(state) => ({
                                 amountValid:
                                    state.fieldMeta.amount?.isValid !== false,
                                 descriptionValid:
                                    state.fieldMeta.description?.isValid !==
                                    false,
                                 dueDateValid:
                                    state.fieldMeta.dueDate?.isValid !== false,
                              })}
                           >
                              {({
                                 amountValid,
                                 descriptionValid,
                                 dueDateValid,
                              }) => (
                                 <>
                                    {!isEditMode && (
                                       <Button
                                          className="w-full"
                                          onClick={(e) => {
                                             e.preventDefault();
                                             e.stopPropagation();
                                             goToPrevStep();
                                          }}
                                          type="button"
                                          variant="ghost"
                                       >
                                          {translate("common.actions.previous")}
                                       </Button>
                                    )}
                                    <Button
                                       className="w-full"
                                       disabled={
                                          !amountValid ||
                                          !descriptionValid ||
                                          !dueDateValid
                                       }
                                       onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          goToNextStep();
                                       }}
                                       type="button"
                                    >
                                       {translate("common.actions.next")}
                                    </Button>
                                 </>
                              )}
                           </form.Subscribe>
                        ) : methods.current.id === "recurrence" ? (
                           <form.Subscribe
                              selector={(state) => ({
                                 amount: state.values.amount,
                                 installmentAmountType:
                                    state.values.installmentAmountType,
                                 installmentCustomAmounts:
                                    state.values.installmentCustomAmounts,
                              })}
                           >
                              {({
                                 amount,
                                 installmentAmountType,
                                 installmentCustomAmounts,
                              }) => {
                                 const {
                                    customAmountsSum,
                                    amountDifference,
                                    isValid: isCustomAmountsValid,
                                 } = getCustomAmountsValidation(
                                    amount,
                                    installmentAmountType,
                                    installmentCustomAmounts,
                                 );

                                 return (
                                    <>
                                       <Button
                                          className="w-full"
                                          onClick={(e) => {
                                             e.preventDefault();
                                             e.stopPropagation();
                                             goToPrevStep();
                                          }}
                                          type="button"
                                          variant="ghost"
                                       >
                                          {translate("common.actions.previous")}
                                       </Button>
                                       <Button
                                          className="w-full"
                                          disabled={!isCustomAmountsValid}
                                          onClick={(e) => {
                                             e.preventDefault();
                                             e.stopPropagation();
                                             goToNextStep();
                                          }}
                                          type="button"
                                       >
                                          {translate("common.actions.next")}
                                       </Button>
                                       {!isCustomAmountsValid && (
                                          <p className="text-xs text-destructive text-center">
                                             {amountDifference > 0
                                                ? translate(
                                                     "dashboard.routes.bills.features.create-bill.installments.validation.remaining",
                                                     {
                                                        amount:
                                                           formatDecimalCurrency(
                                                              amountDifference,
                                                           ),
                                                     },
                                                  )
                                                : translate(
                                                     "dashboard.routes.bills.features.create-bill.installments.validation.excess",
                                                     {
                                                        amount:
                                                           formatDecimalCurrency(
                                                              Math.abs(
                                                                 amountDifference,
                                                              ),
                                                           ),
                                                     },
                                                  )}
                                          </p>
                                       )}
                                    </>
                                 );
                              }}
                           </form.Subscribe>
                        ) : isLastActiveStep ? (
                           <form.Subscribe
                              selector={(state) => ({
                                 canSubmit: state.canSubmit,
                                 isSubmitting: state.isSubmitting,
                              })}
                           >
                              {({ canSubmit, isSubmitting }) => (
                                 <>
                                    <Button
                                       className="w-full"
                                       onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          goToPrevStep();
                                       }}
                                       type="button"
                                       variant="ghost"
                                    >
                                       {translate("common.actions.previous")}
                                    </Button>
                                    <Button
                                       className="w-full"
                                       disabled={
                                          !canSubmit ||
                                          isSubmitting ||
                                          isPending
                                       }
                                       type="submit"
                                    >
                                       {translate("common.actions.submit")}
                                    </Button>
                                 </>
                              )}
                           </form.Subscribe>
                        ) : (
                           <>
                              <Button
                                 className="w-full"
                                 onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    goToPrevStep();
                                 }}
                                 type="button"
                                 variant="ghost"
                              >
                                 {translate("common.actions.previous")}
                              </Button>
                              <Button
                                 className="w-full"
                                 onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    goToNextStep();
                                 }}
                                 type="button"
                              >
                                 {translate("common.actions.next")}
                              </Button>
                           </>
                        )}
                     </Stepper.Controls>
                  </SheetFooter>
               </form>
            );
         }}
      </Stepper.Provider>
   );
}
