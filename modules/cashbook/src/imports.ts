import { of, toMajorUnitsString } from "@f-o-t/money";

export function normalizeImportAmount(amount: string): string {
   return toMajorUnitsString(of(amount, "BRL"));
}
