import dayjs from "dayjs";

export function formatDate(date: Date | string) {
   return dayjs(date).format("DD/MM/YYYY");
}
