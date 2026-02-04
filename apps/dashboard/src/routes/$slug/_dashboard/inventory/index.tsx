import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuTrigger,
} from "@packages/ui/components/dropdown-menu";
import { Input } from "@packages/ui/components/input";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
import { Skeleton } from "@packages/ui/components/skeleton";
import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
} from "@packages/ui/components/table";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Edit, MoreHorizontal, Plus, Search, Trash2 } from "lucide-react";
import { Suspense, useState } from "react";
import { z } from "zod";
import { DefaultHeader } from "@/default/default-header";
import { useDeleteItemAlert } from "@/features/inventory/ui/delete-item-alert";
import { ItemFormSheet } from "@/features/inventory/ui/item-form-sheet";
import { StockLevelBadge } from "@/features/inventory/ui/stock-level-badge";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useSheet } from "@/hooks/use-sheet";
import { useTRPC } from "@/integrations/clients";

const inventorySearchSchema = z.object({
   search: z.string().optional(),
   type: z.enum(["product", "material", "asset"]).optional(),
});

export const Route = createFileRoute("/$slug/_dashboard/inventory/")({
   component: RouteComponent,
   staticData: {
      breadcrumb: "Inventário",
   },
   validateSearch: inventorySearchSchema,
});

type ItemType = "product" | "material" | "asset";

const typeLabels: Record<ItemType, string> = {
   product: "Produto",
   material: "Material",
   asset: "Ativo",
};

const typeColors: Record<ItemType, string> = {
   product: "bg-blue-500/10 text-blue-600 border-blue-500/20",
   material: "bg-purple-500/10 text-purple-600 border-purple-500/20",
   asset: "bg-orange-500/10 text-orange-600 border-orange-500/20",
};

const valuationMethodLabels = {
   fifo: "FIFO",
   weighted_average: "Média Ponderada",
};

function InventoryListSkeleton() {
   return (
      <div className="space-y-4">
         <div className="flex items-center gap-2">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 w-32" />
         </div>
         <div className="rounded-md border">
            <div className="p-4 space-y-3">
               {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton className="h-12 w-full" key={`skeleton-${i + 1}`} />
               ))}
            </div>
         </div>
      </div>
   );
}

