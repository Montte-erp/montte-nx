import { createHash } from "node:crypto";
import { Effect, Schema } from "effect";

export const UtilsErrorCodeSchema = Schema.Literals([
   "utils.JSON_ROOT_UNSERIALIZABLE",
   "utils.JSON_UNSERIALIZABLE",
]);
export type UtilsErrorCode = (typeof UtilsErrorCodeSchema)["Type"];
export const UtilsErrorCodeValue = {
   jsonRootUnserializable: "utils.JSON_ROOT_UNSERIALIZABLE",
   jsonUnserializable: "utils.JSON_UNSERIALIZABLE",
} satisfies Record<string, UtilsErrorCode>;

export class UtilsError extends Schema.TaggedErrorClass<UtilsError>()(
   "UtilsError",
   {
      code: UtilsErrorCodeSchema,
      reason: Schema.optional(Schema.String),
   },
) {
   get message(): string {
      switch (this.code) {
         case "utils.JSON_ROOT_UNSERIALIZABLE":
            return this.reason ?? "Valor raiz não serializável para JSON.";
         case "utils.JSON_UNSERIALIZABLE":
            return this.reason ?? "Valor não serializável para JSON.";
      }
   }
}

export const stringifyJson = (
   value: unknown,
): Effect.Effect<string, UtilsError> =>
   Effect.gen(function* () {
      if (
         value === undefined ||
         typeof value === "function" ||
         typeof value === "symbol"
      ) {
         return yield* Effect.fail(
            new UtilsError({
               code: UtilsErrorCodeValue.jsonRootUnserializable,
            }),
         );
      }

      const serialized = yield* Effect.try({
         try: () => JSON.stringify(value),
         catch: (error) =>
            new UtilsError({
               code: UtilsErrorCodeValue.jsonUnserializable,
               reason: String(error),
            }),
      });
      if (serialized === undefined) {
         return yield* Effect.fail(
            new UtilsError({
               code: UtilsErrorCodeValue.jsonUnserializable,
            }),
         );
      }

      return serialized;
   });

export const sha256Hash = (value: string) =>
   createHash("sha256").update(value).digest("hex");

export const sha256JsonHash = (
   value: unknown,
): Effect.Effect<string, UtilsError> =>
   stringifyJson(value).pipe(Effect.map(sha256Hash));
