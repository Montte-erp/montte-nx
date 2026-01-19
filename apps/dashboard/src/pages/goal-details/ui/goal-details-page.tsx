import { Button } from "@packages/ui/components/button";
import {
   Empty,
   EmptyContent,
   EmptyDescription,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import { Skeleton } from "@packages/ui/components/skeleton";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "@tanstack/react-router";
import { Home, Plus, Target } from "lucide-react";
import { Suspense } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { DefaultHeader } from "@/default/default-header";
import { TransactionListProvider } from "@/features/transaction/lib/transaction-list-context";
import { ManageTransactionForm } from "@/features/transaction/ui/manage-transaction-form";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useSheet } from "@/hooks/use-sheet";
import { useTRPC } from "@/integrations/clients";
import { GoalActionButtons } from "./goal-action-buttons";
import { GoalMetadataCard } from "./goal-metadata-card";
import { GoalProgressSection } from "./goal-progress-section";
import { GoalTransactionsSection } from "./goal-transactions-section";

function GoalContent() {
   const params = useParams({ strict: false });
   const goalId = (params as { goalId?: string }).goalId ?? "";
   const trpc = useTRPC();
   const router = useRouter();
   const { activeOrganization } = useActiveOrganization();
   const { openSheet } = useSheet();

   const { data: goal } = useSuspenseQuery(
      trpc.goals.getById.queryOptions({ id: goalId }),
   );

   const handleDeleteSuccess = () => {
      router.navigate({
         params: { slug: activeOrganization.slug },
         to: "/$slug/goals",
      });
   };

   if (!goalId) {
      return (
         <GoalPageError
            error={new Error("Invalid goal ID")}
            resetErrorBoundary={() => {}}
         />
      );
   }

   if (!goal) {
      return null;
   }

   const defaultTagIds = [goal.tagId];

   return (
      <main className="space-y-6">
         <DefaultHeader
            actions={
               <Button
                  onClick={() =>
                     openSheet({
                        children: (
                           <ManageTransactionForm
                              defaultTagIds={defaultTagIds}
                           />
                        ),
                     })
                  }
               >
                  <Plus className="size-4" />
                  Adicionar Transacao
               </Button>
            }
            description="Acompanhe o progresso e detalhes desta meta"
            title={goal.name}
         />

         <GoalActionButtons goal={goal} onDeleteSuccess={handleDeleteSuccess} />

         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-6">
               <GoalMetadataCard goal={goal} />
            </div>
            <div className="lg:col-span-2 space-y-6">
               <GoalProgressSection goal={goal} />
            </div>
            <div className="lg:col-span-full">
               <GoalTransactionsSection goal={goal} />
            </div>
         </div>
      </main>
   );
}

function GoalPageSkeleton() {
   return (
      <main className="space-y-6">
         <div className="flex flex-col gap-2">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-6 w-72" />
         </div>
         <div className="flex flex-wrap gap-2">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-32" />
         </div>
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-6">
               <Skeleton className="h-48 w-full" />
            </div>
            <div className="lg:col-span-2 space-y-6">
               <Skeleton className="h-[350px] w-full" />
            </div>
            <div className="lg:col-span-full">
               <Skeleton className="h-64 w-full" />
            </div>
         </div>
      </main>
   );
}

function GoalPageError({ error, resetErrorBoundary }: FallbackProps) {
   const { activeOrganization } = useActiveOrganization();
   const router = useRouter();
   return (
      <main className="flex flex-col h-full w-full">
         <div className="flex-1 flex items-center justify-center">
            <Empty>
               <EmptyContent>
                  <EmptyMedia variant="icon">
                     <Target className="size-12 text-destructive" />
                  </EmptyMedia>
                  <EmptyTitle>Erro ao carregar meta</EmptyTitle>
                  <EmptyDescription>{error?.message}</EmptyDescription>
                  <div className="mt-6 flex gap-2 justify-center">
                     <Button
                        onClick={() =>
                           router.navigate({
                              params: { slug: activeOrganization.slug },
                              to: "/$slug/goals",
                           })
                        }
                        size="default"
                        variant="outline"
                     >
                        <Home className="size-4 mr-2" />
                        Voltar para Metas
                     </Button>
                     <Button
                        onClick={resetErrorBoundary}
                        size="default"
                        variant="default"
                     >
                        Tentar novamente
                     </Button>
                  </div>
               </EmptyContent>
            </Empty>
         </div>
      </main>
   );
}

export function GoalDetailsPage() {
   return (
      <TransactionListProvider>
         <ErrorBoundary FallbackComponent={GoalPageError}>
            <Suspense fallback={<GoalPageSkeleton />}>
               <GoalContent />
            </Suspense>
         </ErrorBoundary>
      </TransactionListProvider>
   );
}
