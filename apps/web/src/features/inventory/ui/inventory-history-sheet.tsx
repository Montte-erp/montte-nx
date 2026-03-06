import { Badge } from "@packages/ui/components/badge";
import {
   CredenzaDescription,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import { Skeleton } from "@packages/ui/components/skeleton";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { orpc } from "@/integrations/orpc/client";
import type { InventoryProductRow } from "./inventory-product-columns";

const TYPE_LABELS = {
   purchase: "Compra",
   sale: "Venda",
   waste: "Descarte",
} as const;

const TYPE_VARIANTS = {
   purchase: "secondary",
   sale: "default",
   waste: "destructive",
} as const;

function HistoryList({ product }: { product: InventoryProductRow }) {
   const { data: movements } = useSuspenseQuery(
      orpc.inventory.getMovements.queryOptions({
         input: { productId: product.id },
      }),
   );

   if (!movements.length) {
      return (
         <p className="text-muted-foreground text-sm py-8 text-center">
            Nenhum movimento registrado.
         </p>
      );
   }

   return (
      <ul className="space-y-3">
         {movements.map((m) => (
            <li
               className="flex items-start justify-between gap-3 py-2 border-b last:border-0"
               key={m.id}
            >
               <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                     <Badge variant={TYPE_VARIANTS[m.type]}>
                        {TYPE_LABELS[m.type]}
                     </Badge>
                     <span className="text-sm font-medium">
                        {m.qty} {product.baseUnit}
                     </span>
                  </div>
                  {m.notes && (
                     <p className="text-xs text-muted-foreground">{m.notes}</p>
                  )}
               </div>
               <div className="text-right shrink-0">
                  {m.totalAmount && (
                     <p className="text-sm font-medium">
                        R$ {Number(m.totalAmount).toFixed(2)}
                     </p>
                  )}
                  <p className="text-xs text-muted-foreground">{m.date}</p>
               </div>
            </li>
         ))}
      </ul>
   );
}

interface InventoryHistorySheetProps {
   product: InventoryProductRow;
}

export function InventoryHistorySheet({ product }: InventoryHistorySheetProps) {
   return (
      <div className="space-y-4">
         <CredenzaHeader>
            <CredenzaTitle>Histórico de {product.name}</CredenzaTitle>
            <CredenzaDescription>Veja todas as movimentações deste produto.</CredenzaDescription>
         </CredenzaHeader>
         <Suspense
            fallback={
               <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                     <Skeleton className="h-12 w-full" key={`skel-${i + 1}`} />
                  ))}
               </div>
            }
         >
            <HistoryList product={product} />
         </Suspense>
      </div>
   );
}
