import { createHash } from "node:crypto";

export const stringifyJson = (value: unknown) => JSON.stringify(value);

export const sha256Hash = (value: string) =>
   createHash("sha256").update(value).digest("hex");

export const sha256JsonHash = (value: unknown) =>
   sha256Hash(stringifyJson(value));
