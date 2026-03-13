import * as React from "react";
export type ResolvedTheme = "dark" | "light";
export type Theme = ResolvedTheme | "system";
export interface UseThemeProps {
   theme: Theme;
   resolvedTheme: ResolvedTheme;
   setTheme: (theme: Theme) => void;
}
export interface ThemeProviderProps {
   children: React.ReactNode;
   defaultTheme?: Theme;
   storageKey?: string;
   enableSystem?: boolean;
   attribute?: "class" | "data-theme";
}
export declare function ThemeProvider({
   children,
   defaultTheme,
   storageKey,
   enableSystem,
   attribute,
}: ThemeProviderProps): import("react/jsx-runtime").JSX.Element;
export declare function useTheme(): UseThemeProps;
//# sourceMappingURL=theme-provider.d.ts.map