function InventoryListContent() {
   const trpc = useTRPC();
   const navigate = useNavigate();
   const { activeOrganization } = useActiveOrganization();
   const { openSheet } = useSheet();
   const { openDeleteAlert } = useDeleteItemAlert();

   const [searchInput, setSearchInput] = useState("");
   const [typeFilter, setTypeFilter] = useState<ItemType | "all">("all");
   const [page, setPage] = useState(1);
   const pageSize = 20;

   const { data, isLoading } = useQuery(
      trpc.inventory.list.queryOptions({
         page,
         pageSize,
         search: searchInput || undefined,
         type: typeFilter !== "all" ? typeFilter : undefined,
      }),
   );

   const handleEdit = (item: {
      id: string;
      name: string;
      sku?: string | null;
      type: string;
      description?: string | null;
      baseUnit: string;
      baseUnitScale: number;
      valuationMethod: string;
      currency: string;
      reorderPoint?: string | null;
      defaultCounterpartyId?: string | null;
   }) => {
      openSheet({
         children: (
            <ItemFormSheet
               item={{
                  id: item.id,
                  name: item.name,
                  sku: item.sku,
                  type: item.type as "product" | "material" | "asset",
                  description: item.description,
                  baseUnit: item.baseUnit,
                  baseUnitScale: item.baseUnitScale,
                  valuationMethod: item.valuationMethod as
                     | "fifo"
                     | "weighted_average",
                  currency: item.currency,
                  reorderPoint: item.reorderPoint,
                  defaultCounterpartyId: item.defaultCounterpartyId,
               }}
               itemId={item.id}
            />
         ),
      });
   };

   const handleDelete = (itemId: string, itemName: string) => {
      openDeleteAlert({
         itemId,
         itemName,
         onSuccess: () => {
            // Refresh the list after deletion
         },
      });
   };

   const handleViewDetails = (itemId: string) => {
      navigate({
         to: "/$slug/inventory/$itemId",
         params: { slug: activeOrganization.slug, itemId },
      });
   };

   return (
      <main className="space-y-4">
         <DefaultHeader
            actions={
               <Button
                  onClick={() =>
                     openSheet({
                        children: <ItemFormSheet />,
                     })
                  }
               >
                  <Plus className="size-4" />
                  Adicionar Item
               </Button>
            }
            description="Gerencie seus itens de inventário, estoque e movimentações."
            title="Inventário"
         />

         <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
               <Input
                  className="pl-9"
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Pesquisar por nome ou SKU..."
                  value={searchInput}
               />
            </div>
            <Select
               onValueChange={(value) =>
                  setTypeFilter(value as ItemType | "all")
               }
               value={typeFilter}
            >
               <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Filtrar por tipo" />
               </SelectTrigger>
               <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="product">Produtos</SelectItem>
                  <SelectItem value="material">Materiais</SelectItem>
                  <SelectItem value="asset">Ativos</SelectItem>
               </SelectContent>
            </Select>
         </div>

         {isLoading ? (
            <InventoryListSkeleton />
         ) : !data || data.data.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
               <p className="text-lg font-medium">Nenhum item encontrado</p>
               <p className="text-sm mt-1">
                  {searchInput || typeFilter !== "all"
                     ? "Tente ajustar os filtros de pesquisa"
                     : "Comece adicionando seu primeiro item de inventário"}
               </p>
            </div>
         ) : (
            <div className="rounded-md border">
               <Table>
                  <TableHeader>
                     <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Estoque</TableHead>
                        <TableHead>Unidade Base</TableHead>
                        <TableHead>Método de Avaliação</TableHead>
                        <TableHead className="w-[100px]">Ações</TableHead>
                     </TableRow>
                  </TableHeader>
                  <TableBody>
                     {data.data.map((item) => (
                        <TableRow
                           className="cursor-pointer hover:bg-muted/50"
                           key={item.id}
                           onClick={() => handleViewDetails(item.id)}
                        >
                           <TableCell className="font-medium">
                              {item.name}
                           </TableCell>
                           <TableCell className="text-muted-foreground">
                              {item.sku || "-"}
                           </TableCell>
                           <TableCell>
                              <Badge
                                 className={typeColors[item.type as ItemType]}
                                 variant="outline"
                              >
                                 {typeLabels[item.type as ItemType]}
                              </Badge>
                           </TableCell>
                           <TableCell>
                              <StockLevelBadge
                                 quantity="0"
                                 reorderPoint={item.reorderPoint}
                                 unit={item.baseUnit}
                              />
                           </TableCell>
                           <TableCell>{item.baseUnit}</TableCell>
                           <TableCell>
                              <Badge variant="outline">
                                 {
                                    valuationMethodLabels[
                                       item.valuationMethod as
                                          | "fifo"
                                          | "weighted_average"
                                    ]
                                 }
                              </Badge>
                           </TableCell>
                           <TableCell onClick={(e) => e.stopPropagation()}>
                              <DropdownMenu>
                                 <DropdownMenuTrigger asChild>
                                    <Button size="icon" variant="ghost">
                                       <MoreHorizontal className="size-4" />
                                    </Button>
                                 </DropdownMenuTrigger>
                                 <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                       onClick={() =>
                                          handleViewDetails(item.id)
                                       }
                                    >
                                       Ver Detalhes
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                       onClick={() => handleEdit(item)}
                                    >
                                       <Edit className="size-4 mr-2" />
                                       Editar
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                       className="text-destructive"
                                       onClick={() =>
                                          handleDelete(item.id, item.name)
                                       }
                                    >
                                       <Trash2 className="size-4 mr-2" />
                                       Excluir
                                    </DropdownMenuItem>
                                 </DropdownMenuContent>
                              </DropdownMenu>
                           </TableCell>
                        </TableRow>
                     ))}
                  </TableBody>
               </Table>
            </div>
         )}

         {data && data.total > pageSize && (
            <div className="flex items-center justify-between">
               <p className="text-sm text-muted-foreground">
                  Mostrando {(page - 1) * pageSize + 1} a{" "}
                  {Math.min(page * pageSize, data.total)} de {data.total} itens
               </p>
               <div className="flex gap-2">
                  <Button
                     disabled={page === 1}
                     onClick={() => setPage((p) => p - 1)}
                     size="sm"
                     variant="outline"
                  >
                     Anterior
                  </Button>
                  <Button
                     disabled={page * pageSize >= data.total}
                     onClick={() => setPage((p) => p + 1)}
                     size="sm"
                     variant="outline"
                  >
                     Próxima
                  </Button>
               </div>
            </div>
         )}
      </main>
   );
}

function RouteComponent() {
   return (
      <Suspense fallback={<InventoryListSkeleton />}>
         <InventoryListContent />
      </Suspense>
   );
}
