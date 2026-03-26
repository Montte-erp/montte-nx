import { Button } from "@packages/ui/components/button";
import { Combobox } from "@packages/ui/components/combobox";
import {
   DialogStackContent,
   DialogStackDescription,
   DialogStackHeader,
   DialogStackTitle,
} from "@packages/ui/components/dialog-stack";
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
   const categories = categoriesResult;

   return (
      <DialogStackContent index={0}>
         <DialogStackHeader>
            <DialogStackTitle>Categorizar lançamentos</DialogStackTitle>
            <DialogStackDescription>
               Aplicar categoria a {selectedCount}{" "}
               {selectedCount === 1 ? "lançamento" : "lançamentos"}
            </DialogStackDescription>
         </DialogStackHeader>
         <div className="flex-1 overflow-y-auto px-4 py-4">
            <Combobox
               emptyMessage="Nenhuma categoria encontrada."
               onValueChange={setCategoryId}
               options={categories.map((c) => ({ value: c.id, label: c.name }))}
               placeholder="Selecionar categoria..."
               searchPlaceholder="Buscar categoria..."
               value={categoryId}
            />
         </div>
         <div className="border-t px-4 py-4">
            <div className="flex flex-col gap-2">
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
                  {isPending && (
                     <Loader2 className="size-4 mr-1 animate-spin" />
                  )}
                  Aplicar
               </Button>
            </div>
         </div>
      </DialogStackContent>
   );
}
