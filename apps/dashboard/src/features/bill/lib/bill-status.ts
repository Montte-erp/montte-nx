import { AlertCircle, CheckCircle2, Clock } from "lucide-react";

export type BillStatus = "paid" | "pending" | "overdue";

export function getBillStatus(bill: {
   completionDate: Date | null;
   dueDate: Date;
}): BillStatus {
   if (bill.completionDate) {
      return "paid";
   }
   const today = new Date();
   today.setHours(0, 0, 0, 0);
   const dueDate = new Date(bill.dueDate);
   dueDate.setHours(0, 0, 0, 0);
   return dueDate < today ? "overdue" : "pending";
}

export function getStatusConfig(status: BillStatus) {
   switch (status) {
      case "paid":
         return {
            className: "border-green-500 text-green-500",
            color: "text-green-600",
            icon: CheckCircle2,
            label: "Paga",
            variant: "outline" as const,
         };
      case "pending":
         return {
            className: "",
            color: "text-yellow-600",
            icon: Clock,
            label: "Pendente",
            variant: "secondary" as const,
         };
      case "overdue":
         return {
            className: "",
            color: "text-red-600",
            icon: AlertCircle,
            label: "Vencida",
            variant: "destructive" as const,
         };
   }
}
