import { cn } from "@packages/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import type { BankAccountRow } from "./bank-accounts-columns";

type AccountType = BankAccountRow["type"] | undefined;

const TYPE_OPTIONS: { label: string; value: AccountType }[] = [
   { label: "Todas", value: undefined },
   { label: "Corrente", value: "checking" },
   { label: "Poupança", value: "savings" },
   { label: "Investimento", value: "investment" },
   { label: "Pagamento", value: "payment" },
   { label: "Caixa", value: "cash" },
];

interface BankAccountsFilterBarProps {
   type: AccountType;
}

export function BankAccountsFilterBar({ type }: BankAccountsFilterBarProps) {
   return (
      <div className="flex items-center rounded-md border bg-background p-0.5 gap-0.5 w-fit">
         {TYPE_OPTIONS.map((opt) => (
            <Link
               className={cn(
                  "px-3 py-1.5 text-sm rounded-sm font-medium transition-colors",
                  type === opt.value
                     ? "bg-primary text-primary-foreground shadow-sm"
                     : "text-muted-foreground hover:text-foreground hover:bg-muted",
               )}
               from="/$slug/$teamSlug/bank-accounts"
               key={opt.label}
               preload="intent"
               search={(prev) => ({ ...prev, type: opt.value })}
            >
               {opt.label}
            </Link>
         ))}
      </div>
   );
}
