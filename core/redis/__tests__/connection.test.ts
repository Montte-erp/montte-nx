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

import { createRedis } from "../src/connection";

describe("redis connection", () => {
   beforeEach(() => {
      vi.clearAllMocks();
   });

   it("creates a Redis connection with IPv6 family enabled", () => {
      const redis = createRedis("redis://cache:6379");

      expect(redisConstructorMock).toHaveBeenCalledWith(
         "redis://cache:6379?family=6",
         {
            maxRetriesPerRequest: null,
         },
      );
      expect(redis).toBe(redisInstance);
   });

   it("registers connect and error log handlers", () => {
      createRedis("redis://cache:6379");

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
