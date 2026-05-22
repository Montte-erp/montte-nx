import { Badge } from "@packages/ui/components/badge";
import {
   CredenzaBody,
   CredenzaDescription,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import dayjs from "dayjs";
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
         <CredenzaBody className="flex flex-col gap-4 px-4">
            {product.movements.length === 0 ? (
               <div className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">
                  Nenhuma movimentação registrada para este produto.
               </div>
            ) : (
               <div className="flex flex-col gap-2">
                  {product.movements.map((movement) => (
                     <MovementRow key={movement.id} movement={movement} />
                  ))}
               </div>
            )}
         </CredenzaBody>
      </>
   );
}

function MovementRow({ movement }: { movement: ProdutoMovement }) {
   return (
      <div className="rounded-md border bg-card p-4">
         <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex flex-col gap-2">
               <div className="flex flex-wrap items-center gap-2">
                  <Badge
                     variant={
                        movement.type === "saida" ? "secondary" : "outline"
                     }
                  >
                     {MOVEMENT_LABELS[movement.type]}
                  </Badge>
                  <span className="text-sm font-medium">{movement.reason}</span>
               </div>
               <span className="text-xs text-muted-foreground">
                  {dayjs(movement.occurredAt).format("DD/MM/YYYY")}
               </span>
            </div>
            <div className="text-right">
               <div className="text-sm font-medium tabular-nums">
                  {movement.quantityUnits > 0 ? "+" : ""}
                  {movement.quantityUnits} un.
               </div>
               <div className="text-xs text-muted-foreground tabular-nums">
                  {movement.previousQuantityUnits}
                  {" -> "}
                  {movement.resultingQuantityUnits}
               </div>
            </div>
         </div>
         <div className="grid gap-2 pt-4 text-sm md:grid-cols-3">
            <Info label="Valor total" value={formatBRL(movement.totalAmount)} />
            <Info label="Unitário" value={formatBRL(movement.unitCost)} />
            <Info
               label="Financeiro"
               value={
                  movement.createsFinancialEntry
                     ? "Lançamento criado"
                     : "Sem lançamento"
               }
            />
         </div>
         <div className="grid gap-2 pt-4 text-sm md:grid-cols-2">
            <Info
               label="Categoria"
               value={movement.categoryName || "Sem categoria"}
            />
            <Info
               label="Centro de Custo"
               value={movement.tagName || "Sem Centro de Custo"}
            />
         </div>
         {movement.note ? (
            <p className="pt-4 text-sm text-muted-foreground">
               {movement.note}
            </p>
         ) : null}
      </div>
   );
}

function Info({ label, value }: { label: string; value: string }) {
   return (
      <div className="flex flex-col gap-1">
         <span className="text-xs text-muted-foreground">{label}</span>
         <span className="font-medium tabular-nums">{value}</span>
      </div>
   );
}
