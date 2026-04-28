import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import { format, of } from "@f-o-t/money";
import type { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";
import { ExternalLink } from "lucide-react";
import type { Outputs } from "@/integrations/orpc/client";

export type SubscriberRow = Outputs["services"]["getSubscribers"][number];

export const SUBSCRIPTION_STATUS_LABEL: Record<
   SubscriberRow["status"],
   string
> = {
   active: "Ativas",
   trialing: "Trial",
   incomplete: "Incompletas",
   completed: "Concluídas",
   cancelled: "Canceladas",
};

const STATUS_BADGE_VARIANT: Record<
   SubscriberRow["status"],
   "default" | "secondary" | "outline"
> = {
   active: "default",
   trialing: "secondary",
   incomplete: "outline",
   completed: "outline",
   cancelled: "outline",
};

function rowMrr(row: SubscriberRow): number {
   const unit = Number(row.negotiatedPrice ?? row.basePrice);
   const total = unit * row.quantity;
   if (row.interval === "monthly") return total;
   if (row.interval === "annual") return total / 12;
   if (row.interval === "semestral") return total / 6;
   if (row.interval === "weekly") return total * (52 / 12);
   return 0;
}

interface BuildArgs {
   onOpenContact: (contactId: string) => void;
}

export function buildSubscriberColumns({
   onOpenContact,
}: BuildArgs): ColumnDef<SubscriberRow>[] {
   return [
      {
         accessorKey: "contactName",
         header: "Contato",
         meta: { label: "Contato" },
         cell: ({ row }) => (
            <span className="font-medium">{row.original.contactName}</span>
         ),
      },
      {
         accessorKey: "priceName",
         header: "Preço",
         meta: { label: "Preço" },
         cell: ({ row }) => (
            <Badge variant="outline">{row.original.priceName}</Badge>
         ),
      },
      {
         accessorKey: "status",
         header: "Status",
         meta: { label: "Status" },
         cell: ({ row }) => (
            <Badge variant={STATUS_BADGE_VARIANT[row.original.status]}>
               {SUBSCRIPTION_STATUS_LABEL[row.original.status]}
            </Badge>
         ),
      },
      {
         accessorKey: "startDate",
         header: "Iniciada",
         meta: { label: "Iniciada" },
         cell: ({ row }) => dayjs(row.original.startDate).format("DD/MM/YYYY"),
      },
      {
         id: "mrr",
         header: "MRR",
         meta: { label: "MRR", align: "right" as const },
         cell: ({ row }) => {
            const value = rowMrr(row.original);
            if (!value) return <span className="text-muted-foreground">—</span>;
            return (
               <span className="tabular-nums font-medium">
                  {format(of(value.toFixed(2), "BRL"), "pt-BR")}
               </span>
            );
         },
      },
      {
         id: "actions",
         header: "",
         cell: ({ row }) => (
            <Button
               onClick={() => onOpenContact(row.original.contactId)}
               size="icon-sm"
               tooltip="Ver contato"
               variant="ghost"
            >
               <ExternalLink />
               <span className="sr-only">Ver contato</span>
            </Button>
         ),
      },
   ];
}
