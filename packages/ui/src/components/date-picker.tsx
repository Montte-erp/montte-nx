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
import dayjs from "dayjs";
import { CalendarIcon } from "lucide-react";
import type { ChangeEvent, ChangeEventHandler } from "react";
import { useEffect, useRef, useState } from "react";

export const title = "Date Picker with Month and Year Selector";

export interface DatePickerProps {
   /** Controlled selected date */
   date?: Date | undefined;
   /** Called when user selects a date */
   onSelect?: (date: Date | undefined) => void;
   /** Optional CSS class applied to the trigger button */
   className?: string;
   /** Placeholder text shown when no date is selected */
   placeholder?: string;
}

export const DatePicker = ({
   date: dateProp,
   onSelect,
   className,
   placeholder,
}: DatePickerProps = {}) => {
   const isControlled = dateProp !== undefined || onSelect !== undefined;
   const [internalDate, setInternalDate] = useState<Date | undefined>(
      dayjs().toDate(),
   );
   const date = isControlled ? dateProp : internalDate;
   const [month, setMonth] = useState<Date>(dateProp ?? dayjs().toDate());
   const syncedRef = useRef(false);
   useEffect(() => {
      if (!syncedRef.current && dateProp) {
         setMonth(dateProp);
         syncedRef.current = true;
      }
   }, [dateProp]);

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

   const handleSelect = (selected: Date | undefined) => {
      if (isControlled) {
         onSelect?.(selected);
      } else {
         setInternalDate(selected);
      }
      if (selected) setMonth(selected);
   };

   return (
      <Popover>
         <PopoverTrigger asChild>
            <Button
               className={cn(
                  "w-[280px] justify-start text-left font-normal",
                  !date && "text-muted-foreground",
                  className,
               )}
               variant="outline"
            >
               <CalendarIcon className="mr-2 h-4 w-4" />
               {date ? (
                  dayjs(date).format("DD/MM/YYYY")
               ) : (
                  <span>{placeholder ?? "Pick a date"}</span>
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
               hideNavigation
               mode="single"
               month={month}
               onMonthChange={setMonth}
               onSelect={handleSelect}
               selected={date}
            />
         </PopoverContent>
      </Popover>
   );
};
