import { HyprPayError } from "./errors";

export interface RoutingDecisionContext {
   amount?: number;
   currency?: string;
   capability?: string;
   gatewayId?: string;
   meta?: Record<string, unknown>;
}

export interface RoutingEngine<TGatewayId extends string = string> {
   resolve(ctx: RoutingDecisionContext): TGatewayId;
   candidates(ctx: RoutingDecisionContext): TGatewayId[];
}

export type RoutingStrategy<TGatewayId extends string = string> = (
   available: readonly TGatewayId[],
) => RoutingEngine<TGatewayId>;

export function priority<TGatewayId extends string>(
   order: readonly TGatewayId[],
): RoutingStrategy<TGatewayId> {
   return (available) => {
      const filtered = order.filter((id) => available.includes(id));
      if (filtered.length === 0) {
         throw HyprPayError.internal(
            "ROUTING_NO_CANDIDATES",
            "Nenhum gateway disponível para a estratégia priority.",
         );
      }
      return {
         resolve: () => filtered[0]!,
         candidates: () => [...filtered],
      };
   };
}

export function volumeSplit<TGatewayId extends string>(
   weights: Partial<Record<TGatewayId, number>>,
): RoutingStrategy<TGatewayId> {
   const entries = Object.entries(weights) as Array<[TGatewayId, number]>;
   const total = entries.reduce((sum, [, w]) => sum + w, 0);
   if (total <= 0) {
      throw HyprPayError.internal(
         "ROUTING_INVALID_WEIGHTS",
         "Pesos de volumeSplit devem somar mais que zero.",
      );
   }
   return (available) => {
      const filtered = entries.filter(([id]) => available.includes(id));
      const fallback = filtered[0]?.[0];
      if (!fallback) {
         throw HyprPayError.internal(
            "ROUTING_NO_CANDIDATES",
            "Nenhum gateway disponível para a estratégia volumeSplit.",
         );
      }
      return {
         resolve: () => {
            const r = Math.random() * total;
            let acc = 0;
            for (const [id, w] of filtered) {
               acc += w;
               if (r <= acc) return id;
            }
            return fallback;
         },
         candidates: () => filtered.map(([id]) => id),
      };
   };
}

export type RoutingRule<TGatewayId extends string> =
   | { when: (ctx: RoutingDecisionContext) => boolean; then: TGatewayId }
   | { fallback: TGatewayId };

export function rules<TGatewayId extends string>(
   ruleSet: readonly RoutingRule<TGatewayId>[],
): RoutingStrategy<TGatewayId> {
   return (available) => {
      const fallbackRule = ruleSet.find(
         (r): r is { fallback: TGatewayId } => "fallback" in r,
      );
      if (!fallbackRule || !available.includes(fallbackRule.fallback)) {
         throw HyprPayError.internal(
            "ROUTING_NO_FALLBACK",
            "Estratégia rules requer um fallback disponível.",
         );
      }
      const conditional = ruleSet.filter(
         (
            r,
         ): r is {
            when: (ctx: RoutingDecisionContext) => boolean;
            then: TGatewayId;
         } => "when" in r,
      );
      return {
         resolve: (ctx) => {
            for (const rule of conditional) {
               if (rule.when(ctx) && available.includes(rule.then))
                  return rule.then;
            }
            return fallbackRule.fallback;
         },
         candidates: () => {
            const set = new Set<TGatewayId>([fallbackRule.fallback]);
            for (const r of conditional) {
               if (available.includes(r.then)) set.add(r.then);
            }
            return Array.from(set);
         },
      };
   };
}
