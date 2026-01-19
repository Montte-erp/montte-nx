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
import { useQuery } from "@tanstack/react-query";
import { Calendar, Clock, FolderOpen, Layers, Tag } from "lucide-react";
import { useTRPC } from "@/integrations/clients";

type Budget = RouterOutput["budgets"]["getById"];

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
   const trpc = useTRPC();
   const { data: tags = [] } = useQuery(trpc.tags.getAll.queryOptions());
   const { data: categories = [] } = useQuery(
      trpc.categories.getAll.queryOptions(),
   );

   const periodLabels: Record<string, string> = {
      custom: "Personalizado",
      daily: "Diário",
      monthly: "Mensal",
      quarterly: "Trimestral",
      weekly: "Semanal",
      yearly: "Anual",
   };

   // Find the tag associated with this budget
   const linkedTag = tags.find((tag) => tag.id === budget.tagId);
   const tagLabel = linkedTag?.name ?? "Tag não encontrada";
   const tagColor = linkedTag?.color ?? "#6b7280";
   const periodLabel =
      periodLabels[budget.periodType as string] ?? periodLabels.monthly ?? "-";

   // Get linked categories from metadata
   const linkedCategoryIds =
      (budget.metadata as { linkedCategoryIds?: string[] })
         ?.linkedCategoryIds ?? [];
   const linkedCategories = categories.filter((cat) =>
      linkedCategoryIds.includes(cat.id),
   );

   return (
      <Card>
         <CardHeader>
            <CardTitle>Informações</CardTitle>
            <CardDescription>
               Detalhes e configurações do orçamento
            </CardDescription>
         </CardHeader>
         <CardContent>
            <div className="flex flex-wrap gap-2">
               <Announcement>
                  <AnnouncementTag
                     className="flex items-center gap-1.5"
                     style={{
                        backgroundColor: `${tagColor}20`,
                        color: tagColor,
                     }}
                  >
                     <Tag className="size-3.5" />
                     Tag
                  </AnnouncementTag>
                  <AnnouncementTitle>{tagLabel}</AnnouncementTitle>
               </Announcement>

               <Announcement>
                  <AnnouncementTag className="flex items-center gap-1.5">
                     <Calendar className="size-3.5" />
                     Período
                  </AnnouncementTag>
                  <AnnouncementTitle>{periodLabel}</AnnouncementTitle>
               </Announcement>

               {linkedCategories.length > 0 && (
                  <Announcement>
                     <AnnouncementTag className="flex items-center gap-1.5">
                        <Layers className="size-3.5" />
                        Categorias
                     </AnnouncementTag>
                     <AnnouncementTitle>
                        <div className="flex flex-wrap gap-1">
                           {linkedCategories.map((cat) => (
                              <span
                                 className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
                                 key={cat.id}
                                 style={{
                                    backgroundColor: `${cat.color}20`,
                                    color: cat.color,
                                 }}
                              >
                                 {cat.name}
                              </span>
                           ))}
                        </div>
                     </AnnouncementTitle>
                  </Announcement>
               )}

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
