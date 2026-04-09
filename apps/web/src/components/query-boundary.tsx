import { Button } from "@packages/ui/components/button";
import {
   Empty,
   EmptyContent,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import { QueryErrorResetBoundary } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";
import { type ComponentType, type ReactNode, Suspense } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";

interface ErrorFallbackProps extends FallbackProps {
   errorTitle?: string;
   errorDescription?: string;
   retryText?: string;
}

function ErrorFallback({
   resetErrorBoundary,
   errorTitle = "Erro ao carregar",
   errorDescription = "Ocorreu um erro ao carregar este conteúdo. Tente novamente.",
   retryText = "Tentar novamente",
}: ErrorFallbackProps) {
   return (
      <Empty>
         <EmptyHeader>
            <EmptyMedia variant="icon">
               <AlertCircle className="size-6" />
            </EmptyMedia>
            <EmptyTitle>{errorTitle}</EmptyTitle>
            <EmptyDescription>{errorDescription}</EmptyDescription>
         </EmptyHeader>
         <EmptyContent>
            <Button onClick={resetErrorBoundary} variant="outline">
               {retryText}
            </Button>
         </EmptyContent>
      </Empty>
   );
}

export function createErrorFallback(options?: Partial<ErrorFallbackProps>) {
   return function CustomErrorFallback(props: FallbackProps) {
      return <ErrorFallback {...options} {...props} />;
   };
}

interface QueryBoundaryProps {
   children: ReactNode;
   fallback: ReactNode;
   errorTitle?: string;
   errorDescription?: string;
   retryText?: string;
   errorFallback?: ComponentType<FallbackProps>;
}

export function QueryBoundary({
   children,
   fallback,
   errorTitle,
   errorDescription,
   retryText,
   errorFallback,
}: QueryBoundaryProps) {
   const FallbackComponent =
      errorFallback ??
      createErrorFallback({ errorTitle, errorDescription, retryText });
   return (
      <QueryErrorResetBoundary>
         {({ reset }) => (
            <ErrorBoundary
               onReset={reset}
               FallbackComponent={FallbackComponent}
            >
               <Suspense fallback={fallback}>{children}</Suspense>
            </ErrorBoundary>
         )}
      </QueryErrorResetBoundary>
   );
}
