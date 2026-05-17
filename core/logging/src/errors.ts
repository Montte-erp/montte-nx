import type { ORPCErrorCode, ORPCErrorOptions } from "@orpc/client";
import { ORPCError } from "@orpc/server";
import { ZodError, type z } from "zod";

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
      super(message, { cause: options?.cause });
      this.name = "AppError";
      this.status = status;
      this.data = options?.data;

      Error.captureStackTrace?.(this, AppError);
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

export class WebAppError<
   TCode extends ORPCErrorCode = ORPCErrorCode,
   TData = unknown,
> extends ORPCError<TCode, TData | undefined> {
   public readonly source?: string;

   constructor(
      code: TCode,
      options?: ORPCErrorOptions<TData | undefined> & { source?: string },
   ) {
      if (!options) {
         super(code);
         return;
      }
      const { source, ...rest } = options;
      super(code, rest);
      this.source = source;
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
   const parsed = schema.safeParse(value);
   if (parsed.success) return parsed.data;

   const errors =
      parsed.error instanceof ZodError
         ? parsed.error.issues
              .map((err) => `${err.path.join(".")}: ${err.message}`)
              .join("; ")
         : "Input validation failed";

   throw AppError.validation("Input validation failed", {
      cause: errors,
   });
}
