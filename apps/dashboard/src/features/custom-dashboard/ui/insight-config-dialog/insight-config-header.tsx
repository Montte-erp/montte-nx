import {
   Breadcrumb,
   BreadcrumbItem,
   BreadcrumbList,
   BreadcrumbPage,
   BreadcrumbSeparator,
} from "@packages/ui/components/breadcrumb";
import { type ConfigSection, SECTION_INFO } from "./config-search-index";
import { InsightConfigSearch } from "./insight-config-search";

type InsightConfigHeaderProps = {
   section: ConfigSection;
   searchQuery: string;
   onSearchQueryChange: (query: string) => void;
   onSectionChange: (section: ConfigSection) => void;
};

export function InsightConfigHeader({
   section,
   searchQuery,
   onSearchQueryChange,
   onSectionChange,
}: InsightConfigHeaderProps) {
   const sectionInfo = SECTION_INFO[section];

   return (
      <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b px-4">
         <Breadcrumb>
            <BreadcrumbList>
               <BreadcrumbItem>
                  <span className="text-muted-foreground">Configuracao</span>
               </BreadcrumbItem>
               <BreadcrumbSeparator />
               <BreadcrumbItem>
                  <BreadcrumbPage>{sectionInfo.label}</BreadcrumbPage>
               </BreadcrumbItem>
            </BreadcrumbList>
         </Breadcrumb>
         <InsightConfigSearch
            onSectionChange={onSectionChange}
            query={searchQuery}
            setQuery={onSearchQueryChange}
         />
      </header>
   );
}
