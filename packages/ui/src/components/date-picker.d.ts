export declare const title = "Date Picker with Month and Year Selector";
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
export declare const DatePicker: ({
   date: dateProp,
   onSelect,
   className,
   placeholder,
}?: DatePickerProps) => import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=date-picker.d.ts.map
