import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { Result } from "better-result";

dayjs.extend(utc);
dayjs.extend(timezone);

export function getCurrentDate(tz?: string): { date: string } {
   if (tz) {
      return { date: dayjs().tz(tz).format("YYYY-MM-DD") };
   }
   return { date: dayjs().format("YYYY-MM-DD") };
}

export type DateLocale = "pt-BR" | "en-US";

export function formatDate(
   date: Date | string,
   format: string = "DD/MM/YYYY",
   options?: { locale?: DateLocale; timezone?: string; useUTC?: boolean },
): string {
   const parsedDate = dayjs(date);
   const dateResult = parsedDate.isValid()
      ? Result.ok(parsedDate)
      : Result.err("-");
   if (Result.isError(dateResult)) return dateResult.error;

   const useUTC = options?.useUTC ?? true;
   const tz = options?.timezone;

   let d = dateResult.value;
   if (useUTC) {
      d = d.utc();
   } else if (tz) {
      d = d.tz(tz);
   }

   const locale = options?.locale ?? "pt-BR";
   const monthLong = new Intl.DateTimeFormat(locale, {
      month: "long",
      timeZone: useUTC ? "UTC" : tz,
   }).format(parsedDate.toDate());
   const monthShort = new Intl.DateTimeFormat(locale, {
      month: "short",
      timeZone: useUTC ? "UTC" : tz,
   }).format(parsedDate.toDate());

   return format
      .replace(/YYYY/g, d.format("YYYY"))
      .replace(/yyyy/g, d.format("YYYY"))
      .replace(/MMMM/g, monthLong)
      .replace(/MMM/g, monthShort)
      .replace(/MM/g, d.format("MM"))
      .replace(/DD/g, d.format("DD"))
      .replace(/dd/g, d.format("DD"))
      .replace(/HH/g, d.format("HH"))
      .replace(/mm/g, d.format("mm"))
      .replace(/ss/g, d.format("ss"));
}

export type BillingInterval =
   | "hourly"
   | "shift"
   | "daily"
   | "weekly"
   | "monthly"
   | "semestral"
   | "annual"
   | "one_time";

export function advanceByBillingInterval(
   from: dayjs.ConfigType,
   interval: BillingInterval,
): dayjs.Dayjs | null {
   const start = dayjs(from);
   if (interval === "hourly") return start.add(1, "hour");
   if (interval === "shift") return start.add(8, "hour");
   if (interval === "daily") return start.add(1, "day");
   if (interval === "weekly") return start.add(1, "week");
   if (interval === "monthly") return start.add(1, "month");
   if (interval === "semestral") return start.add(6, "month");
   if (interval === "annual") return start.add(1, "year");
   return null;
}

export function formatRelativeTime(date: Date): string {
   const now = dayjs();
   const d = dayjs(date);
   const diffInSeconds = now.diff(d, "second");
   const diffInMinutes = now.diff(d, "minute");
   const diffInHours = now.diff(d, "hour");
   const diffInDays = now.diff(d, "day");

   if (diffInSeconds < 60) {
      return "agora mesmo";
   }

   if (diffInMinutes < 60) {
      return `${diffInMinutes} ${diffInMinutes === 1 ? "minuto" : "minutos"} atrás`;
   }

   if (diffInHours < 24) {
      return `${diffInHours} ${diffInHours === 1 ? "hora" : "horas"} atrás`;
   }

   if (diffInDays < 30) {
      return `${diffInDays} ${diffInDays === 1 ? "dia" : "dias"} atrás`;
   }

   return formatDate(date, "DD/MM/YYYY");
}
