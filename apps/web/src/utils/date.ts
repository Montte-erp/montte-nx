import dayjs from "dayjs";
import "dayjs/locale/pt-br";

export function formatDate(date: Date | string | null, format = "DD/MM/YYYY") {
   if (!date) return "-";
   const parsedDate = dayjs(date);
   if (!parsedDate.isValid()) return "-";
   return parsedDate.locale("pt-br").format(format);
}
