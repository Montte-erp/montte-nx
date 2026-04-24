import { logs } from "@opentelemetry/api-logs";
import { ORPCError } from "@orpc/server";
import { ZodError } from "zod";
const otelLogger = logs.getLogger("montte-errors");
export class AppError extends Error {
   status;
   data;
   constructor(message, status = 500, options) {
      super(message);
      this.name = "AppError";
      this.status = status;
      this.cause = options?.cause;
      this.data = options?.data;
      Error.captureStackTrace?.(this, AppError);
      otelLogger.emit({
         severityText: status >= 500 ? "error" : "warn",
         body: message,
         attributes: {
            "error.type": "AppError",
            "error.status": status,
            "error.stack": this.stack ?? "",
            ...(options?.cause ? { "error.cause": String(options.cause) } : {}),
         },
      });
   }
   static database(message, options) {
      return new AppError(message, 500, options);
   }
   static validation(message, options) {
      return new AppError(message, 400, options);
   }
   static notFound(message, options) {
      return new AppError(message, 404, options);
   }
   static unauthorized(message, options) {
      return new AppError(message, 401, options);
   }
   static forbidden(message, options) {
      return new AppError(message, 403, options);
   }
   static conflict(message, options) {
      return new AppError(message, 409, options);
   }
   static tooManyRequests(message, options) {
      return new AppError(message, 429, options);
   }
   static internal(message, options) {
      return new AppError(message, 500, options);
   }
}
const SERVER_ERROR_CODES = new Set([
   "INTERNAL_SERVER_ERROR",
   "NOT_IMPLEMENTED",
   "BAD_GATEWAY",
   "SERVICE_UNAVAILABLE",
   "GATEWAY_TIMEOUT",
]);
export class WebAppError extends ORPCError {
   constructor(code, options) {
      super(code, options);
      otelLogger.emit({
         severityText: SERVER_ERROR_CODES.has(code) ? "error" : "warn",
         body: options?.message ?? code,
         attributes: {
            "error.type": "WebAppError",
            "error.code": code,
            "error.stack": this.stack ?? "",
            ...(options?.source ? { "error.source": options.source } : {}),
         },
      });
   }
   static notFound(message, options) {
      return new WebAppError("NOT_FOUND", { message, ...options });
   }
   static forbidden(message, options) {
      return new WebAppError("FORBIDDEN", { message, ...options });
   }
   static unauthorized(message, options) {
      return new WebAppError("UNAUTHORIZED", { message, ...options });
   }
   static badRequest(message, options) {
      return new WebAppError("BAD_REQUEST", { message, ...options });
   }
   static conflict(message, options) {
      return new WebAppError("CONFLICT", { message, ...options });
   }
   static internal(message, options) {
      return new WebAppError("INTERNAL_SERVER_ERROR", { message, ...options });
   }
   static tooManyRequests(message, options) {
      return new WebAppError("TOO_MANY_REQUESTS", { message, ...options });
   }
   static fromAppError(error) {
      const codeMap = {
         400: "BAD_REQUEST",
         401: "UNAUTHORIZED",
         403: "FORBIDDEN",
         404: "NOT_FOUND",
         409: "CONFLICT",
         429: "TOO_MANY_REQUESTS",
         500: "INTERNAL_SERVER_ERROR",
      };
      const code = codeMap[error.status] ?? "INTERNAL_SERVER_ERROR";
      return new WebAppError(code, {
         message: error.message,
         cause: error.cause,
         data: error.data,
      });
   }
}
export function propagateError(err) {
   if (err instanceof AppError) {
      throw err;
   }
   return;
}
export function validateInput(schema, value) {
   try {
      return schema.parse(value);
   } catch (e) {
      if (e instanceof ZodError) {
         const errors = e.issues
            .map((err) => `${err.path.join(".")}: ${err.message}`)
            .join("; ");
         throw AppError.validation("Input validation failed", {
            cause: errors,
         });
      }
      throw e;
   }
}
