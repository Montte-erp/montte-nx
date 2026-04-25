import {
   Empty,
   EmptyContent,
   EmptyDescription,
   EmptyHeader,
   EmptyTitle,
} from "@packages/ui/components/empty";

export function BillingSpend() {
   return (
      <Empty>
         <EmptyHeader>
            <EmptyTitle>Nenhum gasto registrado.</EmptyTitle>
            <EmptyDescription>
               Integração com HyprPay em migração.
            </EmptyDescription>
         </EmptyHeader>
         <EmptyContent />
      </Empty>
   );
}
