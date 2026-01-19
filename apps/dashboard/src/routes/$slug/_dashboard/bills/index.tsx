import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { BillsPage } from "@/pages/bills/ui/bills-page";

const billsSearchSchema = z.object({
   type: z.enum(["payable", "receivable"]).optional(),
   action: z.enum(["create"]).optional(),
   counterpartyId: z.string().uuid().optional(),
});

export const Route = createFileRoute("/$slug/_dashboard/bills/")({
   component: RouteComponent,
   staticData: {
      breadcrumb: "Contas a Pagar",
   },
   validateSearch: billsSearchSchema,
});

function RouteComponent() {
   return <BillsPage />;
}
