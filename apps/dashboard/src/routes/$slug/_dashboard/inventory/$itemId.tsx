import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import {
   Card,
   CardContent,
   CardHeader,
   CardTitle,
} from "@packages/ui/components/card";
import {
   Empty,
   EmptyContent,
   EmptyDescription,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import { Skeleton } from "@packages/ui/components/skeleton";
import {
   Tabs,
   TabsContent,
   TabsList,
   TabsTrigger,
} from "@packages/ui/components/tabs";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
   createFileRoute,
   useNavigate,
   useParams,
} from "@tanstack/react-router";
import {
   ArrowLeft,
   Building2,
   Edit,
   Link as LinkIcon,
   Package,
   Plus,
   Ruler,
   Trash2,
} from "lucide-react";
import { Suspense } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { useStockLevel } from "@/features/inventory/hooks/use-stock-level";
import { useStockValuation } from "@/features/inventory/hooks/use-stock-valuation";
import { useDeleteItemAlert } from "@/features/inventory/ui/delete-item-alert";
import { ItemCounterpartyTable } from "@/features/inventory/ui/item-counterparty-table";
import { ItemFormSheet } from "@/features/inventory/ui/item-form-sheet";
import { ItemUomCredenza } from "@/features/inventory/ui/item-uom-credenza";
import { LinkCounterpartyCredenza } from "@/features/inventory/ui/link-counterparty-credenza";
import { MovementHistoryTable } from "@/features/inventory/ui/movement-history-table";
import { RecordMovementSheet } from "@/features/inventory/ui/record-movement-sheet";
import { StockLevelBadge } from "@/features/inventory/ui/stock-level-badge";
import { ValuationSummaryCard } from "@/features/inventory/ui/valuation-summary-card";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useCredenza } from "@/hooks/use-credenza";
import { useSheet } from "@/hooks/use-sheet";
import { useTRPC } from "@/integrations/clients";

