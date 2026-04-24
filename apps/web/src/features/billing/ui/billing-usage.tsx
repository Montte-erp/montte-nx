import { Card, CardContent } from "@packages/ui/components/card";

export function BillingUsage() {
   return (
      <Card>
         <CardContent className="flex flex-col gap-2 py-8 text-center">
            <p className="text-muted-foreground text-sm">
               Nenhum dado de uso disponível.
            </p>
            <p className="text-muted-foreground text-xs">
               Integração com HyprPay em migração.
            </p>
         </CardContent>
      </Card>
   );
}
