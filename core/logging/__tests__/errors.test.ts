import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

const mockEmit = vi.fn();
vi.mock("@opentelemetry/api-logs", () => ({
   logs: {
      getLogger: () => ({
         emit: mockEmit,
      }),
   },
}));

const { AppError, WebAppError, propagateError, validateInput } =
   await import("../src/errors");

describe("AppError", () => {
   beforeEach(() => {
      mockEmit.mockClear();
   });

   it("creates an error with default status 500", () => {
      const error = new AppError("something broke");
      expect(error.message).toBe("something broke");
      expect(error.status).toBe(500);
      expect(error.name).toBe("AppError");
      expect(error).toBeInstanceOf(Error);
   });

   it("creates an error with custom status", () => {
      const error = new AppError("not found", 404);
      expect(error.status).toBe(404);
   });

   it("preserves cause and data", () => {
      const cause = new Error("original");
      const error = new AppError("wrapped", 500, {
         cause,
         data: { id: "123" },
      });
      expect(error.cause).toBe(cause);
      expect(error.data).toEqual({ id: "123" });
   });

   it("emits OTel log with severity error for 5xx", () => {
      new AppError("server error", 500);
      expect(mockEmit).toHaveBeenCalledOnce();
      expect(mockEmit.mock.calls[0][0]).toMatchObject({
         severityText: "error",
         body: "server error",
         attributes: expect.objectContaining({
            "error.type": "AppError",
            "error.status": 500,
         }),
      });
   });

   it("emits OTel log with severity warn for 4xx", () => {
      new AppError("bad request", 400);
      expect(mockEmit).toHaveBeenCalledOnce();
      expect(mockEmit.mock.calls[0][0].severityText).toBe("warn");
   });

   it("includes cause in OTel attributes when provided", () => {
      new AppError("fail", 500, { cause: "db timeout" });
      expect(mockEmit.mock.calls[0][0].attributes["error.cause"]).toBe(
         "db timeout",
      );
   });

   describe("static factories", () => {
      it(".database() creates 500 error", () => {
         const error = AppError.database("query failed");
         expect(error.status).toBe(500);
         expect(error.message).toBe("query failed");
      });

      it(".validation() creates 400 error", () => {
         const error = AppError.validation("invalid input");
         expect(error.status).toBe(400);
      });

      it(".notFound() creates 404 error", () => {
         const error = AppError.notFound("missing");
         expect(error.status).toBe(404);
      });

      it(".unauthorized() creates 401 error", () => {
         const error = AppError.unauthorized("no token");
         expect(error.status).toBe(401);
      });

      it(".forbidden() creates 403 error", () => {
         const error = AppError.forbidden("no access");
         expect(error.status).toBe(403);
      });

      it(".conflict() creates 409 error", () => {
         const error = AppError.conflict("duplicate");
         expect(error.status).toBe(409);
      });

      it(".tooManyRequests() creates 429 error", () => {
         const error = AppError.tooManyRequests("slow down");
         expect(error.status).toBe(429);
      });

      it(".internal() creates 500 error", () => {
         const error = AppError.internal("boom");
         expect(error.status).toBe(500);
      });
   });
});

