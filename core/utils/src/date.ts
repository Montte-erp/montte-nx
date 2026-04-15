import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

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
   date: Date,
   format: string = "MM/DD/YYYY",
   options?: { locale?: DateLocale; timezone?: string; useUTC?: boolean },
): string {
   if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      throw new Error("Invalid date provided");
   }

   const useUTC = options?.useUTC ?? true;
   const tz = options?.timezone;

   let d = dayjs(date);
   if (useUTC) {
      d = d.utc();
   } else if (tz) {
      d = d.tz(tz);
   }

   const locale = options?.locale ?? "pt-BR";
   const monthLong = new Intl.DateTimeFormat(locale, {
      month: "long",
      timeZone: useUTC ? "UTC" : tz,
   }).format(date);
   const monthShort = new Intl.DateTimeFormat(locale, {
      month: "short",
      timeZone: useUTC ? "UTC" : tz,
   }).format(date);

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
