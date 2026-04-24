import { Card, CardContent } from "@packages/ui/components/card";

export function BillingOverview() {
   return (
      <Card>
         <CardContent className="flex flex-col gap-2 py-8 text-center">
            <p className="text-muted-foreground text-sm">
               Plano: <span className="font-medium">Free</span>
            </p>
            <p className="text-muted-foreground text-sm">
               Uso do mês: <span className="font-medium">R$ 0,00</span>
            </p>
            <p className="text-muted-foreground text-xs">
               Integração com HyprPay em migração.
            </p>
         </CardContent>
      </Card>
   );
}
