import { createErrorFallback } from "@packages/ui/components/error-fallback";
import { QueryErrorResetBoundary } from "@tanstack/react-query";
import { type ComponentType, type ReactNode, Suspense } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";

interface QueryBoundaryProps {
   children: ReactNode;
   fallback: ReactNode;
   errorTitle?: string;
   errorFallback?: ComponentType<FallbackProps>;
}

export function QueryBoundary({
   children,
   fallback,
   errorTitle,
   errorFallback,
}: QueryBoundaryProps) {
   const FallbackComponent =
      errorFallback ?? createErrorFallback({ errorTitle });
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
