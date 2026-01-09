import type { RouterOutput } from "@packages/api/client";
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
      custom: "Personalizado",
      daily: "Diário",
      monthly: "Mensal",
      quarterly: "Trimestral",
      weekly: "Semanal",
      yearly: "Anual",
   };

   const targetTypeLabels: Record<string, string> = {
      categories: "Múltiplas categorias",
      category: "Categoria única",
      cost_center: "Centro de custo",
      tag: "Tag",
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
                     Alvo
                  </AnnouncementTag>
                  <AnnouncementTitle>{targetLabel}</AnnouncementTitle>
               </Announcement>

               <Announcement>
                  <AnnouncementTag className="flex items-center gap-1.5">
                     <Calendar className="size-3.5" />
                     Período
                  </AnnouncementTag>
                  <AnnouncementTitle>{periodLabel}</AnnouncementTitle>
               </Announcement>

               <div className="h-4 w-px bg-border" />

               <Announcement>
                  <AnnouncementTag className="flex items-center gap-1.5">
                     <Clock className="size-3.5" />
                     Criado em
                  </AnnouncementTag>
                  <AnnouncementTitle>
                     {formatBudgetDate(budget.createdAt)}
                  </AnnouncementTitle>
               </Announcement>

               <Announcement>
                  <AnnouncementTag className="flex items-center gap-1.5">
                     <FolderOpen className="size-3.5" />
                     Atualizado em
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
