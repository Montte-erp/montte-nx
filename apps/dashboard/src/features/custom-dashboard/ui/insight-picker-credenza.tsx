import { Avatar, AvatarFallback } from "@packages/ui/components/avatar";
import { Button } from "@packages/ui/components/button";
import {
   CredenzaBody,
   CredenzaDescription,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import { Input } from "@packages/ui/components/input";
import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
} from "@packages/ui/components/table";
import { cn } from "@packages/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import {
   ArrowDownUp,
   Banknote,
   BarChart3,
   CreditCard,
   Layers,
   LineChart,
   PieChart,
   Plus,
   Scale,
   Search,
   Sparkles,
   Table2,
   TrendingUp,
   Wallet,
   X,
} from "lucide-react";
import { useState } from "react";
import { useTRPC } from "@/integrations/clients";
import type { DefaultInsightType, SavedInsight } from "../hooks/use-insight";
import { formatRelativeTime } from "../hooks/use-insight-data";

type InsightPickerCredenzaProps = {
   onSelectDefault: (type: DefaultInsightType) => void;
   onSelectSaved: (insight: SavedInsight) => void;
};

const DEFAULT_INSIGHTS: Array<{
   type: DefaultInsightType;
   name: string;
   description: string;
   icon: React.ComponentType<{ className?: string }>;
}> = [
   {
      type: "transactions",
      name: "Transactions",
      description: "Track income and expenses over time",
      icon: ArrowDownUp,
   },
   {
      type: "bills",
      name: "Bills",
      description: "Monitor upcoming and recurring bills",
      icon: CreditCard,
   },
   {
      type: "budgets",
      name: "Budgets",
      description: "Budget tracking and spending analysis",
      icon: Wallet,
   },
   {
      type: "bank_accounts",
      name: "Bank Accounts",
      description: "Account balances and cash flow",
      icon: Banknote,
   },
];

const CHART_TYPE_ICONS: Record<
   string,
   React.ComponentType<{ className?: string }>
> = {
   stat_card: TrendingUp,
   line: LineChart,
   bar: BarChart3,
   pie: PieChart,
   donut: PieChart,
   table: Table2,
   category_analysis: Layers,
   comparison: Scale,
};

