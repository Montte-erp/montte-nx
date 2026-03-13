import type { FallbackProps } from "react-error-boundary";
interface ErrorFallbackProps extends FallbackProps {
   errorTitle?: string;
   errorDescription?: string;
   retryText?: string;
}
export declare function ErrorFallback({
   resetErrorBoundary,
   errorTitle,
   errorDescription,
   retryText,
}: ErrorFallbackProps): import("react/jsx-runtime").JSX.Element;
export declare function createErrorFallback(
   options?: Partial<ErrorFallbackProps>,
): (props: FallbackProps) => import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=error-fallback.d.ts.map
