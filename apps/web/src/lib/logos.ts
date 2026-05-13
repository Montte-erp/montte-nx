export const BRAND_LABEL: Record<string, string> = {
   visa: "Visa",
   mastercard: "Mastercard",
   elo: "Elo",
   amex: "Amex",
   hipercard: "Hipercard",
   other: "Outra",
};

export const BRAND_COLOR: Record<string, string> = {
   visa: "#1A1F71",
   mastercard: "#EB001B",
   elo: "#000000",
   amex: "#2E77BC",
   hipercard: "#822124",
   other: "#6B7280",
};

export type CreditCardBrand =
   | "visa"
   | "mastercard"
   | "elo"
   | "amex"
   | "hipercard"
   | "other";

const BRAND_LOGO_SLUG: Record<string, string> = {
   visa: "visa",
   mastercard: "mastercard",
   elo: "elo",
   amex: "americanexpress",
   hipercard: "hipercard",
};

const BANK_DOMAIN: Record<string, string> = {
   "001": "bb.com.br",
   "033": "santander.com.br",
   "070": "brb.com.br",
   "077": "bancointer.com.br",
   "104": "caixa.gov.br",
   "208": "btgpactual.com",
   "212": "original.com.br",
   "237": "bradesco.com.br",
   "246": "abcbrasil.com.br",
   "260": "nubank.com.br",
   "290": "pagseguro.com.br",
   "318": "bancobmg.com.br",
   "323": "mercadopago.com.br",
   "336": "bancoc6.com.br",
   "341": "itau.com.br",
   "380": "picpay.com",
   "389": "mercantildobrasil.com.br",
   "422": "safra.com.br",
   "623": "pan.com.br",
   "655": "votorantim.com.br",
   "735": "banconeon.com.br",
   "739": "cetelem.com.br",
   "748": "sicredi.com.br",
   "756": "sicoobnet.com.br",
};

const BANK_COLOR: Record<string, string> = {
   "001": "#FCE300",
   "033": "#E10000",
   "070": "#00529B",
   "077": "#FF7A00",
   "104": "#005CA9",
   "208": "#111827",
   "237": "#CC092F",
   "260": "#820AD1",
   "290": "#00A868",
   "323": "#FFE600",
   "336": "#111827",
   "341": "#EC7000",
   "380": "#11C76F",
   "422": "#0B1F3A",
   "623": "#00AEEF",
   "748": "#00A651",
   "756": "#003641",
};

export function bankDomain(
   bankCode: string | null | undefined,
): string | undefined {
   if (!bankCode) return undefined;
   return BANK_DOMAIN[bankCode.padStart(3, "0")];
}

export function bankColor(
   bankCode: string | null | undefined,
): string | undefined {
   if (!bankCode) return undefined;
   return BANK_COLOR[bankCode.padStart(3, "0")];
}

export function bankLogoUrl(
   bankCode: string | null | undefined,
   logoDevToken?: string,
): string | undefined {
   const domain = bankDomain(bankCode);
   if (!domain) return undefined;
   const token = logoDevToken?.trim();
   if (!token) return bankFaviconUrl(bankCode);
   const params = new URLSearchParams({
      fallback: "monogram",
      format: "webp",
      retina: "true",
      size: "128",
   });
   if (token) params.set("token", token);
   return `https://img.logo.dev/${domain}?${params.toString()}`;
}

export function bankFaviconUrl(
   bankCode: string | null | undefined,
): string | undefined {
   const domain = bankDomain(bankCode);
   if (!domain) return undefined;
   return `https://icons.duckduckgo.com/ip3/${domain}.ico`;
}

export function bankLogoSources(
   bankCode: string | null | undefined,
   logoDevToken?: string,
): string[] {
   const logo = bankLogoUrl(bankCode, logoDevToken);
   const favicon = bankFaviconUrl(bankCode);
   const sources: string[] = [];
   if (logo) sources.push(logo);
   if (favicon && favicon !== logo) sources.push(favicon);
   return sources;
}

export const LOGO_DEV_ATTRIBUTION = {
   url: "https://logo.dev",
   text: "Logos por Logo.dev",
   logoUrl: "https://www.logo.dev/favicon.ico",
} as const;

export function brandLogoUrl(brand: string): string | undefined {
   const slug = BRAND_LOGO_SLUG[brand];
   if (!slug) return undefined;
   return `https://cdn.simpleicons.org/${slug}`;
}

export function creditCardBrandFromPrefix(
   prefix: string,
): CreditCardBrand | undefined {
   if (!/^\d{4}$/.test(prefix)) return undefined;

   const firstTwo = Number(prefix.slice(0, 2));
   const firstFour = Number(prefix);

   if (
      firstFour === 4011 ||
      firstFour === 4312 ||
      firstFour === 4389 ||
      firstFour === 4514 ||
      firstFour === 4576 ||
      firstFour === 5041 ||
      firstFour === 6277 ||
      firstFour === 6362 ||
      firstFour === 6363 ||
      (firstFour >= 5067 && firstFour <= 5090) ||
      (firstFour >= 6504 && firstFour <= 6505)
   ) {
      return "elo";
   }

   if (firstFour === 6062) return "hipercard";
   if (firstTwo === 34 || firstTwo === 37) return "amex";
   if (
      (firstTwo >= 51 && firstTwo <= 55) ||
      (firstFour >= 2221 && firstFour <= 2720)
   ) {
      return "mastercard";
   }
   if (prefix.startsWith("4")) return "visa";

   return undefined;
}

export function bankInitials(name: string): string {
   const parts = name.trim().split(/\s+/).filter(Boolean);
   if (parts.length === 0) return "?";
   const [first, second] = parts;
   if (!first) return "?";
   if (parts.length === 1) return first.slice(0, 2).toUpperCase();
   if (!second) return first.slice(0, 2).toUpperCase();
   return (first[0] + second[0]).toUpperCase();
}
