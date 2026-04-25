import { describe, expect, it } from "vitest";
import { HyprPayError } from "../src/errors";

describe("HyprPayError", () => {
   describe("factory methods", () => {
      it.each([
         ["unauthorized", "UNAUTHORIZED", 401],
         ["forbidden", "FORBIDDEN", 403],
         ["notFound", "NOT_FOUND", 404],
         ["badRequest", "BAD_REQUEST", 400],
         ["conflict", "CONFLICT", 409],
         ["tooManyRequests", "TOO_MANY_REQUESTS", 429],
         ["internal", "INTERNAL_ERROR", 500],
         ["network", "NETWORK_ERROR", 0],
         ["timeout", "TIMEOUT", 0],
      ] as const)(
         "%s() sets correct code and statusCode",
         (method, code, statusCode) => {
            const err = HyprPayError[method]("test message");
            expect(err).toBeInstanceOf(HyprPayError);
            expect(err).toBeInstanceOf(Error);
            expect(err.name).toBe("HyprPayError");
            expect(err.code).toBe(code);
            expect(err.statusCode).toBe(statusCode);
            expect(err.message).toBe("test message");
         },
      );
   });

   describe("fromStatusCode", () => {
      it.each([
         [401, "UNAUTHORIZED"],
         [403, "FORBIDDEN"],
         [404, "NOT_FOUND"],
         [400, "BAD_REQUEST"],
         [409, "CONFLICT"],
         [429, "TOO_MANY_REQUESTS"],
      ] as const)("maps %d to %s", (statusCode, code) => {
         const err = HyprPayError.fromStatusCode(statusCode, "msg");
         expect(err.code).toBe(code);
         expect(err.statusCode).toBe(statusCode);
      });

      it.each([500, 503, 422, 0, 999])(
         "maps unknown status %d to INTERNAL_ERROR",
         (statusCode) => {
            const err = HyprPayError.fromStatusCode(statusCode, "msg");
            expect(err.code).toBe("INTERNAL_ERROR");
            expect(err.statusCode).toBe(500);
         },
      );
   });
});
