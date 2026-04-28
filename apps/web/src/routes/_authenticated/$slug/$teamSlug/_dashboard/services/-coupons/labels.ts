import {
   CalendarDays,
   Code,
   Globe,
   Infinity as InfinityIcon,
   Percent,
   Repeat,
   TrendingDown,
   TrendingUp,
   Wallet,
   Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type CouponDirection = "discount" | "surcharge";
export type CouponTrigger = "code" | "auto";
export type CouponScope = "team" | "price" | "meter";
export type CouponType = "percent" | "fixed";
export type CouponDuration = "once" | "repeating" | "forever";

export const DIRECTION_LABEL: Record<CouponDirection, string> = {
   discount: "Desconto",
   surcharge: "Acréscimo",
};

export const DIRECTION_ICON: Record<CouponDirection, LucideIcon> = {
   discount: TrendingDown,
   surcharge: TrendingUp,
};

export const TRIGGER_LABEL: Record<CouponTrigger, string> = {
   code: "Código",
   auto: "Automático",
};

export const TRIGGER_ICON: Record<CouponTrigger, LucideIcon> = {
   code: Code,
   auto: Zap,
};

export const SCOPE_LABEL: Record<CouponScope, string> = {
   team: "Equipe",
   price: "Preço",
   meter: "Medidor",
};

export const SCOPE_ICON: Record<CouponScope, LucideIcon> = {
   team: Globe,
   price: Wallet,
   meter: Wallet,
};

export const TYPE_LABEL: Record<CouponType, string> = {
   percent: "Percentual",
   fixed: "Valor fixo",
};

export const TYPE_ICON: Record<CouponType, LucideIcon> = {
   percent: Percent,
   fixed: Wallet,
};

export const DURATION_LABEL: Record<CouponDuration, string> = {
   once: "Uma vez",
   repeating: "Recorrente",
   forever: "Para sempre",
};

export const DURATION_ICON: Record<CouponDuration, LucideIcon> = {
   once: CalendarDays,
   repeating: Repeat,
   forever: InfinityIcon,
};

export const DAY_OF_WEEK_LABEL: Record<number, string> = {
   0: "Dom",
   1: "Seg",
   2: "Ter",
   3: "Qua",
   4: "Qui",
   5: "Sex",
   6: "Sáb",
};

export function buildDirectionOptions() {
   return (Object.keys(DIRECTION_LABEL) as CouponDirection[]).map((k) => ({
      label: DIRECTION_LABEL[k],
      value: k,
   }));
}

export function buildTriggerOptions() {
   return (Object.keys(TRIGGER_LABEL) as CouponTrigger[]).map((k) => ({
      label: TRIGGER_LABEL[k],
      value: k,
   }));
}

export function buildScopeOptions() {
   return (Object.keys(SCOPE_LABEL) as CouponScope[]).map((k) => ({
      label: SCOPE_LABEL[k],
      value: k,
   }));
}

export function buildTypeOptions() {
   return (Object.keys(TYPE_LABEL) as CouponType[]).map((k) => ({
      label: TYPE_LABEL[k],
      value: k,
   }));
}

export function buildDurationOptions() {
   return (Object.keys(DURATION_LABEL) as CouponDuration[]).map((k) => ({
      label: DURATION_LABEL[k],
      value: k,
   }));
}
