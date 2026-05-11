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

export function bankDomain(
   bankCode: string | null | undefined,
): string | undefined {
   if (!bankCode) return undefined;
   return BANK_DOMAIN[bankCode.padStart(3, "0")];
}

const DEFAULT_LOGO_DEV_TOKEN = "pk_P3xoj_JDT9ub1E6jZ_j7fw";

export function bankLogoUrl(
   bankCode: string | null | undefined,
   logoDevToken?: string,
): string | undefined {
   const domain = bankDomain(bankCode);
   if (!domain) return undefined;
   const token = logoDevToken ?? DEFAULT_LOGO_DEV_TOKEN;
   return `https://img.logo.dev/${domain}?token=${token}&size=64&format=webp&retina=true`;
}

export const LOGO_DEV_ATTRIBUTION = {
   url: "https://logo.dev",
   text: "Logos by Logo.dev",
} as const;

export function brandLogoUrl(brand: string): string | undefined {
   const slug = BRAND_LOGO_SLUG[brand];
   if (!slug) return undefined;
   return `https://cdn.simpleicons.org/${slug}`;
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
