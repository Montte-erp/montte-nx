export type HyprPayErrorCode =
   | "UNAUTHORIZED"
   | "FORBIDDEN"
   | "NOT_FOUND"
   | "BAD_REQUEST"
   | "CONFLICT"
   | "TOO_MANY_REQUESTS"
   | "INTERNAL_ERROR"
   | "NETWORK_ERROR"
   | "TIMEOUT";

export class HyprPayError extends Error {
   readonly code: HyprPayErrorCode;
   readonly statusCode: number;

   constructor(code: HyprPayErrorCode, message: string, statusCode: number) {
      super(message);
      this.name = "HyprPayError";
      this.code = code;
      this.statusCode = statusCode;
   }

   static unauthorized(message: string) {
      return new HyprPayError("UNAUTHORIZED", message, 401);
   }
   static forbidden(message: string) {
      return new HyprPayError("FORBIDDEN", message, 403);
   }
   static notFound(message: string) {
      return new HyprPayError("NOT_FOUND", message, 404);
   }
   static badRequest(message: string) {
      return new HyprPayError("BAD_REQUEST", message, 400);
   }
   static conflict(message: string) {
      return new HyprPayError("CONFLICT", message, 409);
   }
   static tooManyRequests(message: string) {
      return new HyprPayError("TOO_MANY_REQUESTS", message, 429);
   }
   static internal(message: string) {
      return new HyprPayError("INTERNAL_ERROR", message, 500);
   }
   static network(message: string) {
      return new HyprPayError("NETWORK_ERROR", message, 0);
   }
   static timeout(message: string) {
      return new HyprPayError("TIMEOUT", message, 0);
   }

   static fromStatusCode(statusCode: number, message: string): HyprPayError {
      if (statusCode === 401) return HyprPayError.unauthorized(message);
      if (statusCode === 403) return HyprPayError.forbidden(message);
      if (statusCode === 404) return HyprPayError.notFound(message);
      if (statusCode === 400) return HyprPayError.badRequest(message);
      if (statusCode === 409) return HyprPayError.conflict(message);
      if (statusCode === 429) return HyprPayError.tooManyRequests(message);
      return HyprPayError.internal(message);
   }
}
