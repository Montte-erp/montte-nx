import type { Table } from "@tanstack/react-table";
import { Button } from "@packages/ui/components/button";
import { Calendar } from "@packages/ui/components/calendar";
import {
   Command,
   CommandEmpty,
   CommandGroup,
   CommandInput,
   CommandItem,
   CommandList,
} from "@packages/ui/components/command";
import {
   Popover,
   PopoverContent,
   PopoverTrigger,
} from "@packages/ui/components/popover";
import dayjs from "dayjs";
import { useState } from "react";

interface DataImportBulkEditProps<TData> {
   table: Table<TData>;
   selectedIndices: Set<number>;
   onUpdate: (
      keyOrPatch: string | Record<string, unknown>,
      value?: unknown,
   ) => void;
}

export function DataImportBulkEdit<TData>({
   table,
   selectedIndices,
   onUpdate,
}: DataImportBulkEditProps<TData>) {
   const [openCol, setOpenCol] = useState<string | null>(null);
   const [calendarMonth, setCalendarMonth] = useState<Date>(dayjs().toDate());

   const cols = table
      .getVisibleLeafColumns()
      .filter(
         (col) =>
            col.id !== "__select" &&
            col.id !== "__actions" &&
            !col.columnDef.meta?.importIgnore &&
            col.columnDef.meta?.isEditable &&
            (col.columnDef.meta.cellComponent === "combobox" ||
               col.columnDef.meta.cellComponent === "select" ||
               col.columnDef.meta.cellComponent === "date"),
      );

   if (cols.length === 0 || selectedIndices.size === 0) return null;

   return (
      <>
         {cols.map((col) => {
            const meta = col.columnDef.meta;
            if (!meta) return null;
            const accKey =
               "accessorKey" in col.columnDef &&
               col.columnDef.accessorKey != null
                  ? String(col.columnDef.accessorKey)
                  : col.id;
            const tooltipText = `Trocar ${(meta.label ?? accKey).toLowerCase()}`;
            const isOpen = openCol === accKey;
            const colOptions = meta.editOptions ?? [];

            const Icon = meta.bulkEditIcon;
            const triggerBtn = (
               <PopoverTrigger asChild>
                  <Button
                     className="size-8"
                     size="icon-sm"
                     tooltip={tooltipText}
                     type="button"
                     variant="outline"
                  >
                     {Icon ? (
                        <Icon className="size-3.5" />
                     ) : (
                        (meta.label ?? accKey).slice(0, 2)
                     )}
                     <span className="sr-only">{tooltipText}</span>
                  </Button>
               </PopoverTrigger>
            );

            if (meta.cellComponent === "date") {
               return (
                  <Popover
                     key={accKey}
                     open={isOpen}
                     onOpenChange={(v) => {
                        setOpenCol(v ? accKey : null);
                        if (v) setCalendarMonth(dayjs().toDate());
                     }}
                  >
                     {triggerBtn}
                     <PopoverContent align="start" className="w-auto p-0">
                        <Calendar
                           captionLayout="dropdown"
                           mode="single"
                           month={calendarMonth}
                           onMonthChange={setCalendarMonth}
                           onSelect={(d) => {
                              if (!d) return;
                              onUpdate(accKey, dayjs(d).format("YYYY-MM-DD"));
                              setOpenCol(null);
                           }}
                        />
                     </PopoverContent>
                  </Popover>
               );
            }

            if (meta.cellComponent === "select") {
               return (
                  <Popover
                     key={accKey}
                     open={isOpen}
                     onOpenChange={(v) => setOpenCol(v ? accKey : null)}
                  >
                     {triggerBtn}
                     <PopoverContent align="start" className="w-44 p-1">
                        {colOptions.map((opt) => (
                           <Button
                              className="w-full justify-start text-xs"
                              key={opt.value}
                              onClick={() => {
                                 const patch = meta.bulkEditPatch?.(opt);
                                 if (patch) onUpdate(patch);
                                 else onUpdate(accKey, opt.value);
                                 setOpenCol(null);
                              }}
                              size="sm"
                              type="button"
                              variant="ghost"
                           >
                              {opt.label}
                           </Button>
                        ))}
                     </PopoverContent>
                  </Popover>
               );
            }

            return (
               <Popover
                  key={accKey}
                  open={isOpen}
                  onOpenChange={(v) => setOpenCol(v ? accKey : null)}
               >
                  {triggerBtn}
                  <PopoverContent align="start" className="w-60 p-0">
                     <Command>
                        <CommandInput
                           aria-label="Buscar opção"
                           placeholder="Buscar..."
                        />
                        <CommandList>
                           <CommandEmpty>
                              Nenhuma opção encontrada.
                           </CommandEmpty>
                           <CommandGroup>
                              {colOptions.map((opt) => (
                                 <CommandItem
                                    key={opt.value}
                                    keywords={[opt.label]}
                                    value={opt.value}
                                    onSelect={() => {
                                       const patch = meta.bulkEditPatch?.(opt);
                                       if (patch) onUpdate(patch);
                                       else onUpdate(accKey, opt.value);
                                       setOpenCol(null);
                                    }}
                                 >
                                    {opt.label}
                                 </CommandItem>
                              ))}
                           </CommandGroup>
                        </CommandList>
                     </Command>
                  </PopoverContent>
               </Popover>
            );
         })}
      </>
   );
}
