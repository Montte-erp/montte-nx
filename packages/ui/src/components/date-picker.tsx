"use client";

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
import { formatDate } from "@packages/utils/date";
import { Calendar as CalendarIcon } from "lucide-react";
import type { ChangeEvent, ChangeEventHandler } from "react";
import { useState } from "react";

export interface DatePickerProps {
   date?: Date;
   onSelect?: (date: Date | undefined) => void;
   placeholder?: string;
   className?: string;
}

export function DatePicker({
   date,
   onSelect,
   placeholder = "Pick a date",
   className,
}: DatePickerProps) {
   const [month, setMonth] = useState<Date>(date ?? new Date());

   const handleCalendarChange = (
      value: string | number,
      event: ChangeEventHandler<HTMLSelectElement>,
   ) => {
      const newEvent = {
         target: {
            value: String(value),
         },
      } as ChangeEvent<HTMLSelectElement>;
      event(newEvent);
   };

   return (
      <Popover>
         <PopoverTrigger asChild>
            <Button
               className={cn(
                  "data-[empty=true]:text-muted-foreground w-[280px] justify-start text-left font-normal",
                  className,
               )}
               data-empty={!date}
               variant="outline"
            >
               <CalendarIcon />
               {date ? (
                  formatDate(date, "DD MMMM YYYY")
               ) : (
                  <span>{placeholder}</span>
               )}
            </Button>
         </PopoverTrigger>
         <PopoverContent align="start" className="w-auto p-0">
            <Calendar
               captionLayout="dropdown"
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
                        <SelectTrigger className="first:flex-1 last:shrink-0">
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
               mode="single"
               month={month}
               onMonthChange={setMonth}
               onSelect={onSelect}
               selected={date}
            />
         </PopoverContent>
      </Popover>
   );
}
