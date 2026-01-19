import { Input } from "@packages/ui/components/input";
import { cn } from "@packages/ui/lib/utils";
import { Search } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import {
   type ConfigSection,
   SECTION_INFO,
   searchOptions,
} from "./config-search-index";

type InsightConfigSearchProps = {
   query: string;
   setQuery: (query: string) => void;
   onSectionChange: (section: ConfigSection) => void;
};

export function InsightConfigSearch({
   query,
   setQuery,
   onSectionChange,
}: InsightConfigSearchProps) {
   const [isOpen, setIsOpen] = useState(false);
   const inputRef = useRef<HTMLInputElement>(null);

   const results = useMemo(() => searchOptions(query), [query]);

   // Group results by section
   const groupedResults = useMemo(() => {
      const groups: Record<ConfigSection, typeof results> = {
         "display-type": [],
         "time-filters": [],
         "data-filters": [],
         "chart-options": [],
         advanced: [],
      };

      for (const result of results) {
         groups[result.section].push(result);
      }

      return groups;
   }, [results]);

   const handleSelect = (section: ConfigSection) => {
      onSectionChange(section);
      setQuery("");
      setIsOpen(false);
      inputRef.current?.blur();
   };

   const hasResults = results.length > 0;

   return (
      <div className="relative hidden md:block">
         <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
               className="w-64 pl-9 h-9"
               onBlur={() => {
                  // Delay to allow click on results
                  setTimeout(() => setIsOpen(false), 150);
               }}
               onChange={(e) => {
                  setQuery(e.target.value);
                  setIsOpen(true);
               }}
               onFocus={() => setIsOpen(true)}
               placeholder="Buscar opcoes..."
               ref={inputRef}
               value={query}
            />
         </div>

         {/* Search Results Dropdown */}
         {isOpen && query.trim() && (
            <div className="absolute top-full right-0 mt-1 w-80 bg-popover border rounded-lg shadow-lg z-50 max-h-[300px] overflow-y-auto">
               {!hasResults ? (
                  <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                     Nenhum resultado encontrado
                  </div>
               ) : (
                  <div className="p-2">
                     {Object.entries(groupedResults).map(([section, items]) => {
                        if (items.length === 0) return null;

                        const sectionInfo =
                           SECTION_INFO[section as ConfigSection];
                        const SectionIcon = sectionInfo.icon;

                        return (
                           <div className="mb-2 last:mb-0" key={section}>
                              <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                 <SectionIcon className="h-3 w-3" />
                                 {sectionInfo.label}
                              </div>
                              {items.map((item) => {
                                 const Icon = item.icon;
                                 return (
                                    <button
                                       className={cn(
                                          "w-full flex items-start gap-3 px-2 py-2 rounded-md",
                                          "hover:bg-accent transition-colors text-left",
                                       )}
                                       key={item.id}
                                       onClick={() =>
                                          handleSelect(item.section)
                                       }
                                       type="button"
                                    >
                                       <Icon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                                       <div className="flex flex-col min-w-0">
                                          <span className="text-sm font-medium truncate">
                                             {item.label}
                                          </span>
                                          <span className="text-xs text-muted-foreground truncate">
                                             {item.description}
                                          </span>
                                       </div>
                                    </button>
                                 );
                              })}
                           </div>
                        );
                     })}
                  </div>
               )}
            </div>
         )}
      </div>
   );
}
