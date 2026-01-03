import { translate } from "@packages/localization";
import { Button } from "@packages/ui/components/button";
import {
   CredenzaBody,
   CredenzaDescription,
   CredenzaFooter,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import { DatePicker } from "@packages/ui/components/date-picker";
import { Field, FieldGroup, FieldLabel } from "@packages/ui/components/field";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
import {
   getDateRangeForPeriod,
   TIME_PERIODS,
   type TimePeriod,
   type TimePeriodDateRange,
} from "@packages/ui/components/time-period-chips";
import {
   ToggleGroup,
   ToggleGroupItem,
} from "@packages/ui/components/toggle-group";
import { cn } from "@packages/ui/lib/utils";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, X } from "lucide-react";
import { useCredenza } from "@/hooks/use-credenza";

type TagFilterCredenzaProps = {
   timePeriod: TimePeriod | null;
   onTimePeriodChange: (
      period: TimePeriod | null,
      range: TimePeriodDateRange,
   ) => void;
   customStartDate?: Date | null;
   customEndDate?: Date | null;
   onCustomStartDateChange: (date: Date | undefined) => void;
   onCustomEndDateChange: (date: Date | undefined) => void;
   typeFilter: string;
   onTypeFilterChange: (value: string) => void;
   orderBy: "name" | "createdAt" | "updatedAt";
   orderDirection: "asc" | "desc";
   pageSize?: number;
   onOrderByChange: (value: "name" | "createdAt" | "updatedAt") => void;
   onOrderDirectionChange: (value: "asc" | "desc") => void;
   onPageSizeChange?: (value: number) => void;
   onClearFilters: () => void;
   hasActiveFilters: boolean;
};

