/**
 * SSR-safe replacement for useMediaQuery.
 * Returns `false` on the server and during the first client render,
 * then updates synchronously on client mount via useIsomorphicLayoutEffect.
 */
export declare function useSafeMediaQuery(query: string): boolean;
//# sourceMappingURL=use-media-query.d.ts.map
