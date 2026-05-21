import { Badge } from "@packages/ui/components/badge";
import {
   AlertTriangle,
   CircleCheckBig,
   CircleDashed,
   Clock3,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type WorkflowStatus = "active" | "paused";
export type WorkflowRunStatus = "pending" | "running" | "succeeded" | "failed";

type BadgeVariant =
   | "default"
   | "destructive"
   | "outline"
   | "secondary"
   | "success";

type StatusConfig = {
   label: string;
   icon: LucideIcon;
   variant: BadgeVariant;
};

const WORKFLOW_STATUS_LABELS: Record<WorkflowStatus, StatusConfig> = {
   active: { label: "Ativo", icon: CircleCheckBig, variant: "success" },
   paused: { label: "Pausado", icon: CircleDashed, variant: "outline" },
};

const RUN_STATUS_LABELS: Record<WorkflowRunStatus, StatusConfig> = {
   pending: { label: "Na fila", icon: Clock3, variant: "outline" },
   running: { label: "Executando", icon: Clock3, variant: "secondary" },
   succeeded: { label: "Concluída", icon: CircleCheckBig, variant: "success" },
   failed: { label: "Falhou", icon: AlertTriangle, variant: "destructive" },
};

export function WorkflowStatusBadge({ status }: { status: WorkflowStatus }) {
   const config = WORKFLOW_STATUS_LABELS[status];
   const Icon = config.icon;
   return (
      <Badge variant={config.variant}>
         <Icon className="size-3" />
         {config.label}
      </Badge>
   );
}

export function WorkflowRunStatusBadge({
   status,
}: {
   status: WorkflowRunStatus;
}) {
   const config = RUN_STATUS_LABELS[status];
   const Icon = config.icon;
   return (
      <Badge variant={config.variant}>
         <Icon className="size-3" />
         {config.label}
      </Badge>
   );
}
