import { Button } from "@packages/ui/components/button";
import {
   CredenzaDescription,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import { Input } from "@packages/ui/components/input";
import { Label } from "@packages/ui/components/label";
import {
   Tabs,
   TabsContent,
   TabsList,
   TabsTrigger,
} from "@packages/ui/components/tabs";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useCallback } from "react";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";
import type { InventoryProductRow } from "./inventory-product-columns";

interface InventoryMovementCredenzaProps {
   product: InventoryProductRow;
   onSuccess: () => void;
}

export function InventoryMovementCredenza({
   product,
   onSuccess,
}: InventoryMovementCredenzaProps) {
   const mutation = useMutation(
      orpc.inventory.registerMovement.mutationOptions({
         onSuccess: () => {
            toast.success("Movimento registrado.");
            onSuccess();
         },
         onError: (e) => toast.error(e.message),
      }),
   );

   const today = new Date().toISOString().split("T")[0];

   const handlePurchase = useCallback(
      (e: React.FormEvent<HTMLFormElement>) => {
         e.preventDefault();
         const form = e.currentTarget;
         const data = new FormData(form);
         mutation.mutate({
            type: "purchase",
            productId: product.id,
            purchasedQty: Number(data.get("purchasedQty")),
            totalAmount: Number(data.get("totalAmount")),
            date: String(data.get("date")),
            notes: String(data.get("notes") ?? "") || undefined,
         });
      },
      [mutation, product.id],
   );

   const handleSale = useCallback(
      (e: React.FormEvent<HTMLFormElement>) => {
         e.preventDefault();
         const form = e.currentTarget;
         const data = new FormData(form);
         const qty = Number(data.get("qty"));
         const unitPrice = Number(
            data.get("unitPrice") ?? product.sellingPrice ?? 0,
         );
         mutation.mutate({
            type: "sale",
            productId: product.id,
            qty,
            unitPrice,
            totalAmount: qty * unitPrice,
            date: String(data.get("date")),
            notes: String(data.get("notes") ?? "") || undefined,
         });
      },
      [mutation, product.id, product.sellingPrice],
   );

   const handleWaste = useCallback(
      (e: React.FormEvent<HTMLFormElement>) => {
         e.preventDefault();
         const form = e.currentTarget;
         const data = new FormData(form);
         mutation.mutate({
            type: "waste",
            productId: product.id,
            qty: Number(data.get("qty")),
            date: String(data.get("date")),
            notes: String(data.get("notes") ?? "") || undefined,
         });
      },
      [mutation, product.id],
   );

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>Movimentação de estoque</CredenzaTitle>
            <CredenzaDescription>
               Registre entradas e saídas do produto.
            </CredenzaDescription>
         </CredenzaHeader>
         <Tabs defaultValue="purchase">
            <TabsList className="w-full">
               <TabsTrigger className="flex-1" value="purchase">
                  Receber
               </TabsTrigger>
               <TabsTrigger className="flex-1" value="sale">
                  Vender
               </TabsTrigger>
               <TabsTrigger className="flex-1" value="waste">
                  Descartar
               </TabsTrigger>
            </TabsList>

            <TabsContent value="purchase">
               <form className="space-y-4 pt-2" onSubmit={handlePurchase}>
                  <div className="space-y-1.5">
                     <Label>Quantidade ({product.purchaseUnit})</Label>
                     <Input
                        min="0.001"
                        name="purchasedQty"
                        placeholder="Ex: 10"
                        required
                        step="any"
                        type="number"
                     />
                  </div>
                  <div className="space-y-1.5">
                     <Label>Custo total (R$)</Label>
                     <Input
                        min="0.01"
                        name="totalAmount"
                        placeholder="0.00"
                        required
                        step="0.01"
                        type="number"
                     />
                  </div>
                  <div className="space-y-1.5">
                     <Label>Data</Label>
                     <Input
                        defaultValue={today}
                        name="date"
                        required
                        type="date"
                     />
                  </div>
                  <div className="space-y-1.5">
                     <Label>Observações (opcional)</Label>
                     <Input
                        name="notes"
                        placeholder="Ex: Entrega do fornecedor"
                     />
                  </div>
                  <Button
                     className="w-full"
                     disabled={mutation.isPending}
                     type="submit"
                  >
                     {mutation.isPending && (
                        <Loader2 className="size-4 mr-2 animate-spin" />
                     )}
                     Registrar recebimento
                  </Button>
               </form>
            </TabsContent>

            <TabsContent value="sale">
               <form className="space-y-4 pt-2" onSubmit={handleSale}>
                  <div className="space-y-1.5">
                     <Label>Quantidade ({product.baseUnit})</Label>
                     <Input
                        min="0.001"
                        name="qty"
                        placeholder="Ex: 3"
                        required
                        step="any"
                        type="number"
                     />
                  </div>
                  <div className="space-y-1.5">
                     <Label>Preço por {product.baseUnit} (R$)</Label>
                     <Input
                        defaultValue={product.sellingPrice ?? ""}
                        min="0.01"
                        name="unitPrice"
                        placeholder="0.00"
                        step="0.01"
                        type="number"
                     />
                  </div>
                  <div className="space-y-1.5">
                     <Label>Data</Label>
                     <Input
                        defaultValue={today}
                        name="date"
                        required
                        type="date"
                     />
                  </div>
                  <div className="space-y-1.5">
                     <Label>Observações (opcional)</Label>
                     <Input name="notes" />
                  </div>
                  <Button
                     className="w-full"
                     disabled={mutation.isPending}
                     type="submit"
                  >
                     {mutation.isPending && (
                        <Loader2 className="size-4 mr-2 animate-spin" />
                     )}
                     Registrar venda
                  </Button>
               </form>
            </TabsContent>

            <TabsContent value="waste">
               <form className="space-y-4 pt-2" onSubmit={handleWaste}>
                  <div className="space-y-1.5">
                     <Label>Quantidade ({product.baseUnit})</Label>
                     <Input
                        min="0.001"
                        name="qty"
                        placeholder="Ex: 2"
                        required
                        step="any"
                        type="number"
                     />
                  </div>
                  <div className="space-y-1.5">
                     <Label>Data</Label>
                     <Input
                        defaultValue={today}
                        name="date"
                        required
                        type="date"
                     />
                  </div>
                  <div className="space-y-1.5">
                     <Label>Observações (opcional)</Label>
                     <Input name="notes" placeholder="Ex: Vencido" />
                  </div>
                  <Button
                     className="w-full"
                     disabled={mutation.isPending}
                     type="submit"
                     variant="destructive"
                  >
                     {mutation.isPending && (
                        <Loader2 className="size-4 mr-2 animate-spin" />
                     )}
                     Registrar descarte
                  </Button>
               </form>
            </TabsContent>
         </Tabs>
      </>
   );
}