export const Route = createFileRoute("/$slug/_dashboard/inventory/$itemId")({
   component: RouteComponent,
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

function ItemDetailsSkeleton() {
   return (
      <main className="space-y-4">
         <div className="flex flex-col gap-2">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-6 w-72" />
         </div>
         <div className="flex gap-2">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-32" />
         </div>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
         </div>
         <Skeleton className="h-96 w-full" />
      </main>
   );
}

function ItemDetailsContent() {
   const params = useParams({ strict: false });
   const itemId = (params as { itemId?: string }).itemId ?? "";
   const trpc = useTRPC();
   const navigate = useNavigate();
   const { activeOrganization } = useActiveOrganization();
   const { openSheet } = useSheet();
   const { openCredenza } = useCredenza();
   const { openDeleteAlert } = useDeleteItemAlert();

   const { data: item } = useSuspenseQuery(
      trpc.inventory.getItem.queryOptions({ id: itemId }),
   );

   const { data: stockLevel } = useStockLevel(itemId);
   const { data: stockValuation } = useStockValuation(itemId);

   if (!item) {
      return null;
   }

   const handleEdit = () => {
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

   const handleDelete = () => {
      openDeleteAlert({
         itemId: item.id,
         itemName: item.name,
         onSuccess: () => {
            navigate({
               to: "/$slug/inventory",
               params: { slug: activeOrganization.slug },
            });
         },
      });
   };

   const handleRecordMovement = () => {
      openSheet({
         children: <RecordMovementSheet itemId={itemId} />,
      });
   };

   const handleLinkCounterparty = () => {
      openCredenza({
         children: <LinkCounterpartyCredenza itemId={itemId} />,
      });
   };

   const handleManageUoms = () => {
      openCredenza({
         children: <ItemUomCredenza itemId={itemId} />,
      });
   };

   const handleBack = () => {
      navigate({
         to: "/$slug/inventory",
         params: { slug: activeOrganization.slug },
      });
   };

   return (
      <main className="space-y-4">
         <div className="flex items-center gap-2">
            <Button onClick={handleBack} size="icon" variant="ghost">
               <ArrowLeft className="size-4" />
            </Button>
            <div className="flex-1">
               <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h1 className="text-2xl font-bold">{item.name}</h1>
                  <Badge
                     className={typeColors[item.type as ItemType]}
                     variant="outline"
                  >
                     {typeLabels[item.type as ItemType]}
                  </Badge>
               </div>
               {item.description && (
                  <p className="text-sm text-muted-foreground">
                     {item.description}
                  </p>
               )}
            </div>
         </div>

         {item.sku && (
            <div className="text-sm text-muted-foreground">SKU: {item.sku}</div>
         )}

         <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handleEdit} size="sm" variant="outline">
               <Edit className="size-4" />
               Editar Item
            </Button>
            <Button
               className="text-destructive hover:text-destructive"
               onClick={handleDelete}
               size="sm"
               variant="outline"
            >
               <Trash2 className="size-4" />
               Excluir Item
            </Button>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
               <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                     Estoque Atual
                  </CardTitle>
                  <Package className="size-4 text-muted-foreground" />
               </CardHeader>
               <CardContent>
                  {stockLevel ? (
                     <StockLevelBadge
                        quantity={stockLevel}
                        reorderPoint={item.reorderPoint}
                        unit={item.baseUnit}
                     />
                  ) : (
                     <div className="text-sm text-muted-foreground">
                        Carregando...
                     </div>
                  )}
               </CardContent>
            </Card>

            {stockValuation && (
               <ValuationSummaryCard
                  currency={item.currency}
                  method={item.valuationMethod as "fifo" | "weighted_average"}
                  valuation={stockValuation.amount.toString()}
               />
            )}
         </div>

         <Tabs className="space-y-4" defaultValue="movements">
            <TabsList>
               <TabsTrigger value="movements">
                  <Package className="size-4" />
                  Movimentações
               </TabsTrigger>
               <TabsTrigger value="counterparties">
                  <Building2 className="size-4" />
                  Fornecedores/Clientes
               </TabsTrigger>
               <TabsTrigger value="units">
                  <Ruler className="size-4" />
                  Unidades de Medida
               </TabsTrigger>
            </TabsList>

            <TabsContent className="space-y-4" value="movements">
               <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">
                     Histórico de Movimentações
                  </h3>
                  <Button onClick={handleRecordMovement} size="sm">
                     <Plus className="size-4" />
                     Registrar Movimentação
                  </Button>
               </div>
               <MovementHistoryTable itemId={itemId} />
            </TabsContent>

            <TabsContent className="space-y-4" value="counterparties">
               <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">
                     Fornecedores e Clientes Vinculados
                  </h3>
                  <Button onClick={handleLinkCounterparty} size="sm">
                     <LinkIcon className="size-4" />
                     Vincular Fornecedor/Cliente
                  </Button>
               </div>
               <ItemCounterpartyTable itemId={itemId} />
            </TabsContent>

            <TabsContent className="space-y-4" value="units">
               <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Unidades de Medida</h3>
                  <Button onClick={handleManageUoms} size="sm">
                     <Ruler className="size-4" />
                     Gerenciar Unidades
                  </Button>
               </div>

               <Card>
                  <CardHeader>
                     <CardTitle className="text-base">Unidade Base</CardTitle>
                  </CardHeader>
                  <CardContent>
                     <div className="flex items-center gap-2">
                        <Badge variant="outline">{item.baseUnit}</Badge>
                        <span className="text-sm text-muted-foreground">
                           (Escala: {item.baseUnitScale})
                        </span>
                     </div>
                  </CardContent>
               </Card>

               {item.inventoryItemUoms && item.inventoryItemUoms.length > 0 ? (
                  <Card>
                     <CardHeader>
                        <CardTitle className="text-base">
                           Unidades Alternativas
                        </CardTitle>
                     </CardHeader>
                     <CardContent>
                        <div className="space-y-2">
                           {item.inventoryItemUoms.map(
                              (uom: {
                                 id: string;
                                 unit: string;
                                 conversionFactor: string;
                              }) => (
                                 <div
                                    className="flex items-center justify-between p-3 border rounded-md"
                                    key={uom.id}
                                 >
                                    <div className="flex items-center gap-2">
                                       <Badge variant="outline">
                                          {uom.unit}
                                       </Badge>
                                       <span className="text-sm text-muted-foreground">
                                          = {uom.conversionFactor}{" "}
                                          {item.baseUnit}
                                       </span>
                                    </div>
                                 </div>
                              ),
                           )}
                        </div>
                     </CardContent>
                  </Card>
               ) : (
                  <div className="text-center py-8 text-muted-foreground">
                     <p className="text-sm">
                        Nenhuma unidade de medida alternativa cadastrada.
                     </p>
                     <p className="text-xs mt-1">
                        Clique em "Gerenciar Unidades" para adicionar.
                     </p>
                  </div>
               )}
            </TabsContent>
         </Tabs>
      </main>
   );
}

function ItemDetailsError({ error, resetErrorBoundary }: FallbackProps) {
   const { activeOrganization } = useActiveOrganization();
   const navigate = useNavigate();

   return (
      <main className="flex flex-col h-full w-full">
         <div className="flex-1 flex items-center justify-center">
            <Empty>
               <EmptyContent>
                  <EmptyMedia variant="icon">
                     <Package className="size-12 text-destructive" />
                  </EmptyMedia>
                  <EmptyTitle>Falha ao carregar item</EmptyTitle>
                  <EmptyDescription>{error?.message}</EmptyDescription>
                  <div className="mt-6 flex gap-2 justify-center">
                     <Button
                        onClick={() =>
                           navigate({
                              params: { slug: activeOrganization.slug },
                              to: "/$slug/inventory",
                           })
                        }
                        size="default"
                        variant="outline"
                     >
                        <ArrowLeft className="size-4 mr-2" />
                        Voltar ao Inventário
                     </Button>
                     <Button
                        onClick={resetErrorBoundary}
                        size="default"
                        variant="default"
                     >
                        Tentar Novamente
                     </Button>
                  </div>
               </EmptyContent>
            </Empty>
         </div>
      </main>
   );
}

function RouteComponent() {
   return (
      <ErrorBoundary FallbackComponent={ItemDetailsError}>
         <Suspense fallback={<ItemDetailsSkeleton />}>
            <ItemDetailsContent />
         </Suspense>
      </ErrorBoundary>
   );
}
