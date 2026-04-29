export type ErrorCategory =
   | "BAD_REQUEST"
   | "UNAUTHORIZED"
   | "FORBIDDEN"
   | "NOT_FOUND"
   | "CONFLICT"
   | "GATEWAY_ERROR"
   | "UNSUPPORTED_CAPABILITY"
   | "RATE_LIMIT"
   | "INTERNAL";

export interface HyprPayErrorOptions {
   category: ErrorCategory;
   code: string;
   message: string;
   cause?: unknown;
   meta?: Record<string, unknown>;
}

export class HyprPayError extends Error {
   readonly category: ErrorCategory;
   readonly code: string;
   readonly meta?: Record<string, unknown>;

   constructor(opts: HyprPayErrorOptions) {
      super(opts.message);
      this.name = "HyprPayError";
      this.category = opts.category;
      this.code = opts.code;
      this.meta = opts.meta;
      if (opts.cause !== undefined) {
         (this as { cause?: unknown }).cause = opts.cause;
      }
   }

   static badRequest(
      code: string,
      message: string,
      meta?: Record<string, unknown>,
   ) {
      return new HyprPayError({ category: "BAD_REQUEST", code, message, meta });
   }
   static notFound(
      code: string,
      message: string,
      meta?: Record<string, unknown>,
   ) {
      return new HyprPayError({ category: "NOT_FOUND", code, message, meta });
   }
   static conflict(
      code: string,
      message: string,
      meta?: Record<string, unknown>,
   ) {
      return new HyprPayError({ category: "CONFLICT", code, message, meta });
   }
   static unauthorized(code: string, message: string) {
      return new HyprPayError({ category: "UNAUTHORIZED", code, message });
   }
   static forbidden(code: string, message: string) {
      return new HyprPayError({ category: "FORBIDDEN", code, message });
   }
   static gateway(
      code: string,
      message: string,
      meta?: Record<string, unknown>,
   ) {
      return new HyprPayError({
         category: "GATEWAY_ERROR",
         code,
         message,
         meta,
      });
   }
   static unsupportedCapability(gatewayId: string, capability: string) {
      return new HyprPayError({
         category: "UNSUPPORTED_CAPABILITY",
         code: "UNSUPPORTED_CAPABILITY",
         message: `Gateway "${gatewayId}" não suporta a capacidade "${capability}".`,
         meta: { gatewayId, capability },
      });
   }
   static internal(code: string, message: string, cause?: unknown) {
      return new HyprPayError({ category: "INTERNAL", code, message, cause });
   }
}

export type ErrorCodeMap = Record<string, string>;

export function mergeErrorCodes(
   pluginCodes: Array<{ pluginId: string; codes?: ErrorCodeMap }>,
): Record<string, ErrorCodeMap> {
   const result: Record<string, ErrorCodeMap> = {};
   for (const { pluginId, codes } of pluginCodes) {
      if (!codes) continue;
      result[pluginId] = { ...codes };
   }
   return result;
}
