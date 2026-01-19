import type { RouterOutput } from "@packages/api/client";
import { formatDecimalCurrency } from "@packages/money";
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
import {
   Calendar,
   CheckCircle,
   CircleDashed,
   Clock,
   PauseCircle,
   Tag,
   Target,
   TrendingUp,
   Wallet,
   XCircle,
} from "lucide-react";

type Goal = RouterOutput["goals"]["getById"];

type GoalMetadataCardProps = {
   goal: Goal;
};

const STATUS_CONFIG = {
   active: { label: "Ativa", color: "#10b981", icon: CheckCircle },
   completed: { label: "Concluida", color: "#3b82f6", icon: CheckCircle },
   paused: { label: "Pausada", color: "#eab308", icon: PauseCircle },
   cancelled: { label: "Cancelada", color: "#6b7280", icon: XCircle },
};

const CALCULATION_TYPE_LABELS = {
   income: "Receitas",
   expense: "Despesas",
   net: "Saldo Liquido",
};

export function GoalMetadataCard({ goal }: GoalMetadataCardProps) {
   const targetAmount = Number(goal.targetAmount);
   const startingAmount = Number(goal.startingAmount);
   const currentAmount = goal.currentAmount;
   const remaining = Math.max(0, targetAmount - currentAmount);
   const percentage =
      targetAmount > 0
         ? Math.min(100, Math.round((currentAmount / targetAmount) * 100))
         : 0;

   const statusConfig = STATUS_CONFIG[goal.status];
   const StatusIcon = statusConfig.icon;

   const createdAt = formatDate(new Date(goal.createdAt), "DD/MM/YYYY");
   const targetDateFormatted = goal.targetDate
      ? formatDate(new Date(goal.targetDate), "DD/MM/YYYY")
      : null;

   const daysRemaining = goal.targetDate
      ? Math.ceil(
           (new Date(goal.targetDate).getTime() - Date.now()) /
              (1000 * 60 * 60 * 24),
        )
      : null;

   return (
      <Card className="h-fit">
         <CardHeader>
            <CardTitle>Metadados</CardTitle>
            <CardDescription>Informacoes da meta</CardDescription>
         </CardHeader>
         <CardContent>
            <div className="flex flex-wrap gap-2">
               <Announcement>
                  <AnnouncementTag
                     className="flex items-center gap-1.5"
                     style={{
                        backgroundColor: `${goal.tag.color}20`,
                        color: goal.tag.color,
                     }}
                  >
                     <Tag className="size-3.5" />
                     Tag
                  </AnnouncementTag>
                  <AnnouncementTitle>{goal.tag.name}</AnnouncementTitle>
               </Announcement>

               <Announcement>
                  <AnnouncementTag
                     className="flex items-center gap-1.5"
                     style={{ color: statusConfig.color }}
                  >
                     <StatusIcon className="size-3.5" />
                     Status
                  </AnnouncementTag>
                  <AnnouncementTitle>{statusConfig.label}</AnnouncementTitle>
               </Announcement>

               <Announcement>
                  <AnnouncementTag className="flex items-center gap-1.5">
                     <Target className="size-3.5" />
                     Meta
                  </AnnouncementTag>
                  <AnnouncementTitle className="text-primary">
                     {formatDecimalCurrency(targetAmount)}
                  </AnnouncementTitle>
               </Announcement>

               <Announcement>
                  <AnnouncementTag className="flex items-center gap-1.5">
                     <Wallet className="size-3.5" />
                     Atual
                  </AnnouncementTag>
                  <AnnouncementTitle>
                     {formatDecimalCurrency(currentAmount)}
                  </AnnouncementTitle>
               </Announcement>

               <Announcement>
                  <AnnouncementTag className="flex items-center gap-1.5">
                     <TrendingUp className="size-3.5" />
                     Progresso
                  </AnnouncementTag>
                  <AnnouncementTitle>{percentage}%</AnnouncementTitle>
               </Announcement>

               {remaining > 0 && goal.status === "active" && (
                  <Announcement>
                     <AnnouncementTag className="flex items-center gap-1.5">
                        <CircleDashed className="size-3.5" />
                        Faltam
                     </AnnouncementTag>
                     <AnnouncementTitle>
                        {formatDecimalCurrency(remaining)}
                     </AnnouncementTitle>
                  </Announcement>
               )}

               {startingAmount > 0 && (
                  <Announcement>
                     <AnnouncementTag>Valor inicial</AnnouncementTag>
                     <AnnouncementTitle>
                        {formatDecimalCurrency(startingAmount)}
                     </AnnouncementTitle>
                  </Announcement>
               )}

               <Announcement>
                  <AnnouncementTag>Calculo</AnnouncementTag>
                  <AnnouncementTitle>
                     {CALCULATION_TYPE_LABELS[goal.progressCalculationType]}
                  </AnnouncementTitle>
               </Announcement>

               {targetDateFormatted && (
                  <Announcement>
                     <AnnouncementTag className="flex items-center gap-1.5">
                        <Calendar className="size-3.5" />
                        Data limite
                     </AnnouncementTag>
                     <AnnouncementTitle>
                        {targetDateFormatted}
                        {daysRemaining !== null && goal.status === "active" && (
                           <span className="text-muted-foreground ml-1">
                              ({daysRemaining > 0 ? `${daysRemaining}d` : "vencido"})
                           </span>
                        )}
                     </AnnouncementTitle>
                  </Announcement>
               )}

               <Announcement>
                  <AnnouncementTag className="flex items-center gap-1.5">
                     <Clock className="size-3.5" />
                     Criado em
                  </AnnouncementTag>
                  <AnnouncementTitle>{createdAt}</AnnouncementTitle>
               </Announcement>
            </div>

            {goal.description && (
               <div className="mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">{goal.description}</p>
               </div>
            )}
         </CardContent>
      </Card>
   );
}
