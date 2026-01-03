import type { RouterOutput } from "@packages/api/client";
import { translate } from "@packages/localization";
import {
   Announcement,
   AnnouncementTag,
   AnnouncementTitle,
} from "@packages/ui/components/announcement";
import {
   Card,
   CardContent,
   CardDescription,
   CardHeader,
   CardTitle,
} from "@packages/ui/components/card";
import { formatDate } from "@packages/utils/date";
import { Calendar, Clock, FolderOpen, Target } from "lucide-react";

type Budget = RouterOutput["budgets"]["getById"];
type BudgetTarget =
   | { type: "category"; categoryId: string }
   | { type: "categories"; categoryIds: string[] }
   | { type: "tag"; tagId: string }
   | { type: "cost_center"; costCenterId: string };

interface BudgetInformationSectionProps {
   budget: Budget;
}

function formatBudgetDate(date: Date | string | null): string {
   if (!date) return "-";
   return formatDate(new Date(date), "DD/MM/YYYY HH:mm");
}

export function BudgetInformationSection({
   budget,
}: BudgetInformationSectionProps) {
   const periodLabels: Record<string, string> = {
      custom: translate("dashboard.routes.budgets.form.period.custom"),
      daily: translate("dashboard.routes.budgets.form.period.daily"),
      monthly: translate("dashboard.routes.budgets.form.period.monthly"),
      quarterly: translate("dashboard.routes.budgets.form.period.quarterly"),
      weekly: translate("dashboard.routes.budgets.form.period.weekly"),
      yearly: translate("dashboard.routes.budgets.form.period.yearly"),
   };

   const targetTypeLabels: Record<string, string> = {
      categories: translate("dashboard.routes.budgets.form.target.categories"),
      category: translate("dashboard.routes.budgets.form.target.category"),
      cost_center: translate(
         "dashboard.routes.budgets.form.target.cost_center",
      ),
      tag: translate("dashboard.routes.budgets.form.target.tag"),
   };

   const target = budget.target as BudgetTarget;
   const targetLabel = targetTypeLabels[target.type] ?? "-";
   const periodLabel =
      periodLabels[budget.periodType as string] ?? periodLabels.monthly ?? "-";

   return (
      <Card>
         <CardHeader>
            <CardTitle>Informações</CardTitle>
            <CardDescription>Detalhes e configurações do orçamento</CardDescription>
         </CardHeader>
         <CardContent>
            <div className="flex flex-wrap gap-2">
               <Announcement>
                  <AnnouncementTag className="flex items-center gap-1.5">
                     <Target className="size-3.5" />
                     {translate(
                        "dashboard.routes.budgets.details.information.target",
                     )}
                  </AnnouncementTag>
                  <AnnouncementTitle>{targetLabel}</AnnouncementTitle>
               </Announcement>

               <Announcement>
                  <AnnouncementTag className="flex items-center gap-1.5">
                     <Calendar className="size-3.5" />
                     {translate(
                        "dashboard.routes.budgets.details.information.period",
                     )}
                  </AnnouncementTag>
                  <AnnouncementTitle>{periodLabel}</AnnouncementTitle>
               </Announcement>

               <div className="h-4 w-px bg-border" />

               <Announcement>
                  <AnnouncementTag className="flex items-center gap-1.5">
                     <Clock className="size-3.5" />
                     {translate(
                        "dashboard.routes.budgets.details.information.created-at",
                     )}
                  </AnnouncementTag>
                  <AnnouncementTitle>
                     {formatBudgetDate(budget.createdAt)}
                  </AnnouncementTitle>
               </Announcement>

               <Announcement>
                  <AnnouncementTag className="flex items-center gap-1.5">
                     <FolderOpen className="size-3.5" />
                     {translate(
                        "dashboard.routes.budgets.details.information.updated-at",
                     )}
                  </AnnouncementTag>
                  <AnnouncementTitle>
                     {formatBudgetDate(budget.updatedAt)}
                  </AnnouncementTitle>
               </Announcement>
            </div>
         </CardContent>
      </Card>
   );
}
