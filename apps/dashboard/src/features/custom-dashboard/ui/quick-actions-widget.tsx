import type { QuickActionsConfig } from "@packages/database/schemas/dashboards";
import { QuickAccessCard } from "@packages/ui/components/quick-access-card";
import { useRouter } from "@tanstack/react-router";
import {
   ArrowDownRight,
   ArrowUpRight,
   BarChart3,
   CirclePlus,
} from "lucide-react";
import { ManageTransactionForm } from "@/features/transaction/ui/manage-transaction-form";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useSheet } from "@/hooks/use-sheet";

type QuickActionsWidgetProps = {
   config: QuickActionsConfig;
};

const ACTION_CONFIG = {
   new_transaction: {
      description: "Registre uma nova transação",
      icon: <CirclePlus className="size-5" />,
      title: "Nova Transação",
   },
   payables: {
      description: "Gerencie suas contas a pagar",
      icon: <ArrowDownRight className="size-5" />,
      title: "Contas a Pagar",
   },
   receivables: {
      description: "Gerencie suas contas a receber",
      icon: <ArrowUpRight className="size-5" />,
      title: "Contas a Receber",
   },
   reports: {
      description: "Visualize seus relatórios financeiros",
      icon: <BarChart3 className="size-5" />,
      title: "Ver Relatórios",
   },
} as const;

export function QuickActionsWidget({ config }: QuickActionsWidgetProps) {
   const { openSheet } = useSheet();
   const router = useRouter();
   const { activeOrganization } = useActiveOrganization();

   const actions = config.actions || [
      "new_transaction",
      "reports",
      "payables",
      "receivables",
   ];

   const handleAction = (action: string) => {
      switch (action) {
         case "new_transaction":
            openSheet({ children: <ManageTransactionForm /> });
            break;
         case "reports":
            router.navigate({
               params: { slug: activeOrganization.slug },
               to: "/$slug/dashboards",
            });
            break;
         case "payables":
            router.navigate({
               params: { slug: activeOrganization.slug },
               search: { type: "payable" },
               to: "/$slug/bills",
            });
            break;
         case "receivables":
            router.navigate({
               params: { slug: activeOrganization.slug },
               search: { type: "receivable" },
               to: "/$slug/bills",
            });
            break;
      }
   };

   return (
      <div className="h-full grid grid-cols-2 gap-3 content-center">
         {actions.map((action, index) => {
            const actionConfig = ACTION_CONFIG[action];
            if (!actionConfig) return null;

            return (
               <QuickAccessCard
                  description={actionConfig.description}
                  icon={actionConfig.icon}
                  key={`quick-action-${index + 1}`}
                  onClick={() => handleAction(action)}
                  title={actionConfig.title}
               />
            );
         })}
      </div>
   );
}
