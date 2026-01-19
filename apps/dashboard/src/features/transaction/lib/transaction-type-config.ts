import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight } from "lucide-react";

export const TRANSACTION_TYPE_CONFIG = {
   expense: {
      color: "#ef4444",
      icon: ArrowUpRight,
      label: "Despesa",
   },
   income: {
      color: "#10b981",
      icon: ArrowDownLeft,
      label: "Receita",
   },
   transfer: {
      color: "#3b82f6",
      icon: ArrowLeftRight,
      label: "Transferencia",
   },
} as const;

export type TransactionType = keyof typeof TRANSACTION_TYPE_CONFIG;
