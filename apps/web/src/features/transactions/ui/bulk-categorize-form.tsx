import { Button } from "@packages/ui/components/button";
import { Combobox } from "@packages/ui/components/combobox";
import {
   CredenzaBody,
   CredenzaDescription,
   CredenzaFooter,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { orpc } from "@/integrations/orpc/client";

export function BulkCategorizeForm({
   selectedCount,
   onApply,
   onCancel,
}: {
   selectedCount: number;
   onApply: (categoryId: string) => Promise<void>;
   onCancel: () => void;
}) {
   const [categoryId, setCategoryId] = useState<string | undefined>();
   const [isPending, startTransition] = useTransition();
   const { data: categoriesResult } = useSuspenseQuery(
      orpc.categories.getAll.queryOptions({}),
   );
   const categories = categoriesResult.data;

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>Categorizar lançamentos</CredenzaTitle>
            <CredenzaDescription>
               Aplicar categoria a {selectedCount}{" "}
               {selectedCount === 1 ? "lançamento" : "lançamentos"}
            </CredenzaDescription>
         </CredenzaHeader>
         <CredenzaBody>
            <Combobox
               emptyMessage="Nenhuma categoria encontrada."
               onValueChange={setCategoryId}
               options={categories.map((c) => ({ value: c.id, label: c.name }))}
               placeholder="Selecionar categoria..."
               searchPlaceholder="Buscar categoria..."
               value={categoryId}
            />
         </CredenzaBody>
         <CredenzaFooter className="flex-col gap-2">
            <Button
               className="w-full"
               disabled={isPending}
               onClick={onCancel}
               variant="outline"
            >
               Cancelar
            </Button>
            <Button
               className="w-full"
               disabled={!categoryId || isPending}
               onClick={() =>
                  startTransition(async () => {
                     await onApply(categoryId!);
                  })
               }
            >
               {isPending && <Loader2 className="size-4 mr-1 animate-spin" />}
               Aplicar
            </Button>
         </CredenzaFooter>
      </>
   );
}
