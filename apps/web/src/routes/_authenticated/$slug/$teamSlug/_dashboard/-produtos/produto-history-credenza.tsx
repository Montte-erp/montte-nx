import { Badge } from "@packages/ui/components/badge";
import {
   CredenzaBody,
   CredenzaDescription,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import {
   Item,
   ItemActions,
   ItemContent,
   ItemDescription,
   ItemGroup,
   ItemSeparator,
   ItemTitle,
} from "@packages/ui/components/item";
import { ScrollArea } from "@packages/ui/components/scroll-area";
import dayjs from "dayjs";
import { Fragment } from "react";
import type { ProdutoMovement, ProdutoRow } from "./produtos-columns";
import { formatBRL } from "./produtos-columns";

const MOVEMENT_LABELS: Record<ProdutoMovement["type"], string> = {
   ajuste: "Ajuste",
   entrada: "Entrada",
   saida: "Saída",
};

export function ProdutoHistoryCredenza({ product }: { product: ProdutoRow }) {
   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>Histórico de movimentação</CredenzaTitle>
            <CredenzaDescription>
               {product.nome} tem saldo atual de {product.saldo} unidades.
            </CredenzaDescription>
         </CredenzaHeader>
         <CredenzaBody className="flex min-h-0 flex-col gap-4 px-4">
            {product.movements.length === 0 ? (
               <div className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">
                  Nenhuma movimentação registrada para este produto.
               </div>
            ) : (
               <ScrollArea className="max-h-[520px] min-h-0 rounded-md border bg-card">
                  <ItemGroup>
                     {product.movements.map((movement, index) => (
                        <Fragment key={movement.id}>
                           {index > 0 && <ItemSeparator />}
                           <MovementRow movement={movement} />
                        </Fragment>
                     ))}
                  </ItemGroup>
               </ScrollArea>
            )}
         </CredenzaBody>
      </>
   );
}

function MovementRow({ movement }: { movement: ProdutoMovement }) {
   return (
      <Item className="items-start">
         <ItemContent className="min-w-0 gap-2">
            <ItemTitle className="flex-wrap">
               <Badge
                  variant={movement.type === "saida" ? "secondary" : "outline"}
               >
                  {MOVEMENT_LABELS[movement.type]}
               </Badge>
               <span className="truncate">{movement.reason}</span>
               <span className="text-xs font-normal text-muted-foreground">
                  {dayjs(movement.occurredAt).format("DD/MM/YYYY")}
               </span>
            </ItemTitle>
            <ItemDescription className="line-clamp-none text-balance">
               {formatMovementDetails(movement)}
            </ItemDescription>
            {movement.note ? (
               <ItemDescription className="line-clamp-none text-balance">
                  {movement.note}
               </ItemDescription>
            ) : null}
         </ItemContent>
         <ItemActions className="shrink-0 flex-col items-end gap-0 text-right">
            <div className="text-sm font-medium tabular-nums">
               {movement.quantityUnits > 0 ? "+" : ""}
               {movement.quantityUnits} un.
            </div>
            <div className="text-xs text-muted-foreground tabular-nums">
               {movement.previousQuantityUnits}
               {" -> "}
               {movement.resultingQuantityUnits}
            </div>
         </ItemActions>
      </Item>
   );
}

function formatMovementDetails(movement: ProdutoMovement) {
   return [
      `Total ${formatBRL(movement.totalAmount)}`,
      `Unitário ${formatBRL(movement.unitCost)}`,
      movement.createsFinancialEntry ? "Lançamento criado" : "Sem lançamento",
      movement.categoryName || "Sem categoria",
      movement.tagName || "Sem Centro de Custo",
   ].join(" · ");
}
