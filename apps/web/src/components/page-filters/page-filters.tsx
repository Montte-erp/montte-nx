import { Button } from "@packages/ui/components/button";
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuGroup,
   DropdownMenuItem,
   DropdownMenuLabel,
   DropdownMenuSeparator,
   DropdownMenuTrigger,
} from "@packages/ui/components/dropdown-menu";
import { Switch } from "@packages/ui/components/switch";
import { cn } from "@packages/ui/lib/utils";
import { ListFilter } from "lucide-react";
import { Children, isValidElement, startTransition } from "react";
import type React from "react";
import { PageFilter, type PageFilterProps } from "./page-filter";

function collectFilters(children: React.ReactNode): PageFilterProps[] {
   const items: PageFilterProps[] = [];
   Children.forEach(children, (child) => {
      if (!isValidElement(child)) return;
      if (
         (child.type as { displayName?: string })?.displayName !==
         PageFilter.displayName
      )
         return;
      items.push(child.props as PageFilterProps);
   });
   return items;
}

export function PageFilters({ children }: { children: React.ReactNode }) {
   const filters = collectFilters(children);
   if (filters.length === 0) return null;

   const activeCount = filters.filter((f) => f.active).length;

   const groups = filters.reduce<Record<string, PageFilterProps[]>>(
      (acc, f) => {
         if (!acc[f.group]) acc[f.group] = [];
         acc[f.group].push(f);
         return acc;
      },
      {},
   );

   return (
      <DropdownMenu>
         <DropdownMenuTrigger asChild>
            <Button
               className={cn(
                  "relative shrink-0",
                  activeCount > 0 &&
                     "border-primary/50 bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary",
               )}
               size="icon-sm"
               tooltip="Filtros"
               variant="outline"
            >
               <ListFilter />
               {activeCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                     {activeCount}
                  </span>
               )}
               <span className="sr-only">Filtros</span>
            </Button>
         </DropdownMenuTrigger>
         <DropdownMenuContent align="end" className="w-64">
            {Object.entries(groups).map(([groupLabel, groupFilters], gi) => (
               <DropdownMenuGroup key={groupLabel}>
                  {gi > 0 && <DropdownMenuSeparator />}
                  <DropdownMenuLabel>{groupLabel}</DropdownMenuLabel>
                  {groupFilters.map((filter) => (
                     <DropdownMenuItem
                        className="cursor-pointer justify-between gap-4 py-2.5"
                        key={filter.id}
                        onSelect={(e) => {
                           e.preventDefault();
                           startTransition(() => {
                              filter.onToggle(!filter.active);
                           });
                        }}
                     >
                        <span className="flex items-center gap-2 text-sm">
                           {filter.icon && (
                              <span className="text-muted-foreground shrink-0">
                                 {filter.icon}
                              </span>
                           )}
                           {filter.label}
                        </span>
                        <Switch
                           checked={filter.active}
                           className="pointer-events-none shrink-0"
                        />
                     </DropdownMenuItem>
                  ))}
               </DropdownMenuGroup>
            ))}
         </DropdownMenuContent>
      </DropdownMenu>
   );
}
