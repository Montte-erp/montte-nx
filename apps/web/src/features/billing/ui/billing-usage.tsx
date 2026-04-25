import {
   Empty,
   EmptyContent,
   EmptyDescription,
   EmptyHeader,
   EmptyTitle,
} from "@packages/ui/components/empty";

export function BillingUsage() {
   return (
      <Empty>
         <EmptyHeader>
            <EmptyTitle>Nenhum dado de uso disponível.</EmptyTitle>
            <EmptyDescription>
               Integração com HyprPay em migração.
            </EmptyDescription>
         </EmptyHeader>
         <EmptyContent />
      </Empty>
   );
}
