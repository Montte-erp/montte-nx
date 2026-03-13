import { beforeEach, describe, expect, it, vi } from "vitest";

const {
   loggerErrorMock,
   loggerInfoMock,
   redisConstructorMock,
   redisOnMock,
   redisInstance,
} = vi.hoisted(() => {
   const redisOnMock = vi.fn();
   const redisInstance = {
      on: redisOnMock,
   };

   return {
      loggerErrorMock: vi.fn(),
      loggerInfoMock: vi.fn(),
      redisConstructorMock: vi.fn(
         (_url: string, _options: { maxRetriesPerRequest: null }) =>
            redisInstance,
      ),
      redisInstance,
      redisOnMock,
   };
});

vi.mock("@core/environment/web/server", () => ({
   env: {
      REDIS_URL: "redis://cache:6379",
   },
}));

vi.mock("@core/logging/root", () => ({
   getLogger: () => ({
      child: () => ({
         error: loggerErrorMock,
         info: loggerInfoMock,
      }),
   }),
}));

vi.mock("ioredis", () => ({
   Redis: function MockRedis(
      this: unknown,
      url: string,
      options: { maxRetriesPerRequest: null },
   ) {
      redisConstructorMock(url, options);
      return redisInstance;
   },
}));

describe("redis connection", () => {
   beforeEach(() => {
      vi.clearAllMocks();
      vi.resetModules();
   });

   it("creates the shared Redis connection with IPv6 family enabled", async () => {
      const { redis } = await import("../src/connection");

      expect(redisConstructorMock).toHaveBeenCalledWith(
         "redis://cache:6379?family=6",
         {
            maxRetriesPerRequest: null,
         },
      );
      expect(redis).toBe(redisInstance);
   });

   it("registers connect and error log handlers", async () => {
      await import("../src/connection");

      expect(redisOnMock).toHaveBeenCalledWith("error", expect.any(Function));
      expect(redisOnMock).toHaveBeenCalledWith("connect", expect.any(Function));

      const errorHandler = redisOnMock.mock.calls.find(
         ([eventName]) => eventName === "error",
      )?.[1] as ((error: Error) => void) | undefined;
      const connectHandler = redisOnMock.mock.calls.find(
         ([eventName]) => eventName === "connect",
      )?.[1] as (() => void) | undefined;

      const error = new Error("connection failed");
      errorHandler?.(error);
      connectHandler?.();

      expect(loggerErrorMock).toHaveBeenCalledWith(
         { err: error },
         "Connection error",
      );
      expect(loggerInfoMock).toHaveBeenCalledWith("Connected successfully");
   });
});
