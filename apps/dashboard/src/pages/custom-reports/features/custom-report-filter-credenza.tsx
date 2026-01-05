import type { ReportType } from "@packages/database/schemas/custom-reports";
import { translate } from "@packages/localization";
import { Button } from "@packages/ui/components/button";
import {
   CredenzaBody,
   CredenzaDescription,
   CredenzaFooter,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import { Field, FieldGroup, FieldLabel } from "@packages/ui/components/field";
import { cn } from "@packages/ui/lib/utils";
import {
   BarChart3,
   Calculator,
   FileText,
   PieChart,
   Target,
   TrendingUp,
   Users,
   Wallet,
   X,
} from "lucide-react";
import { useCredenza } from "@/hooks/use-credenza";

type CustomReportFilterCredenzaProps = {
   typeFilter: ReportType | undefined;
   onTypeFilterChange: (value: ReportType | undefined) => void;
   hasActiveFilters: boolean;
   onClearFilters: () => void;
};

const REPORT_TYPES = [
   {
      value: undefined as ReportType | undefined,
      label: "Todos",
      icon: FileText,
   },
   {
      value: "dre_gerencial" as ReportType,
      label: "DRE Gerencial",
      icon: BarChart3,
   },
   {
      value: "dre_fiscal" as ReportType,
      label: "DRE Fiscal",
      icon: Calculator,
   },
   {
      value: "budget_vs_actual" as ReportType,
      label: "Budget vs Atual",
      icon: Target,
   },
   {
      value: "spending_trends" as ReportType,
      label: "Tendências",
      icon: TrendingUp,
   },
   {
      value: "cash_flow_forecast" as ReportType,
      label: "Fluxo de Caixa",
      icon: Wallet,
   },
   {
      value: "counterparty_analysis" as ReportType,
      label: "Parceiros",
      icon: Users,
   },
   {
      value: "category_analysis" as ReportType,
      label: "Análise por Categoria",
      icon: PieChart,
   },
] as const;

export function CustomReportFilterCredenza({
   typeFilter,
   onTypeFilterChange,
   hasActiveFilters,
   onClearFilters,
}: CustomReportFilterCredenzaProps) {
   const { closeCredenza } = useCredenza();

   const handleTypeSelect = (value: ReportType | undefined) => {
      onTypeFilterChange(value);
   };

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>Filtrar Relatórios</CredenzaTitle>
            <CredenzaDescription>
               Selecione o tipo de relatório para filtrar
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
                     <FieldLabel>Tipo de Relatório</FieldLabel>
                     <div className="grid grid-cols-2 gap-2">
                        {REPORT_TYPES.map((reportType) => {
                           const Icon = reportType.icon;
                           const isSelected = typeFilter === reportType.value;
                           return (
                              <Button
                                 className={cn(
                                    "justify-start gap-2",
                                    isSelected &&
                                       "bg-primary/10 border-primary text-primary",
                                 )}
                                 key={reportType.value ?? "all"}
                                 onClick={() =>
                                    handleTypeSelect(reportType.value)
                                 }
                                 size="sm"
                                 variant="outline"
                              >
                                 <Icon className="size-3.5" />
                                 {reportType.label}
                              </Button>
                           );
                        })}
                     </div>
                  </Field>
               </FieldGroup>
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
