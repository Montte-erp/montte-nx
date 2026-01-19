import { cn } from "@packages/ui/lib/utils";
import { ChartPie, LayoutDashboard, Users, Wallet, Zap } from "lucide-react";
import { useEffect, useState } from "react";

const sections = [
   {
      id: "core",
      label: "Caixa",
      icon: Wallet,
   },
   {
      id: "planning",
      label: "Planejar",
      icon: LayoutDashboard,
   },
   {
      id: "automation",
      label: "Auto",
      icon: Zap,
   },
   {
      id: "analytics",
      label: "Dashboards",
      icon: ChartPie,
   },
   {
      id: "team",
      label: "Time",
      icon: Users,
   },
];

function useScrollSpy(sectionIds: string[], offset = 100) {
   const [activeSection, setActiveSection] = useState(sectionIds[0]);

   useEffect(() => {
      const observer = new IntersectionObserver(
         (entries) => {
            for (const entry of entries) {
               if (entry.isIntersecting) {
                  setActiveSection(entry.target.id);
               }
            }
         },
         { rootMargin: `-${offset}px 0px -50% 0px` },
      );

      for (const id of sectionIds) {
         const element = document.getElementById(id);
         if (element) {
            observer.observe(element);
         }
      }

      return () => observer.disconnect();
   }, [sectionIds, offset]);

   return activeSection;
}

export function PricingMobileNav() {
   const sectionIds = sections.map((s) => s.id);
   const activeSection = useScrollSpy(sectionIds);

   const handleClick = (
      e: React.MouseEvent<HTMLAnchorElement>,
      sectionId: string,
   ) => {
      e.preventDefault();
      const element = document.getElementById(sectionId);
      if (element) {
         element.scrollIntoView({ behavior: "smooth", block: "start" });
      }
   };

   return (
      <nav
         aria-label="Navegacao por secoes"
         className="fixed bottom-0 inset-x-0 z-50 lg:hidden bg-background/95 backdrop-blur-md border-t border-border"
         role="navigation"
         style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
         <div className="flex items-center justify-around px-2 py-2">
            {sections.map((section) => {
               const Icon = section.icon;
               const isActive = activeSection === section.id;

               return (
                  <a
                     aria-current={isActive ? "true" : undefined}
                     aria-label={`Ir para secao ${section.label}`}
                     className={cn(
                        "flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg transition-colors min-w-[56px]",
                        isActive
                           ? "text-primary bg-primary/10"
                           : "text-muted-foreground active:bg-muted/50",
                     )}
                     href={`#${section.id}`}
                     key={section.id}
                     onClick={(e) => handleClick(e, section.id)}
                  >
                     <Icon className="size-5" />
                     <span className="text-[10px] font-medium">
                        {section.label}
                     </span>
                  </a>
               );
            })}
         </div>
      </nav>
   );
}
