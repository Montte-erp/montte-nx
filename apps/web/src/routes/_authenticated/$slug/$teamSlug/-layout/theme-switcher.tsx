import {
   Tooltip,
   TooltipContent,
   TooltipProvider,
   TooltipTrigger,
} from "@packages/ui/components/tooltip";
import { useTheme } from "@packages/ui/lib/theme-provider";
import { cn } from "@packages/ui/lib/utils";
import { ClientOnly } from "@tanstack/react-router";
import { type LucideIcon, Monitor, Moon, Sun } from "lucide-react";
import { motion } from "motion/react";

type ThemeKey = "light" | "dark" | "system";

const THEMES: { key: ThemeKey; icon: LucideIcon; label: string }[] = [
   { key: "system", icon: Monitor, label: "Tema do sistema" },
   { key: "light", icon: Sun, label: "Tema claro" },
   { key: "dark", icon: Moon, label: "Tema escuro" },
];

interface ThemeSwitcherProps {
   className?: string;
}

export function ThemeSwitcher({ className }: ThemeSwitcherProps) {
   const { theme, setTheme } = useTheme();

   return (
      <ClientOnly fallback={null}>
         <TooltipProvider>
            <div
               className={cn(
                  "relative isolate flex h-8 gap-2 rounded-full bg-background p-2 ring-1 ring-border",
                  className,
               )}
            >
               {THEMES.map(({ key, icon: Icon, label }) => {
                  const isActive = theme === key;
                  return (
                     <Tooltip key={key}>
                        <TooltipTrigger asChild>
                           <button
                              aria-label={label}
                              className="relative size-4 rounded-full"
                              onClick={() => setTheme(key)}
                              type="button"
                           >
                              {isActive && (
                                 <motion.div
                                    className="absolute inset-0 rounded-full bg-muted"
                                    layoutId="activeTheme"
                                    transition={{
                                       duration: 0.5,
                                       type: "spring",
                                    }}
                                 />
                              )}
                              <Icon
                                 className={cn(
                                    "relative z-10 size-4",
                                    isActive
                                       ? "text-foreground"
                                       : "text-muted-foreground",
                                 )}
                              />
                           </button>
                        </TooltipTrigger>
                        <TooltipContent>{label}</TooltipContent>
                     </Tooltip>
                  );
               })}
            </div>
         </TooltipProvider>
      </ClientOnly>
   );
}
