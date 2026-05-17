import type { RequestLogger } from "@core/logging/types";

export function isRequestLogger(value: unknown): value is RequestLogger {
   if (!value || typeof value !== "object") return false;
   return (
      typeof Reflect.get(value, "set") === "function" &&
      typeof Reflect.get(value, "emit") === "function"
   );
}
