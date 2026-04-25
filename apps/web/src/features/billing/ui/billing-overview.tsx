export function BillingOverview() {
   return (
      <div className="flex flex-col gap-2 py-4 text-center">
         <p className="text-muted-foreground text-sm">
            Plano: <span className="font-medium">Free</span>
         </p>
         <p className="text-muted-foreground text-sm">
            Uso do mês: <span className="font-medium">R$ 0,00</span>
         </p>
         <p className="text-muted-foreground text-xs">
            Integração com HyprPay em migração.
         </p>
      </div>
   );
}
