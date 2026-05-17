import { createHash } from "node:crypto";

export const stringifyJson = (value: unknown) => {
   if (
      value === undefined ||
      typeof value === "function" ||
      typeof value === "symbol"
   ) {
      throw new TypeError("Valor raiz não serializável para JSON.");
   }

   const serialized = JSON.stringify(value);
   if (serialized === undefined) {
      throw new TypeError("Valor não serializável para JSON.");
   }

   return serialized;
};

export const sha256Hash = (value: string) =>
   createHash("sha256").update(value).digest("hex");

export const sha256JsonHash = (value: unknown) =>
   sha256Hash(stringifyJson(value));
