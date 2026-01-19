import { formatDecimalCurrency } from "@packages/money";
import { Alert, AlertDescription } from "@packages/ui/components/alert";
import {
   Announcement,
   AnnouncementTag,
   AnnouncementTitle,
} from "@packages/ui/components/announcement";
import { Badge } from "@packages/ui/components/badge";
import {
   Card,
   CardContent,
   CardDescription,
   CardHeader,
   CardTitle,
} from "@packages/ui/components/card";
import { ChartContainer } from "@packages/ui/components/chart";
import { Separator } from "@packages/ui/components/separator";
import { Skeleton } from "@packages/ui/components/skeleton";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Suspense, useMemo } from "react";
import { ErrorBoundary } from "react-error-boundary";
import {
   Bar,
   BarChart,
   CartesianGrid,
   Cell,
   LabelList,
   Tooltip,
   XAxis,
   YAxis,
} from "recharts";
import type { IconName } from "@/features/icon-selector/lib/available-icons";
import { IconDisplay } from "@/features/icon-selector/ui/icon-display";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useTRPC } from "@/integrations/clients";

type ChartConfig = {
   [k in string]: {
      label?: React.ReactNode;
      icon?: React.ComponentType;
      color?: string;
   };
};

function CategorizationErrorFallback() {
   return (
      <Alert variant="destructive">
         <AlertDescription>Falha ao carregar categorias</AlertDescription>
      </Alert>
   );
}

function CategorizationSkeleton() {
   return (
      <Card>
         <CardHeader>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-6 w-32" />
         </CardHeader>
         <CardContent className="space-y-3">
            <Skeleton className="h-7 w-full rounded-full" />
            <Skeleton className="h-7 w-full rounded-full" />
            <Skeleton className="h-7 w-full rounded-full" />
         </CardContent>
      </Card>
   );
}

type CategorySplit = {
   categoryId: string;
   value: number;
   splitType: "amount";
};

