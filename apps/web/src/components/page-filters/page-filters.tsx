import { Button } from "@packages/ui/components/button";
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuGroup,
   DropdownMenuItem,
   DropdownMenuLabel,
   DropdownMenuRadioGroup,
   DropdownMenuRadioItem,
   DropdownMenuSeparator,
   DropdownMenuTrigger,
} from "@packages/ui/components/dropdown-menu";
import { Switch } from "@packages/ui/components/switch";
import { cn } from "@packages/ui/lib/utils";
import { ListFilter } from "lucide-react";
import { Children, isValidElement, startTransition } from "react";
import type React from "react";
import {
   PageFilterSelect,
   type PageFilterSelectProps,
} from "./page-filter-select";
import { PageFilter, type PageFilterProps } from "./page-filter";

type CollectedItem =
   | { kind: "toggle"; props: PageFilterProps }
   | { kind: "select"; props: PageFilterSelectProps };

function collectFilters(children: React.ReactNode): CollectedItem[] {
   const items: CollectedItem[] = [];
   Children.forEach(children, (child) => {
      if (!isValidElement(child)) return;
      const displayName = (child.type as { displayName?: string })?.displayName;
      if (displayName === PageFilter.displayName) {
         items.push({ kind: "toggle", props: child.props as PageFilterProps });
         return;
      }
      if (displayName === PageFilterSelect.displayName) {
         items.push({
            kind: "select",
            props: child.props as PageFilterSelectProps,
         });
      }
   });
   return items;
}

export function PageFilters({ children }: { children: React.ReactNode }) {
   const items = collectFilters(children);
   if (items.length === 0) return null;

   const activeCount = items.filter((i) =>
      i.kind === "toggle" ? i.props.active : false,
   ).length;

   const groups = items.reduce<Record<string, CollectedItem[]>>((acc, item) => {
      const group = item.props.group;
      if (!acc[group]) acc[group] = [];
      acc[group].push(item);
      return acc;
   }, {});

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
            {Object.entries(groups).map(([groupLabel, groupItems], gi) => (
               <DropdownMenuGroup key={groupLabel}>
                  {gi > 0 && <DropdownMenuSeparator />}
                  <DropdownMenuLabel>{groupLabel}</DropdownMenuLabel>
                  {groupItems.map((item) =>
                     item.kind === "toggle" ? (
                        <DropdownMenuItem
                           className="cursor-pointer justify-between gap-4 py-2.5"
                           key={item.props.id}
                           onSelect={(e) => {
                              e.preventDefault();
                              startTransition(() => {
                                 item.props.onToggle(!item.props.active);
                              });
                           }}
                        >
                           <span className="flex items-center gap-2 text-sm">
                              {item.props.icon && (
                                 <span className="text-muted-foreground shrink-0">
                                    {item.props.icon}
                                 </span>
                              )}
                              {item.props.label}
                           </span>
                           <Switch
                              checked={item.props.active}
                              className="pointer-events-none shrink-0"
                           />
                        </DropdownMenuItem>
                     ) : (
                        <DropdownMenuRadioGroup
                           key={item.props.id}
                           onValueChange={(value) =>
                              startTransition(() => item.props.onChange(value))
                           }
                           value={item.props.value}
                        >
                           {item.props.options.map((opt) => (
                              <DropdownMenuRadioItem
                                 key={opt.value}
                                 value={opt.value}
                              >
                                 {opt.label}
                              </DropdownMenuRadioItem>
                           ))}
                        </DropdownMenuRadioGroup>
                     ),
                  )}
               </DropdownMenuGroup>
            ))}
         </DropdownMenuContent>
      </DropdownMenu>
   );
}
