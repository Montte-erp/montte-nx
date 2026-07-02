import { describe, expect, it } from "@effect/vitest";
import { Effect, Result } from "effect";
import {
   sha256Hash,
   sha256JsonHash,
   stringifyJson,
   UtilsErrorCodeValue,
} from "../src/hash";

describe("hash", () => {
   it("sha256Hash keeps plain string hashing synchronous", () => {
      expect(sha256Hash("ok")).toMatch(/^[a-f0-9]{64}$/);
   });

   it.effect(
      "stringifyJson keeps unsupported roots in the typed error channel",
      () =>
         Effect.gen(function* () {
            const undefinedResult = yield* Effect.result(
               stringifyJson(undefined),
            );
            const functionResult = yield* Effect.result(
               stringifyJson(() => undefined),
            );
            const symbolResult = yield* Effect.result(
               stringifyJson(Symbol("value")),
            );

            expect(Result.isFailure(undefinedResult)).toBe(true);
            if (Result.isFailure(undefinedResult)) {
               expect(undefinedResult.failure.code).toBe(
                  UtilsErrorCodeValue.jsonRootUnserializable,
               );
            }

            expect(Result.isFailure(functionResult)).toBe(true);
            if (Result.isFailure(functionResult)) {
               expect(functionResult.failure.code).toBe(
                  UtilsErrorCodeValue.jsonRootUnserializable,
               );
            }

            expect(Result.isFailure(symbolResult)).toBe(true);
            if (Result.isFailure(symbolResult)) {
               expect(symbolResult.failure.code).toBe(
                  UtilsErrorCodeValue.jsonRootUnserializable,
               );
            }
         }),
   );

   it.effect("stringifyJson maps JSON stringify defects into UtilsError", () =>
      Effect.gen(function* () {
         const circular: { self?: unknown } = {};
         circular.self = circular;

         const result = yield* Effect.result(stringifyJson(circular));

         expect(Result.isFailure(result)).toBe(true);
         if (Result.isFailure(result)) {
            expect(result.failure.code).toBe(
               UtilsErrorCodeValue.jsonUnserializable,
            );
            expect(result.failure.reason).toBeDefined();
         }
      }),
   );

   it.effect("sha256JsonHash accepts serializable values", () =>
      Effect.gen(function* () {
         const digest = yield* sha256JsonHash({ value: "ok" });

         expect(digest).toMatch(/^[a-f0-9]{64}$/);
         expect(digest).toBe(sha256Hash(JSON.stringify({ value: "ok" })));
      }),
   );
});
