import { Input } from "@packages/ui/components/input";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
import { cn } from "@packages/ui/lib/utils";

export type WorkflowScheduleDraft = {
   cadence: "weekly" | "monthly";
   hour: string;
   minute: string;
   weekday: string;
   dayOfMonth: string;
};

const WEEKDAYS: ReadonlyArray<{ value: string; label: string }> = [
   { value: "1", label: "Segunda-feira" },
   { value: "2", label: "Terça-feira" },
   { value: "3", label: "Quarta-feira" },
   { value: "4", label: "Quinta-feira" },
   { value: "5", label: "Sexta-feira" },
   { value: "6", label: "Sábado" },
   { value: "0", label: "Domingo" },
];

const MONTH_DAYS = Array.from({ length: 31 }, (_, index) => {
   const day = index + 1;
   return { value: String(day), label: `Dia ${day}` };
});

function normalizeWeekday(dayOfWeek: string) {
   const numeric = Number(dayOfWeek);
   if (Number.isNaN(numeric)) return dayOfWeek;
   const normalized = ((numeric % 7) + 7) % 7;
   return String(normalized);
}

export function parseWorkflowScheduleFromCron(
   cron: string,
): WorkflowScheduleDraft {
   const [minute = "0", hour = "9", dayOfMonth = "*", , dayOfWeek = "*"] = cron
      .trim()
      .split(/\s+/);
   const isMonthly = dayOfMonth !== "*" && dayOfWeek === "*";
   return {
      cadence: isMonthly ? "monthly" : "weekly",
      hour: hour.padStart(2, "0"),
      minute: minute.padStart(2, "0"),
      weekday: dayOfWeek === "*" ? "1" : normalizeWeekday(dayOfWeek),
      dayOfMonth: dayOfMonth === "*" ? "1" : dayOfMonth,
   };
}

export function buildWorkflowCron(schedule: WorkflowScheduleDraft) {
   return schedule.cadence === "monthly"
      ? `${schedule.minute} ${schedule.hour} ${schedule.dayOfMonth} * *`
      : `${schedule.minute} ${schedule.hour} * * ${schedule.weekday}`;
}

export function buildWorkflowHumanLabel(schedule: WorkflowScheduleDraft) {
   const hour = schedule.hour.padStart(2, "0");
   const minute = schedule.minute.padStart(2, "0");
   if (schedule.cadence === "monthly") {
      return `Todo dia ${schedule.dayOfMonth} às ${hour}:${minute}`;
   }
   const weekdayLabel = WEEKDAYS.find(
      (day) => day.value === schedule.weekday,
   )?.label;
   if (schedule.weekday === "0") {
      return `Todo domingo às ${hour}:${minute}`;
   }
   return `Toda ${weekdayLabel?.toLowerCase().replace("-feira", "") ?? "segunda"} às ${hour}:${minute}`;
}

interface SchedulePickerProps {
   value: WorkflowScheduleDraft;
   onChange: (value: WorkflowScheduleDraft) => void;
   className?: string;
   disabled?: boolean;
}

export function SchedulePicker({
   value,
   onChange,
   className,
   disabled,
}: SchedulePickerProps) {
   return (
      <div className={cn("grid gap-4", className)}>
         <div className="grid gap-2">
            <span className="text-sm font-medium">Repetição</span>
            <Select
               disabled={disabled}
               value={value.cadence}
               onValueChange={(cadence) =>
                  onChange({
                     ...value,
                     cadence: cadence === "monthly" ? "monthly" : "weekly",
                  })
               }
            >
               <SelectTrigger>
                  <SelectValue placeholder="Selecionar" />
               </SelectTrigger>
               <SelectContent>
                  <SelectItem value="weekly">Toda semana</SelectItem>
                  <SelectItem value="monthly">Todo mês</SelectItem>
               </SelectContent>
            </Select>
         </div>

         {value.cadence === "weekly" ? (
            <div className="grid gap-2">
               <span className="text-sm font-medium">Dia da semana</span>
               <Select
                  disabled={disabled}
                  value={value.weekday}
                  onValueChange={(weekday) => onChange({ ...value, weekday })}
               >
                  <SelectTrigger>
                     <SelectValue placeholder="Selecionar" />
                  </SelectTrigger>
                  <SelectContent>
                     {WEEKDAYS.map((weekday) => (
                        <SelectItem key={weekday.value} value={weekday.value}>
                           {weekday.label}
                        </SelectItem>
                     ))}
                  </SelectContent>
               </Select>
            </div>
         ) : (
            <div className="grid gap-2">
               <span className="text-sm font-medium">Dia do mês</span>
               <Select
                  disabled={disabled}
                  value={value.dayOfMonth}
                  onValueChange={(dayOfMonth) =>
                     onChange({ ...value, dayOfMonth })
                  }
               >
                  <SelectTrigger>
                     <SelectValue placeholder="Selecionar" />
                  </SelectTrigger>
                  <SelectContent>
                     {MONTH_DAYS.map((day) => (
                        <SelectItem key={day.value} value={day.value}>
                           {day.label}
                        </SelectItem>
                     ))}
                  </SelectContent>
               </Select>
            </div>
         )}

         <div className="grid gap-2">
            <span className="text-sm font-medium">Horário</span>
            <Input
               disabled={disabled}
               step={60}
               type="time"
               value={`${value.hour}:${value.minute}`}
               onChange={(event) => {
                  const [hour = "09", minute = "00"] =
                     event.target.value.split(":");
                  onChange({
                     ...value,
                     hour: hour.padStart(2, "0"),
                     minute: minute.padStart(2, "0"),
                  });
               }}
            />
         </div>

         <p className="text-muted-foreground text-sm">
            {buildWorkflowHumanLabel(value)}
         </p>
      </div>
   );
}
