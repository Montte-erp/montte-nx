import { Button } from "@packages/ui/components/button";
import {
   CredenzaDescription,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import { Input } from "@packages/ui/components/input";
import { Label } from "@packages/ui/components/label";
import { Textarea } from "@packages/ui/components/textarea";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useCallback } from "react";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";

interface InventoryProductFormProps {
   mode: "create" | "edit";
   defaultValues?: {
      id: string;
      name: string;
      description: string | null;
      baseUnit: string;
      purchaseUnit: string;
      purchaseUnitFactor: string;
      sellingPrice: string | null;
   };
   onSuccess: () => void;
}

export function InventoryProductForm({
   mode,
   defaultValues,
   onSuccess,
}: InventoryProductFormProps) {
   const createMutation = useMutation(
      orpc.inventory.createProduct.mutationOptions({
         onSuccess: () => {
            toast.success("Produto criado.");
            onSuccess();
         },
         onError: (e) => toast.error(e.message),
      }),
   );

   const updateMutation = useMutation(
      orpc.inventory.updateProduct.mutationOptions({
         onSuccess: () => {
            toast.success("Produto atualizado.");
            onSuccess();
         },
         onError: (e) => toast.error(e.message),
      }),
   );

   const isPending = createMutation.isPending || updateMutation.isPending;

   const handleSubmit = useCallback(
      (e: React.FormEvent<HTMLFormElement>) => {
         e.preventDefault();
         const form = e.currentTarget;
         const data = new FormData(form);
         const payload = {
            name: String(data.get("name")),
            description: String(data.get("description")) || null,
            baseUnit: String(data.get("baseUnit")),
            purchaseUnit: String(data.get("purchaseUnit")),
            purchaseUnitFactor: String(data.get("purchaseUnitFactor") || "1"),
            sellingPrice: data.get("sellingPrice")
               ? String(data.get("sellingPrice"))
               : null,
         };
         if (mode === "create") {
            createMutation.mutate(payload);
         } else if (defaultValues?.id) {
            updateMutation.mutate({ id: defaultValues.id, ...payload });
         }
      },
      [mode, defaultValues, createMutation, updateMutation],
   );

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>
               {mode === "create" ? "Novo produto" : "Editar produto"}
            </CredenzaTitle>
            <CredenzaDescription>
               Preencha as informações do produto.
            </CredenzaDescription>
         </CredenzaHeader>
         <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1.5">
               <Label htmlFor="name">Nome do produto</Label>
               <Input
                  defaultValue={defaultValues?.name}
                  id="name"
                  name="name"
                  placeholder="Ex: Picolé Morango"
                  required
               />
            </div>

            <div className="space-y-1.5">
               <Label htmlFor="description">Descrição (opcional)</Label>
               <Textarea
                  defaultValue={defaultValues?.description ?? ""}
                  id="description"
                  name="description"
                  rows={2}
               />
            </div>

            <div className="grid grid-cols-2 gap-3">
               <div className="space-y-1.5">
                  <Label htmlFor="baseUnit">Unidade base</Label>
                  <Input
                     defaultValue={defaultValues?.baseUnit ?? "un"}
                     id="baseUnit"
                     name="baseUnit"
                     placeholder="un, g, mL"
                     required
                  />
               </div>
               <div className="space-y-1.5">
                  <Label htmlFor="purchaseUnit">Unidade de compra</Label>
                  <Input
                     defaultValue={defaultValues?.purchaseUnit ?? "caixa"}
                     id="purchaseUnit"
                     name="purchaseUnit"
                     placeholder="caixa, kg, L"
                     required
                  />
               </div>
            </div>

            <div className="space-y-1.5">
               <Label htmlFor="purchaseUnitFactor">
                  Fator de conversão (quantas unidades base por unidade de
                  compra)
               </Label>
               <Input
                  defaultValue={defaultValues?.purchaseUnitFactor ?? "1"}
                  id="purchaseUnitFactor"
                  min="0.0001"
                  name="purchaseUnitFactor"
                  placeholder="Ex: 12 (1 caixa = 12 un)"
                  step="any"
                  type="number"
               />
               <p className="text-xs text-muted-foreground">
                  Para unidades padrão (kg→g, L→mL), a conversão é automática.
               </p>
            </div>

            <div className="space-y-1.5">
               <Label htmlFor="sellingPrice">Preço de venda (opcional)</Label>
               <Input
                  defaultValue={defaultValues?.sellingPrice ?? ""}
                  id="sellingPrice"
                  min="0"
                  name="sellingPrice"
                  placeholder="0.00"
                  step="0.01"
                  type="number"
               />
            </div>

            <Button className="w-full" disabled={isPending} type="submit">
               {isPending && <Loader2 className="size-4 mr-2 animate-spin" />}
               {mode === "create" ? "Criar produto" : "Salvar alterações"}
            </Button>
         </form>
      </>
   );
}
