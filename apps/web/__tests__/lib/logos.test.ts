import { describe, expect, it } from "vitest";
import { bankDomain, bankLogoSources } from "@/lib/logos";

describe("bank logo helpers", () => {
   it("resolve C6 bank codes to the Logo.dev domain that has the real mark", () => {
      expect(bankDomain("336")).toBe("c6bank.com.br");
      expect(bankDomain("626")).toBe("c6bank.com.br");
   });

   it("resolve C6 bank names used by bank autocomplete results", () => {
      expect(bankLogoSources("626", undefined, "BCO C6 CONSIG")).toContain(
         "https://img.logo.dev/c6bank.com.br?fallback=monogram&format=webp&retina=true&size=128",
      );
   });

   it("resolve Banco Inter to inter.co instead of the stale Banco Inter domain", () => {
      expect(bankDomain("077")).toBe("inter.co");
      expect(bankLogoSources("077", undefined, "BANCO INTER")).toContain(
         "https://img.logo.dev/inter.co?fallback=monogram&format=webp&retina=true&size=128",
      );
   });

   it("adds a Logo.dev name source for every bank name even without a curated domain", () => {
      expect(bankLogoSources("525", undefined, "INTERCAM CC LTDA")).toContain(
         "https://img.logo.dev/name/intercam?fallback=monogram&format=webp&retina=true&size=128",
      );
   });

   it("keeps short aliases from hijacking unrelated bank names", () => {
      expect(
         bankLogoSources("525", undefined, "INTERCAM CC LTDA"),
      ).not.toContain(
         "https://img.logo.dev/inter.co?fallback=monogram&format=webp&retina=true&size=128",
      );
   });
});
