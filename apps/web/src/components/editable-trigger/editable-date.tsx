import { DatePicker } from "@packages/ui/components/date-picker";
import dayjs from "dayjs";
import { fromPromise } from "neverthrow";
import { useCallback, useState } from "react";

interface EditableDateProps {
   value: string;
   onSave: (value: string) => Promise<unknown>;
   placeholder?: string;
   className?: string;
}

function formatIso(date: Date | undefined): string {
   if (!date) return "";
   return dayjs(date).format("YYYY-MM-DD");
}

export function EditableDate({
   value,
   onSave,
   placeholder,
   className,
}: EditableDateProps) {
   const [displayed, setDisplayed] = useState(value);

   const handleSelect = useCallback(
      async (date: Date | undefined) => {
         const next = formatIso(date);
         const previous = displayed;
         setDisplayed(next);
         const result = await fromPromise(onSave(next), (e) => e);
         if (result.isErr()) setDisplayed(previous);
      },
      [displayed, onSave],
   );

   const parsed = displayed ? dayjs(displayed).toDate() : undefined;

   return (
      <DatePicker
         className={className ?? "h-8 w-full text-sm"}
         date={parsed}
         onSelect={handleSelect}
         placeholder={placeholder ?? "Selecionar data..."}
      />
   );
}
