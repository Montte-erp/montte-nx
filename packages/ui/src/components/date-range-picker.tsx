"use client";

import dayjs from "dayjs";
import { Button } from "@packages/ui/components/button";
import { Calendar } from "@packages/ui/components/calendar";
import {
   Popover,
   PopoverContent,
   PopoverTrigger,
} from "@packages/ui/components/popover";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";

import { cn } from "@packages/ui/lib/utils";
import { CalendarIcon } from "lucide-react";
import type { ChangeEvent, ChangeEventHandler, ReactNode } from "react";
import { useEffect, useState } from "react";
import type { DateRange } from "react-day-picker";

export interface DateRangePreset {
   label: string;
   value: string;
}

export interface DateRangePickerProps {
   presets: readonly DateRangePreset[];
   selectedPreset?: string | null;
   selectedRange?: { from: Date; to?: Date } | null;
   onPresetSelect: (value: string) => void;
   onRangeSelect: (range: { from: Date; to: Date }) => void;
   heading?: string;
   /** Trigger button label */
   label?: string;
   /** Extra className for the trigger button */
   triggerClassName?: string;
   /** Variant for the trigger button */
   triggerVariant?:
      | "default"
      | "outline"
      | "secondary"
      | "ghost"
      | "link"
      | "destructive";
   /** Popover alignment */
   align?: "start" | "center" | "end";
   /** If provided, renders a clear button in the footer */
   onClear?: () => void;
   clearLabel?: string;
   clearClassName?: string;
   clearIcon?: ReactNode;
}

export function DateRangePicker({
   presets,
   selectedPreset,
   selectedRange,
   onPresetSelect,
   onRangeSelect,
   heading = "Período",
   label = "Período",
   triggerClassName,
   triggerVariant = "outline",
   align = "start",
   onClear,
   clearLabel = "Limpar",
   clearClassName,
   clearIcon,
}: DateRangePickerProps) {
   const [open, setOpen] = useState(false);
   const [pendingRange, setPendingRange] = useState<DateRange | undefined>(
      selectedRange
         ? { from: selectedRange.from, to: selectedRange.to }
         : undefined,
   );

   useEffect(() => {
      setPendingRange(
         selectedRange
            ? { from: selectedRange.from, to: selectedRange.to }
            : undefined,
      );
   }, [selectedRange]);

   const handleOpenChange = (next: boolean) => {
      if (!next) {
         setPendingRange(
            selectedRange
               ? { from: selectedRange.from, to: selectedRange.to }
               : undefined,
         );
      }
      setOpen(next);
   };

   const handlePresetClick = (value: string) => {
      setPendingRange(undefined);
      onPresetSelect(value);
      setOpen(false);
   };

   const handleCalendarSelect = (range: DateRange | undefined) => {
      setPendingRange(range);
   };

   const handleApply = () => {
      if (pendingRange?.from && pendingRange?.to) {
         onRangeSelect({ from: pendingRange.from, to: pendingRange.to });
         setOpen(false);
      }
   };

   const hasPendingRange = !!(pendingRange?.from && pendingRange?.to);

   const handleCalendarChange = (
      value: string | number,
      event: ChangeEventHandler<HTMLSelectElement>,
   ) => {
      const newEvent = {
         target: { value: String(value) },
      } as ChangeEvent<HTMLSelectElement>;
      event(newEvent);
   };

   const preventCloseOnNestedPopover = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-radix-popper-content-wrapper]")) {
         e.preventDefault();
      }
   };

   const calendarSelected: DateRange | undefined =
      pendingRange ??
      (selectedRange
         ? { from: selectedRange.from, to: selectedRange.to }
         : undefined);

   return (
      <Popover onOpenChange={handleOpenChange} open={open}>
         <PopoverTrigger asChild>
            <Button
               className={cn("gap-1.5", triggerClassName)}
               variant={triggerVariant}
            >
               <CalendarIcon className="size-3.5" />
               {label}
            </Button>
         </PopoverTrigger>
         <PopoverContent
            align={align}
            className="w-auto p-0"
            onFocusOutside={preventCloseOnNestedPopover}
            onInteractOutside={preventCloseOnNestedPopover}
         >
            <div className="flex">
               {/* Left: preset list */}
               <div className="flex flex-col gap-1 p-2 min-w-[160px] border-r">
                  {heading && (
                     <p className="text-xs font-medium text-muted-foreground px-2 pb-1 pt-0.5 uppercase tracking-wide">
                        {heading}
                     </p>
                  )}
                  {presets.map((preset) => {
                     const isActive =
                        selectedPreset === preset.value && !pendingRange?.from;
                     return (
                        <Button
                           className="justify-start text-sm font-normal"
                           key={preset.value}
                           onClick={() => handlePresetClick(preset.value)}
                           size="sm"
                           variant={isActive ? "default" : "ghost"}
                        >
                           {preset.label}
                        </Button>
                     );
                  })}
               </div>

               {/* Right: dual-month calendar with month/year dropdowns */}
               <div className="p-2">
                  <Calendar
                     captionLayout="dropdown"
                     classNames={{
                        months: "flex gap-0 flex-col md:flex-row relative",
                        month: "flex flex-col w-full gap-4 px-2 pb-2 [&:nth-child(n+3)]:border-l",
                     }}
                     components={{
                        MonthCaption: (props) => <>{props.children}</>,
                        DropdownNav: (props) => (
                           <div className="flex w-full items-center gap-2">
                              {props.children}
                           </div>
                        ),
                        Dropdown: (props) => (
                           <Select
                              onValueChange={(value) => {
                                 if (props.onChange) {
                                    handleCalendarChange(value, props.onChange);
                                 }
                              }}
                              value={String(props.value)}
                           >
                              <SelectTrigger className="first:flex-1 last:shrink-0 h-8 text-sm">
                                 <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                 {props.options?.map((option) => (
                                    <SelectItem
                                       disabled={option.disabled}
                                       key={option.value}
                                       value={String(option.value)}
                                    >
                                       {option.label}
                                    </SelectItem>
                                 ))}
                              </SelectContent>
                           </Select>
                        ),
                     }}
                     fromYear={2020}
                     hideNavigation
                     mode="range"
                     numberOfMonths={2}
                     onSelect={handleCalendarSelect}
                     selected={calendarSelected}
                     toYear={dayjs().year() + 5}
                  />
               </div>
            </div>

            {(hasPendingRange || onClear) && (
               <div className="border-t p-2 flex items-center gap-2">
                  {onClear && (
                     <Button
                        className={cn("flex-1", clearClassName)}
                        onClick={() => {
                           onClear();
                           setOpen(false);
                        }}
                        variant="ghost"
                     >
                        {clearIcon}
                        {clearLabel}
                     </Button>
                  )}
                  {hasPendingRange && (
                     <Button className="flex-1" onClick={handleApply} size="sm">
                        Aplicar
                     </Button>
                  )}
               </div>
            )}
         </PopoverContent>
      </Popover>
   );
}