export function InsightPickerCredenza({
   onSelectDefault,
   onSelectSaved,
}: InsightPickerCredenzaProps) {
   const [search, setSearch] = useState("");
   const trpc = useTRPC();

   const { data: savedInsights = [] } = useQuery(
      trpc.dashboards.getAllSavedInsights.queryOptions({
         search: search || undefined,
      }),
   );

   const filteredDefaults = DEFAULT_INSIGHTS.filter(
      (insight) =>
         insight.name.toLowerCase().includes(search.toLowerCase()) ||
         insight.description.toLowerCase().includes(search.toLowerCase()),
   );

   const hasResults = filteredDefaults.length > 0 || savedInsights.length > 0;

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle className="flex items-center gap-2">
               <Sparkles className="h-5 w-5" />
               Add insight
            </CredenzaTitle>
            <CredenzaDescription>
               Escolha entre insights padrão ou seus insights salvos
            </CredenzaDescription>
         </CredenzaHeader>
         <CredenzaBody className="pb-6">
            <div className="relative mb-4">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
               <Input
                  className="pl-10 pr-10 h-11"
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Pesquisar insights..."
                  value={search}
               />
               {search && (
                  <button
                     className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-muted flex items-center justify-center hover:bg-muted-foreground/20 transition-colors"
                     onClick={() => setSearch("")}
                     type="button"
                  >
                     <X className="h-3 w-3 text-muted-foreground" />
                  </button>
               )}
            </div>

            {!hasResults ? (
               <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="rounded-full bg-muted p-4 mb-4">
                     <Search className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground font-medium">
                     Nenhum insight encontrado
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                     Tente um termo de busca diferente
                  </p>
               </div>
            ) : (
               <>
                  {/* Desktop: Table view */}
                  <div className="hidden md:block max-h-[400px] overflow-auto rounded-lg border">
                     <Table>
                        <TableHeader>
                           <TableRow className="bg-muted/50">
                              <TableHead className="w-12" />
                              <TableHead className="text-xs font-medium uppercase tracking-wider">
                                 Nome
                              </TableHead>
                              <TableHead className="text-xs font-medium uppercase tracking-wider">
                                 Criado por
                              </TableHead>
                              <TableHead className="text-xs font-medium uppercase tracking-wider">
                                 Criado
                              </TableHead>
                              <TableHead className="text-xs font-medium uppercase tracking-wider">
                                 Última modificação
                              </TableHead>
                           </TableRow>
                        </TableHeader>
                        <TableBody>
                           {/* Default Insights */}
                           {filteredDefaults.map((insight) => (
                              <TableRow
                                 className="group transition-colors hover:bg-muted/50"
                                 key={insight.type}
                              >
                                 <TableCell>
                                    <Button
                                       className={cn(
                                          "h-8 w-8 rounded-full border border-border",
                                          "transition-all duration-200",
                                          "group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground",
                                       )}
                                       onClick={() =>
                                          onSelectDefault(insight.type)
                                       }
                                       size="icon"
                                       variant="ghost"
                                    >
                                       <Plus className="h-4 w-4" />
                                    </Button>
                                 </TableCell>
                                 <TableCell>
                                    <div className="flex items-center gap-3">
                                       <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                                          <insight.icon className="h-5 w-5 text-muted-foreground" />
                                       </div>
                                       <div className="min-w-0">
                                          <div className="font-medium truncate">
                                             {insight.name}
                                          </div>
                                          <div className="text-sm text-muted-foreground truncate">
                                             {insight.description}
                                          </div>
                                       </div>
                                    </div>
                                 </TableCell>
                                 <TableCell>
                                    <span className="text-muted-foreground text-sm">
                                       System
                                    </span>
                                 </TableCell>
                                 <TableCell>
                                    <span className="text-muted-foreground text-sm">
                                       -
                                    </span>
                                 </TableCell>
                                 <TableCell>
                                    <span className="text-muted-foreground text-sm">
                                       -
                                    </span>
                                 </TableCell>
                              </TableRow>
                           ))}

                           {/* Saved Insights */}
                           {savedInsights.map((insight) => {
                              const Icon =
                                 CHART_TYPE_ICONS[insight.config.chartType] ||
                                 BarChart3;
                              return (
                                 <TableRow
                                    className="group transition-colors hover:bg-muted/50"
                                    key={insight.id}
                                 >
                                    <TableCell>
                                       <Button
                                          className={cn(
                                             "h-8 w-8 rounded-full border border-border",
                                             "transition-all duration-200",
                                             "group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground",
                                          )}
                                          onClick={() => onSelectSaved(insight)}
                                          size="icon"
                                          variant="ghost"
                                       >
                                          <Plus className="h-4 w-4" />
                                       </Button>
                                    </TableCell>
                                    <TableCell>
                                       <div className="flex items-center gap-3">
                                          <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                                             <Icon className="h-5 w-5 text-muted-foreground" />
                                          </div>
                                          <div className="min-w-0">
                                             <div className="font-medium truncate">
                                                {insight.name}
                                             </div>
                                             {insight.description && (
                                                <div className="text-sm text-muted-foreground truncate">
                                                   {insight.description}
                                                </div>
                                             )}
                                          </div>
                                       </div>
                                    </TableCell>
                                    <TableCell>
                                       <div className="flex items-center gap-2">
                                          <Avatar className="h-6 w-6">
                                             <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                                M
                                             </AvatarFallback>
                                          </Avatar>
                                          <span className="text-muted-foreground text-sm">
                                             you
                                          </span>
                                       </div>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-sm">
                                       {formatRelativeTime(insight.createdAt)}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-sm">
                                       {formatRelativeTime(insight.updatedAt)}
                                    </TableCell>
                                 </TableRow>
                              );
                           })}
                        </TableBody>
                     </Table>
                  </div>

                  {/* Mobile: Cards view */}
                  <div className="md:hidden max-h-[400px] overflow-auto space-y-2">
                     {/* Default Insights */}
                     {filteredDefaults.map((insight) => (
                        <button
                           className={cn(
                              "w-full flex items-center gap-3 p-4 rounded-xl border-2 border-border",
                              "bg-card hover:bg-muted/50 hover:border-primary/50",
                              "transition-all duration-200 text-left",
                              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                           )}
                           key={insight.type}
                           onClick={() => onSelectDefault(insight.type)}
                           type="button"
                        >
                           <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                              <Plus className="h-5 w-5 text-primary" />
                           </div>
                           <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                              <insight.icon className="h-5 w-5 text-muted-foreground" />
                           </div>
                           <div className="min-w-0 flex-1">
                              <div className="font-medium truncate">
                                 {insight.name}
                              </div>
                              <div className="text-sm text-muted-foreground truncate">
                                 {insight.description}
                              </div>
                           </div>
                        </button>
                     ))}

                     {/* Saved Insights */}
                     {savedInsights.map((insight) => {
                        const Icon =
                           CHART_TYPE_ICONS[insight.config.chartType] ||
                           BarChart3;
                        return (
                           <button
                              className={cn(
                                 "w-full flex items-center gap-3 p-4 rounded-xl border-2 border-border",
                                 "bg-card hover:bg-muted/50 hover:border-primary/50",
                                 "transition-all duration-200 text-left",
                                 "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                              )}
                              key={insight.id}
                              onClick={() => onSelectSaved(insight)}
                              type="button"
                           >
                              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                 <Plus className="h-5 w-5 text-primary" />
                              </div>
                              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                 <Icon className="h-5 w-5 text-muted-foreground" />
                              </div>
                              <div className="min-w-0 flex-1">
                                 <div className="font-medium truncate">
                                    {insight.name}
                                 </div>
                                 {insight.description && (
                                    <div className="text-sm text-muted-foreground truncate">
                                       {insight.description}
                                    </div>
                                 )}
                                 <div className="text-xs text-muted-foreground mt-1">
                                    {formatRelativeTime(insight.updatedAt)}
                                 </div>
                              </div>
                           </button>
                        );
                     })}
                  </div>
               </>
            )}
         </CredenzaBody>
      </>
   );
}