export function TagFilterCredenza({
   timePeriod,
   onTimePeriodChange,
   customStartDate,
   customEndDate,
   onCustomStartDateChange,
   onCustomEndDateChange,
   typeFilter,
   onTypeFilterChange,
   orderBy,
   orderDirection,
   pageSize,
   onOrderByChange,
   onOrderDirectionChange,
   onPageSizeChange,
   onClearFilters,
   hasActiveFilters,
}: TagFilterCredenzaProps) {
   const { closeCredenza } = useCredenza();

   const orderByOptions = [
      {
         label: translate("common.form.name.label"),
         value: "name" as const,
      },
      {
         label: translate("common.form.created-at.label"),
         value: "createdAt" as const,
      },
      {
         label: translate("common.form.updated-at.label"),
         value: "updatedAt" as const,
      },
   ];

   const orderDirectionOptions = [
      {
         label: translate("common.form.sort-ascending.label"),
         value: "asc" as const,
      },
      {
         label: translate("common.form.sort-descending.label"),
         value: "desc" as const,
      },
   ];

   const handlePeriodClick = (period: TimePeriod) => {
      const range = getDateRangeForPeriod(period);
      onTimePeriodChange(period, range);
   };

   const isCustomMode = timePeriod === "custom";

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>
               {translate("dashboard.routes.tags.features.filter.title")}
            </CredenzaTitle>
            <CredenzaDescription>
               {translate("dashboard.routes.tags.features.filter.description")}
            </CredenzaDescription>
         </CredenzaHeader>

         <CredenzaBody>
            <div className="grid gap-4">
               {hasActiveFilters && (
                  <Button
                     className="w-full flex items-center justify-center gap-2"
                     onClick={onClearFilters}
                     variant="outline"
                  >
                     <X className="size-4" />
                     {translate("common.form.filter.clear-all")}
                  </Button>
               )}

               <FieldGroup>
                  <Field>
                     <FieldLabel>
                        {translate("common.form.period.label")}
                     </FieldLabel>
                     <div className="grid grid-cols-2 gap-2">
                        {TIME_PERIODS.map((period) => {
                           const Icon = period.icon;
                           const isSelected = timePeriod === period.value;
                           return (
                              <Button
                                 className={cn(
                                    "justify-start gap-2",
                                    isSelected &&
                                       "bg-primary/10 border-primary text-primary",
                                 )}
                                 key={period.value}
                                 onClick={() => handlePeriodClick(period.value)}
                                 size="sm"
                                 variant="outline"
                              >
                                 <Icon className="size-3.5" />
                                 {period.label}
                              </Button>
                           );
                        })}
                        <Button
                           className={cn(
                              "justify-start gap-2 col-span-2",
                              isCustomMode &&
                                 "bg-primary/10 border-primary text-primary",
                           )}
                           onClick={() =>
                              onTimePeriodChange("custom", {
                                 endDate: customEndDate || null,
                                 selectedMonth: new Date(),
                                 startDate: customStartDate || null,
                              })
                           }
                           size="sm"
                           variant="outline"
                        >
                           {translate("common.form.date-range.custom")}
                        </Button>
                     </div>
                  </Field>
               </FieldGroup>

               {isCustomMode && (
                  <FieldGroup>
                     <Field>
                        <FieldLabel>
                           {translate("common.form.date-range.start")}
                        </FieldLabel>
                        <DatePicker
                           date={customStartDate || undefined}
                           onSelect={onCustomStartDateChange}
                           placeholder={translate(
                              "common.form.date.placeholder",
                           )}
                        />
                     </Field>
                     <Field>
                        <FieldLabel>
                           {translate("common.form.date-range.end")}
                        </FieldLabel>
                        <DatePicker
                           date={customEndDate || undefined}
                           onSelect={onCustomEndDateChange}
                           placeholder={translate(
                              "common.form.date.placeholder",
                           )}
                        />
                     </Field>
                  </FieldGroup>
               )}

               <FieldGroup>
                  <Field>
                     <FieldLabel>
                        {translate("common.form.type.label")}
                     </FieldLabel>
                     <ToggleGroup
                        className="justify-start"
                        onValueChange={onTypeFilterChange}
                        size="sm"
                        spacing={2}
                        type="single"
                        value={typeFilter}
                        variant="outline"
                     >
                        <ToggleGroupItem
                           className="gap-1.5 data-[state=on]:bg-transparent data-[state=on]:border-emerald-500 data-[state=on]:text-emerald-600"
                           value="income"
                        >
                           <ArrowDownLeft className="size-3.5" />
                           {translate(
                              "dashboard.routes.transactions.list-section.types.income",
                           )}
                        </ToggleGroupItem>
                        <ToggleGroupItem
                           className="gap-1.5 data-[state=on]:bg-transparent data-[state=on]:border-red-500 data-[state=on]:text-red-600"
                           value="expense"
                        >
                           <ArrowUpRight className="size-3.5" />
                           {translate(
                              "dashboard.routes.transactions.list-section.types.expense",
                           )}
                        </ToggleGroupItem>
                        <ToggleGroupItem
                           className="gap-1.5 data-[state=on]:bg-transparent data-[state=on]:border-blue-500 data-[state=on]:text-blue-600"
                           value="transfer"
                        >
                           <ArrowLeftRight className="size-3.5" />
                           {translate(
                              "dashboard.routes.transactions.list-section.types.transfer",
                           )}
                        </ToggleGroupItem>
                     </ToggleGroup>
                  </Field>
               </FieldGroup>

               <FieldGroup>
                  <Field>
                     <FieldLabel>
                        {translate("common.form.sort-by.label")}
                     </FieldLabel>
                     <Select
                        onValueChange={(
                           value: "name" | "createdAt" | "updatedAt",
                        ) => onOrderByChange(value)}
                        value={orderBy}
                     >
                        <SelectTrigger>
                           <SelectValue
                              placeholder={translate(
                                 "common.form.sort-by.placeholder",
                              )}
                           />
                        </SelectTrigger>
                        <SelectContent>
                           {orderByOptions.map((option) => (
                              <SelectItem
                                 key={option.value}
                                 value={option.value}
                              >
                                 {option.label}
                              </SelectItem>
                           ))}
                        </SelectContent>
                     </Select>
                  </Field>
               </FieldGroup>

               <FieldGroup>
                  <Field>
                     <FieldLabel>
                        {translate("common.form.order-direction.label")}
                     </FieldLabel>
                     <Select
                        onValueChange={(value: "asc" | "desc") =>
                           onOrderDirectionChange(value)
                        }
                        value={orderDirection}
                     >
                        <SelectTrigger>
                           <SelectValue
                              placeholder={translate(
                                 "common.form.order-direction.placeholder",
                              )}
                           />
                        </SelectTrigger>
                        <SelectContent>
                           {orderDirectionOptions.map((option) => (
                              <SelectItem
                                 key={option.value}
                                 value={option.value}
                              >
                                 {option.label}
                              </SelectItem>
                           ))}
                        </SelectContent>
                     </Select>
                  </Field>
               </FieldGroup>

               {onPageSizeChange && (
                  <FieldGroup>
                     <Field>
                        <FieldLabel>
                           {translate(
                              "dashboard.routes.transactions.features.filter.page-size.label",
                           )}
                        </FieldLabel>
                        <Select
                           onValueChange={(value) =>
                              onPageSizeChange(Number(value))
                           }
                           value={pageSize?.toString()}
                        >
                           <SelectTrigger>
                              <SelectValue />
                           </SelectTrigger>
                           <SelectContent>
                              {[5, 10, 20, 30, 50].map((size) => (
                                 <SelectItem key={size} value={size.toString()}>
                                    {size}
                                 </SelectItem>
                              ))}
                           </SelectContent>
                        </Select>
                     </Field>
                  </FieldGroup>
               )}
            </div>
         </CredenzaBody>

         <CredenzaFooter>
            <Button onClick={() => closeCredenza()} variant="outline">
               {translate("common.actions.close")}
            </Button>
         </CredenzaFooter>
      </>
   );
}
