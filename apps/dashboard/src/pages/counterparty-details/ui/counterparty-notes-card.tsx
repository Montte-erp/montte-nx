import { Alert, AlertDescription } from "@packages/ui/components/alert";
import {
   Card,
   CardContent,
   CardDescription,
   CardHeader,
   CardTitle,
} from "@packages/ui/components/card";
import { Skeleton } from "@packages/ui/components/skeleton";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { useTRPC } from "@/integrations/clients";

function NotesCardErrorFallback() {
   return (
      <Alert variant="destructive">
         <AlertDescription>Falha ao carregar observacoes</AlertDescription>
      </Alert>
   );
}

function NotesCardSkeleton() {
   return (
      <Card>
         <CardHeader>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-40" />
         </CardHeader>
         <CardContent>
            <Skeleton className="h-20 w-full" />
         </CardContent>
      </Card>
   );
}

function NotesCardContent({ counterpartyId }: { counterpartyId: string }) {
   const trpc = useTRPC();

   const { data: counterparty } = useSuspenseQuery(
      trpc.counterparties.getById.queryOptions({ id: counterpartyId }),
   );

   if (!counterparty || !counterparty.notes) {
      return null;
   }

   return (
      <Card className="h-fit">
         <CardHeader>
            <CardTitle>Observacoes</CardTitle>
            <CardDescription>Observacoes sobre o parceiro</CardDescription>
         </CardHeader>
         <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
               {counterparty.notes}
            </p>
         </CardContent>
      </Card>
   );
}

export function CounterpartyNotesCard({
   counterpartyId,
}: {
   counterpartyId: string;
}) {
   return (
      <ErrorBoundary FallbackComponent={NotesCardErrorFallback}>
         <Suspense fallback={<NotesCardSkeleton />}>
            <NotesCardContent counterpartyId={counterpartyId} />
         </Suspense>
      </ErrorBoundary>
   );
}
