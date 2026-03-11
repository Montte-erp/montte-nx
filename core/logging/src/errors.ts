import { logs } from "@opentelemetry/api-logs";
import { ORPCError } from "@orpc/server";
import type { ORPCErrorCode, ORPCErrorOptions } from "@orpc/client";
import { ZodError, type z } from "zod";

const otelLogger = logs.getLogger("montte-errors");

export class AppError extends Error {
   public status: number;
   public data?: unknown;

   constructor(
      message: string,
      status: number = 500,
      options?: {
         cause?: unknown;
         data?: unknown;
      },
   ) {
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

   static database(
      message: string,
      options?: { cause?: unknown; data?: unknown },
   ): AppError {
      return new AppError(message, 500, options);
   }

   static validation(
      message: string,
      options?: { cause?: unknown; data?: unknown },
   ): AppError {
      return new AppError(message, 400, options);
   }

   static notFound(
      message: string,
      options?: { cause?: unknown; data?: unknown },
   ): AppError {
      return new AppError(message, 404, options);
   }

   static unauthorized(
      message: string,
      options?: { cause?: unknown; data?: unknown },
   ): AppError {
      return new AppError(message, 401, options);
   }

   static forbidden(
      message: string,
      options?: { cause?: unknown; data?: unknown },
   ): AppError {
      return new AppError(message, 403, options);
   }

   static conflict(
      message: string,
      options?: { cause?: unknown; data?: unknown },
   ): AppError {
      return new AppError(message, 409, options);
   }

   static tooManyRequests(
      message: string,
      options?: { cause?: unknown; data?: unknown },
   ): AppError {
      return new AppError(message, 429, options);
   }

   static internal(
      message: string,
      options?: { cause?: unknown; data?: unknown },
   ): AppError {
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

export class WebAppError<
   TCode extends ORPCErrorCode = ORPCErrorCode,
   TData = unknown,
> extends ORPCError<TCode, TData> {
   constructor(code: TCode, options?: ORPCErrorOptions<TData>) {
      super(code, options as ORPCErrorOptions<TData>);

      otelLogger.emit({
         severityText: SERVER_ERROR_CODES.has(code) ? "error" : "warn",
         body: options?.message ?? code,
         attributes: {
            "error.type": "WebAppError",
            "error.code": code,
            "error.stack": this.stack ?? "",
         },
      });
   }

   static notFound(
      message: string,
      options?: { cause?: unknown; data?: unknown },
   ): WebAppError<"NOT_FOUND"> {
      return new WebAppError("NOT_FOUND", { message, ...options });
   }

   static forbidden(
      message: string,
      options?: { cause?: unknown; data?: unknown },
   ): WebAppError<"FORBIDDEN"> {
      return new WebAppError("FORBIDDEN", { message, ...options });
   }

   static unauthorized(
      message: string,
      options?: { cause?: unknown; data?: unknown },
   ): WebAppError<"UNAUTHORIZED"> {
      return new WebAppError("UNAUTHORIZED", { message, ...options });
   }

   static badRequest(
      message: string,
      options?: { cause?: unknown; data?: unknown },
   ): WebAppError<"BAD_REQUEST"> {
      return new WebAppError("BAD_REQUEST", { message, ...options });
   }

   static conflict(
      message: string,
      options?: { cause?: unknown; data?: unknown },
   ): WebAppError<"CONFLICT"> {
      return new WebAppError("CONFLICT", { message, ...options });
   }

   static internal(
      message: string,
      options?: { cause?: unknown; data?: unknown },
   ): WebAppError<"INTERNAL_SERVER_ERROR"> {
      return new WebAppError("INTERNAL_SERVER_ERROR", { message, ...options });
   }

   static tooManyRequests(
      message: string,
      options?: { cause?: unknown; data?: unknown },
   ): WebAppError<"TOO_MANY_REQUESTS"> {
      return new WebAppError("TOO_MANY_REQUESTS", { message, ...options });
   }

   static fromAppError(error: AppError): WebAppError {
      const codeMap: Record<number, ORPCErrorCode> = {
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

export function propagateError(err: unknown) {
   if (err instanceof AppError) {
      throw err;
   }
   return;
}

export function validateInput<T extends z.ZodTypeAny>(
   schema: T,
   value: unknown,
): z.infer<T> {
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