describe("WebAppError", () => {
   beforeEach(() => {
      mockEmit.mockClear();
   });

   it("extends ORPCError", async () => {
      const { ORPCError } = await import("@orpc/server");
      const error = new WebAppError("NOT_FOUND", { message: "gone" });
      expect(error).toBeInstanceOf(ORPCError);
   });

   it("emits OTel log with severity error for server errors", () => {
      new WebAppError("INTERNAL_SERVER_ERROR", { message: "boom" });
      expect(mockEmit).toHaveBeenCalledOnce();
      expect(mockEmit.mock.calls[0][0]).toMatchObject({
         severityText: "error",
         body: "boom",
         attributes: expect.objectContaining({
            "error.type": "WebAppError",
            "error.code": "INTERNAL_SERVER_ERROR",
         }),
      });
   });

   it("emits OTel log with severity warn for client errors", () => {
      new WebAppError("NOT_FOUND", { message: "missing" });
      expect(mockEmit.mock.calls[0][0].severityText).toBe("warn");
   });

   it("uses code as body when no message provided", () => {
      new WebAppError("FORBIDDEN");
      expect(mockEmit.mock.calls[0][0].body).toBe("FORBIDDEN");
   });

   describe("static factories", () => {
      it(".notFound() creates NOT_FOUND error", () => {
         const error = WebAppError.notFound("missing");
         expect(error.code).toBe("NOT_FOUND");
         expect(error.message).toBe("missing");
      });

      it(".forbidden() creates FORBIDDEN error", () => {
         const error = WebAppError.forbidden("no access");
         expect(error.code).toBe("FORBIDDEN");
      });

      it(".unauthorized() creates UNAUTHORIZED error", () => {
         const error = WebAppError.unauthorized("no token");
         expect(error.code).toBe("UNAUTHORIZED");
      });

      it(".badRequest() creates BAD_REQUEST error", () => {
         const error = WebAppError.badRequest("invalid");
         expect(error.code).toBe("BAD_REQUEST");
      });

      it(".conflict() creates CONFLICT error", () => {
         const error = WebAppError.conflict("duplicate");
         expect(error.code).toBe("CONFLICT");
      });

      it(".internal() creates INTERNAL_SERVER_ERROR error", () => {
         const error = WebAppError.internal("boom");
         expect(error.code).toBe("INTERNAL_SERVER_ERROR");
      });

      it(".tooManyRequests() creates TOO_MANY_REQUESTS error", () => {
         const error = WebAppError.tooManyRequests("slow down");
         expect(error.code).toBe("TOO_MANY_REQUESTS");
      });
   });

   describe(".fromAppError()", () => {
      it("maps 404 AppError to NOT_FOUND", () => {
         const appError = AppError.notFound("missing");
         const webError = WebAppError.fromAppError(appError);
         expect(webError.code).toBe("NOT_FOUND");
         expect(webError.message).toBe("missing");
      });

      it("maps 403 AppError to FORBIDDEN", () => {
         const appError = AppError.forbidden("denied");
         const webError = WebAppError.fromAppError(appError);
         expect(webError.code).toBe("FORBIDDEN");
      });

      it("maps unknown status to INTERNAL_SERVER_ERROR", () => {
         const appError = new AppError("weird", 418);
         const webError = WebAppError.fromAppError(appError);
         expect(webError.code).toBe("INTERNAL_SERVER_ERROR");
      });
   });
});

describe("propagateError", () => {
   it("re-throws AppError instances", () => {
      const error = AppError.notFound("missing");
      expect(() => propagateError(error)).toThrow(error);
   });

   it("returns undefined for non-AppError", () => {
      expect(propagateError(new Error("regular"))).toBeUndefined();
      expect(propagateError("string error")).toBeUndefined();
      expect(propagateError(null)).toBeUndefined();
   });
});

describe("validateInput", () => {
   it("returns parsed value for valid input", () => {
      const schema = z.object({ name: z.string() });
      const result = validateInput(schema, { name: "test" });
      expect(result).toEqual({ name: "test" });
   });

   it("throws AppError with status 400 for invalid input", () => {
      const schema = z.object({ name: z.string() });
      try {
         validateInput(schema, { name: 123 });
         expect.unreachable();
      } catch (error) {
         expect(error).toBeInstanceOf(AppError);
         expect((error as InstanceType<typeof AppError>).status).toBe(400);
      }
   });

   it("re-throws non-Zod errors", () => {
      const schema = z.string().transform(() => {
         throw new TypeError("not zod");
      });
      expect(() => validateInput(schema, "test")).toThrow(TypeError);
   });
});
