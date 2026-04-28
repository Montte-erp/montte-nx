import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import {
   InputGroup,
   InputGroupAddon,
   InputGroupInput,
} from "@packages/ui/components/input-group";
import {
   Item,
   ItemContent,
   ItemDescription,
   ItemGroup,
   ItemMedia,
   ItemTitle,
} from "@packages/ui/components/item";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { Check, Plus, Search, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { fromPromise } from "neverthrow";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";

interface Props {
   serviceId: string;
   attachedIds: Set<string>;
   onCreateNew: () => void;
   onClose: () => void;
}

export function BenefitAttachPopover({
   serviceId,
   attachedIds,
   onCreateNew,
   onClose,
}: Props) {
   const [query, setQuery] = useState("");

   const { data: allBenefits } = useSuspenseQuery(
      orpc.benefits.getBenefits.queryOptions({}),
   );

   const attachMutation = useMutation(
      orpc.benefits.attachBenefit.mutationOptions({
         onError: (e) => toast.error(e.message),
      }),
   );

   const filtered = useMemo(() => {
      const q = query.toLowerCase();
      if (!q) return allBenefits;
      return allBenefits.filter(
         (b) =>
            b.name.toLowerCase().includes(q) ||
            b.description?.toLowerCase().includes(q),
      );
   }, [allBenefits, query]);

   const handleAttach = async (benefitId: string) => {
      const result = await fromPromise(
         attachMutation.mutateAsync({ serviceId, benefitId }),
         (e) => e,
      );
      if (result.isErr()) return;
      toast.success("Benefício vinculado.");
      onClose();
   };

   return (
      <div className="flex flex-col gap-2 p-2">
         <InputGroup>
            <InputGroupAddon>
               <Search className="size-3.5" />
            </InputGroupAddon>
            <InputGroupInput
               aria-label="Buscar benefícios"
               autoFocus
               placeholder="Buscar benefício..."
               value={query}
               onChange={(e) => setQuery(e.target.value)}
            />
         </InputGroup>
         <ItemGroup>
            {filtered.length === 0 && (
               <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                  Nenhum benefício encontrado.
               </p>
            )}
            {filtered.map((b) => {
               const attached = attachedIds.has(b.id);
               const disabled =
                  attached || !b.isActive || attachMutation.isPending;
               return (
                  <Item
                     aria-disabled={disabled}
                     className={
                        disabled
                           ? "opacity-60"
                           : "cursor-pointer hover:bg-muted/60"
                     }
                     key={b.id}
                     role="button"
                     size="sm"
                     tabIndex={disabled ? -1 : 0}
                     onClick={() => {
                        if (disabled) return;
                        handleAttach(b.id);
                     }}
                     onKeyDown={(e) => {
                        if (disabled) return;
                        if (e.key === "Enter" || e.key === " ") {
                           e.preventDefault();
                           handleAttach(b.id);
                        }
                     }}
                  >
                     <ItemMedia variant="icon">
                        <Sparkles />
                     </ItemMedia>
                     <ItemContent>
                        <ItemTitle className="text-xs">
                           {b.name}
                           {!b.isActive && (
                              <Badge className="ml-2" variant="outline">
                                 Pausado
                              </Badge>
                           )}
                        </ItemTitle>
                        {b.description && (
                           <ItemDescription className="text-xs text-muted-foreground">
                              {b.description}
                           </ItemDescription>
                        )}
                     </ItemContent>
                     {attached && <Check className="size-4 text-primary" />}
                  </Item>
               );
            })}
         </ItemGroup>
         <Button
            className="w-full"
            onClick={onCreateNew}
            size="sm"
            variant="outline"
         >
            <Plus />
            Criar novo benefício
         </Button>
      </div>
   );
}
