import { ORPCError } from "@orpc/server";
import type { ORPCErrorCode, ORPCErrorOptions } from "@orpc/client";
import { type z } from "zod";
export declare class AppError extends Error {
   status: number;
   data?: unknown;
   constructor(
      message: string,
      status?: number,
      options?: {
         cause?: unknown;
         data?: unknown;
      },
   );
   static database(
      message: string,
      options?: {
         cause?: unknown;
         data?: unknown;
      },
   ): AppError;
   static validation(
      message: string,
      options?: {
         cause?: unknown;
         data?: unknown;
      },
   ): AppError;
   static notFound(
      message: string,
      options?: {
         cause?: unknown;
         data?: unknown;
      },
   ): AppError;
   static unauthorized(
      message: string,
      options?: {
         cause?: unknown;
         data?: unknown;
      },
   ): AppError;
   static forbidden(
      message: string,
      options?: {
         cause?: unknown;
         data?: unknown;
      },
   ): AppError;
   static conflict(
      message: string,
      options?: {
         cause?: unknown;
         data?: unknown;
      },
   ): AppError;
   static tooManyRequests(
      message: string,
      options?: {
         cause?: unknown;
         data?: unknown;
      },
   ): AppError;
   static internal(
      message: string,
      options?: {
         cause?: unknown;
         data?: unknown;
      },
   ): AppError;
}
export declare class WebAppError<
   TCode extends ORPCErrorCode = ORPCErrorCode,
   TData = unknown,
> extends ORPCError<TCode, TData> {
   constructor(code: TCode, options?: ORPCErrorOptions<TData>);
   static notFound(
      message: string,
      options?: {
         cause?: unknown;
         data?: unknown;
      },
   ): WebAppError<"NOT_FOUND">;
   static forbidden(
      message: string,
      options?: {
         cause?: unknown;
         data?: unknown;
      },
   ): WebAppError<"FORBIDDEN">;
   static unauthorized(
      message: string,
      options?: {
         cause?: unknown;
         data?: unknown;
      },
   ): WebAppError<"UNAUTHORIZED">;
   static badRequest(
      message: string,
      options?: {
         cause?: unknown;
         data?: unknown;
      },
   ): WebAppError<"BAD_REQUEST">;
   static conflict(
      message: string,
      options?: {
         cause?: unknown;
         data?: unknown;
      },
   ): WebAppError<"CONFLICT">;
   static internal(
      message: string,
      options?: {
         cause?: unknown;
         data?: unknown;
      },
   ): WebAppError<"INTERNAL_SERVER_ERROR">;
   static tooManyRequests(
      message: string,
      options?: {
         cause?: unknown;
         data?: unknown;
      },
   ): WebAppError<"TOO_MANY_REQUESTS">;
   static fromAppError(error: AppError): WebAppError;
}
export declare function propagateError(err: unknown): void;
export declare function validateInput<T extends z.ZodTypeAny>(
   schema: T,
   value: unknown,
): z.infer<T>;
//# sourceMappingURL=errors.d.ts.map
