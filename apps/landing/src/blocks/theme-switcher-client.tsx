import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type Theme = "dark" | "light" | "system";

const themes = [
   {
      icon: Monitor,
      key: "system",
      label: "Tema do sistema",
   },
   {
      icon: Sun,
      key: "light",
      label: "Tema claro",
   },
   {
      icon: Moon,
      key: "dark",
      label: "Tema escuro",
   },
] as const;

function applyTheme(theme: Theme) {
   const root = document.documentElement;
   root.classList.remove("light", "dark");

   const resolvedTheme =
      theme === "system"
         ? window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light"
         : theme;

   root.classList.add(resolvedTheme);
   localStorage.setItem("montte:theme", theme);
   document.cookie = `theme=${theme}; path=/; max-age=31536000; SameSite=Lax`;
}

function getInitialTheme(): Theme {
   const storedTheme = localStorage.getItem("montte:theme");

   if (storedTheme === "dark" || storedTheme === "light") return storedTheme;

   return "system";
}

export function ThemeSwitcherClient() {
   const [theme, setTheme] = useState<Theme>("system");

   useEffect(() => {
      const initialTheme = getInitialTheme();
      setTheme(initialTheme);
      applyTheme(initialTheme);
   }, []);

   return (
      <div className="relative isolate flex size-fit rounded-full bg-background p-1 ring-1 ring-border">
         {themes.map(({ key, icon: Icon, label }) => {
            const isActive = theme === key;

            return (
               <button
                  aria-label={label}
                  className="relative grid size-6 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground data-[active=true]:bg-muted data-[active=true]:text-foreground"
                  data-active={isActive}
                  key={key}
                  onClick={() => {
                     setTheme(key);
                     applyTheme(key);
                  }}
                  type="button"
               >
                  <Icon aria-hidden="true" className="size-4" />
               </button>
            );
         })}
      </div>
   );
}
