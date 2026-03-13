import { Button } from "@packages/ui/components/button";
import * as React from "react";
import { type DayButton, DayPicker, type Locale } from "react-day-picker";
declare function Calendar({
   className,
   classNames,
   showOutsideDays,
   captionLayout,
   buttonVariant,
   locale,
   formatters,
   components,
   ...props
}: React.ComponentProps<typeof DayPicker> & {
   buttonVariant?: React.ComponentProps<typeof Button>["variant"];
}): import("react/jsx-runtime").JSX.Element;
declare function CalendarDayButton({
   className,
   day,
   modifiers,
   locale,
   ...props
}: React.ComponentProps<typeof DayButton> & {
   locale?: Partial<Locale>;
}): import("react/jsx-runtime").JSX.Element;
export { Calendar, CalendarDayButton };
//# sourceMappingURL=calendar.d.ts.map