function CategorizationContent({ transactionId }: { transactionId: string }) {
   const trpc = useTRPC();
   const { activeOrganization } = useActiveOrganization();
   const slug = activeOrganization.slug;

   const { data } = useSuspenseQuery(
      trpc.transactions.getById.queryOptions({ id: transactionId }),
   );

   const categories = data.transactionCategories || [];
   const tags = data.transactionTags || [];
   const costCenter = data.costCenter;
   const categorySplits = data.categorySplits as CategorySplit[] | null;
   const hasSplit = categorySplits && categorySplits.length > 0;
   const totalAmount = Math.abs(Number.parseFloat(data.amount)) * 100;

   const hasCategories = categories.length > 0;
   const hasTags = tags.length > 0;
   const hasCostCenter = !!costCenter;
   const hasCategorization = hasCategories || hasTags || hasCostCenter;

   const chartData = useMemo(() => {
      if (!hasSplit || !categories.length) return [];

      return categories.map(({ category }) => {
         const split = categorySplits?.find(
            (s) => s.categoryId === category.id,
         );
         const splitValue = split?.value || 0;
         const percentage = Math.round((splitValue / totalAmount) * 100);

         return {
            name: category.name,
            value: splitValue / 100,
            percentage,
            color: category.color,
            icon: category.icon || "Tag",
            id: category.id,
         };
      });
   }, [categories, categorySplits, hasSplit, totalAmount]);

   const chartConfig = useMemo(() => {
      const config: ChartConfig = {
         label: {
            color: "var(--background)",
         },
      };
      for (const item of chartData) {
         config[item.name] = {
            label: item.name,
            color: item.color,
         };
      }
      return config;
   }, [chartData]);

   if (!hasCategorization) {
      return (
         <Card>
            <CardHeader>
               <CardTitle>Categorização</CardTitle>
               <CardDescription>
                  Categorias, tags e centro de custo
               </CardDescription>
            </CardHeader>
            <CardContent>
               <p className="text-muted-foreground text-sm">
                  Nenhuma categorização definida. Use o botão "Categorizar" para
                  adicionar categorias, tags ou centro de custo.
               </p>
            </CardContent>
         </Card>
      );
   }

   return (
      <Card>
         <CardHeader>
            <CardTitle>Categorização</CardTitle>
            <CardDescription>
               Categorias, tags e centro de custo
            </CardDescription>
         </CardHeader>
         <CardContent className="space-y-4">
            {hasCategories && hasSplit && (
               <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  <div className="flex flex-wrap lg:flex-col gap-2">
                     {chartData.map((entry) => (
                        <Link
                           key={entry.id}
                           params={{ slug, categoryId: entry.id }}
                           to="/$slug/categories/$categoryId"
                        >
                           <Announcement className="cursor-pointer hover:opacity-80 transition-opacity">
                              <AnnouncementTag
                                 className="flex items-center gap-1.5"
                                 style={{
                                    backgroundColor: `${entry.color}20`,
                                    color: entry.color,
                                 }}
                              >
                                 <IconDisplay
                                    iconName={entry.icon as IconName}
                                    size={12}
                                 />
                                 {entry.name}
                              </AnnouncementTag>
                              <AnnouncementTitle>
                                 {entry.percentage}%
                              </AnnouncementTitle>
                           </Announcement>
                        </Link>
                     ))}
                  </div>

                  <div className="hidden lg:block w-px bg-border self-stretch" />

                  <div className="flex-1 bg-background rounded-lg p-4">
                     <ChartContainer
                        className="h-[120px] w-full"
                        config={chartConfig}
                     >
                        <BarChart
                           accessibilityLayer
                           data={chartData}
                           layout="vertical"
                           margin={{ right: 50 }}
                        >
                           <CartesianGrid horizontal={false} />
                           <YAxis dataKey="name" hide type="category" />
                           <XAxis dataKey="value" hide type="number" />
                           <Tooltip
                              content={({ active, payload }) => {
                                 if (!active || !payload?.length) return null;
                                 const firstPayload = payload[0];
                                 if (!firstPayload) return null;
                                 const data = firstPayload.payload;
                                 return (
                                    <Announcement>
                                       <AnnouncementTag
                                          className="flex items-center gap-1.5"
                                          style={{
                                             backgroundColor: `${data.color}20`,
                                             color: data.color,
                                          }}
                                       >
                                          <IconDisplay
                                             iconName={data.icon as IconName}
                                             size={12}
                                          />
                                          {data.name}
                                       </AnnouncementTag>
                                       <AnnouncementTitle>
                                          {data.percentage}% •{" "}
                                          {formatDecimalCurrency(data.value)}
                                       </AnnouncementTitle>
                                    </Announcement>
                                 );
                              }}
                              cursor={false}
                           />
                           <Bar dataKey="value" layout="vertical" radius={4}>
                              {chartData.map((entry) => (
                                 <Cell fill={entry.color} key={entry.id} />
                              ))}
                              <LabelList
                                 className="fill-(--color-label)"
                                 dataKey="name"
                                 fontSize={12}
                                 offset={8}
                                 position="insideLeft"
                              />
                              <LabelList
                                 className="fill-foreground"
                                 dataKey="value"
                                 fontSize={12}
                                 formatter={(value: number) =>
                                    formatDecimalCurrency(value)
                                 }
                                 offset={8}
                                 position="right"
                              />
                           </Bar>
                        </BarChart>
                     </ChartContainer>
                  </div>
               </div>
            )}

            {hasCategories && !hasSplit && (
               <div className="flex flex-wrap gap-2">
                  {categories.map(({ category }) => (
                     <Link
                        key={category.id}
                        params={{ slug, categoryId: category.id }}
                        to="/$slug/categories/$categoryId"
                     >
                        <Announcement className="cursor-pointer hover:opacity-80 transition-opacity">
                           <AnnouncementTag
                              className="flex items-center gap-1.5"
                              style={{
                                 backgroundColor: `${category.color}20`,
                                 color: category.color,
                              }}
                           >
                              <IconDisplay
                                 iconName={(category.icon || "Tag") as IconName}
                                 size={12}
                              />
                              {category.name}
                           </AnnouncementTag>
                           <AnnouncementTitle>Categoria</AnnouncementTitle>
                        </Announcement>
                     </Link>
                  ))}
               </div>
            )}

            {hasCategories && (hasTags || hasCostCenter) && <Separator />}

            {(hasTags || hasCostCenter) && (
               <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  {hasTags && (
                     <div className="flex flex-col gap-2">
                        <span className="text-xs font-medium text-muted-foreground">
                           Tags
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                           {tags.map((transactionTag) => (
                              <Link
                                 key={transactionTag.tag.id}
                                 params={{ slug, tagId: transactionTag.tag.id }}
                                 to="/$slug/tags/$tagId"
                              >
                                 <Badge
                                    className="cursor-pointer hover:opacity-80 transition-opacity"
                                    style={{
                                       backgroundColor:
                                          transactionTag.tag.color,
                                    }}
                                 >
                                    {transactionTag.tag.name}
                                 </Badge>
                              </Link>
                           ))}
                        </div>
                     </div>
                  )}

                  {hasTags && hasCostCenter && (
                     <div className="hidden lg:block w-px bg-border self-stretch" />
                  )}

                  {hasCostCenter && (
                     <div className="flex flex-col gap-2">
                        <span className="text-xs font-medium text-muted-foreground">
                           Centro de Custo
                        </span>
                        <Link
                           params={{ slug, costCenterId: costCenter.id }}
                           to="/$slug/cost-centers/$costCenterId"
                        >
                           <Announcement className="cursor-pointer hover:opacity-80 transition-opacity">
                              <AnnouncementTag>
                                 {costCenter.code || "—"}
                              </AnnouncementTag>
                              <AnnouncementTitle>
                                 {costCenter.name}
                              </AnnouncementTitle>
                           </Announcement>
                        </Link>
                     </div>
                  )}
               </div>
            )}
         </CardContent>
      </Card>
   );
}

export function TransactionCategorizationSection({
   transactionId,
}: {
   transactionId: string;
}) {
   return (
      <ErrorBoundary FallbackComponent={CategorizationErrorFallback}>
         <Suspense fallback={<CategorizationSkeleton />}>
            <CategorizationContent transactionId={transactionId} />
         </Suspense>
      </ErrorBoundary>
   );
}
