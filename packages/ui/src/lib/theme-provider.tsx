import { ScriptOnce } from "@tanstack/react-router";
import { invariant } from "foxact/invariant";
import { createLocalStorageState } from "foxact/create-local-storage-state";
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
   enableSystem?: boolean;
   attribute?: "class" | "data-theme";
}

const [useThemeStorage] = createLocalStorageState<Theme>(
   "montte:theme",
   "system",
);

const ThemeProviderContext = React.createContext<UseThemeProps | null>(null);

export function ThemeProvider({
   children,
   defaultTheme = "system",
   enableSystem = true,
   attribute = "class",
}: ThemeProviderProps) {
   const [storedTheme, setStoredTheme] = useThemeStorage();
   const theme = storedTheme ?? defaultTheme;
   const [resolvedTheme, setResolvedTheme] =
      React.useState<ResolvedTheme>("light");

   React.useEffect(() => {
      const root = window.document.documentElement;

      function updateTheme() {
         root.classList.remove("light", "dark");

         if (theme === "system" && enableSystem) {
            const systemTheme = window.matchMedia(
               "(prefers-color-scheme: dark)",
            ).matches
               ? "dark"
               : "light";
            setResolvedTheme(systemTheme);
            root.classList.add(systemTheme);
         } else {
            const validTheme =
               (theme as ResolvedTheme) === "light" ||
               (theme as ResolvedTheme) === "dark"
                  ? (theme as ResolvedTheme)
                  : "light";

            setResolvedTheme(validTheme);

            if (attribute === "class") {
               root.classList.add(validTheme);
            } else {
               root.setAttribute(attribute, validTheme);
            }
         }
      }

      if (enableSystem) {
         const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
         mediaQuery.addEventListener("change", updateTheme);
         updateTheme();
         return () => mediaQuery.removeEventListener("change", updateTheme);
      } else {
         updateTheme();
      }
   }, [theme, enableSystem, attribute]);

   const value = React.useMemo(
      () => ({
         resolvedTheme,
         setTheme: (newTheme: Theme) => {
            const resolved =
               !newTheme || newTheme.trim() === "" ? "system" : newTheme;
            document.cookie = `theme=${resolved}; path=/; max-age=31536000; SameSite=Lax; Secure`;
            setStoredTheme(resolved);
         },
         theme,
      }),
      [theme, resolvedTheme, setStoredTheme],
   );

   return (
      <ThemeProviderContext value={value}>
         <ScriptOnce>
            {`(function(){
               var t=localStorage.getItem('montte:theme');
               var isDark=t==='dark'||((t===null||t==='system')&&${enableSystem}&&window.matchMedia('(prefers-color-scheme:dark)').matches);
               if(isDark){${attribute === "class" ? 'document.documentElement.classList.add("dark")' : `document.documentElement.setAttribute("${attribute}","dark")`}}
               document.cookie='theme='+(t||'system')+'; path=/; max-age=31536000; SameSite=Lax; Secure';
            })()`}
         </ScriptOnce>
         {children}
      </ThemeProviderContext>
   );
}

export function useTheme() {
   const context = React.useContext(ThemeProviderContext);

   invariant(context, "useTheme must be used within a ThemeProvider");

   return context;
}
