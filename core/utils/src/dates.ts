import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";

dayjs.extend(customParseFormat);

export function isIsoDateString(value: string) {
   return dayjs(value, "YYYY-MM-DD", true).isValid();
}
