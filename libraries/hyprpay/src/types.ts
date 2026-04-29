import type { AnyRouter } from "@orpc/server";
import type { DatabaseAdapter } from "./adapters/database";
import type { EventBus, EventMap } from "./core/event-bus";
import type { IdempotencyStore } from "./core/idempotency";
import type { RoutingEngine } from "./core/routing";
import type { TableSchema } from "./core/schema-merger";
import type { Session } from "./core/session";

export type GatewayCapability =
   | "customers"
   | "subscriptions"
   | "charges"
   | "webhooks"
   | "refunds";

export type GatewaySubAdapters = Partial<
   Record<GatewayCapability, Record<string, (...args: never[]) => unknown>>
>;

export type GatewayRegistry = Record<string, GatewaySubAdapters>;

export interface PluginContext<
   TGateways extends GatewayRegistry = GatewayRegistry,
   TEvents extends EventMap = EventMap,
   TSession extends Session = Session,
> {
   db: DatabaseAdapter;
   events: EventBus<TEvents>;
   routing: RoutingEngine<keyof TGateways & string>;
   idempotency: IdempotencyStore;
   gateways: TGateways;
   session: TSession;
   request: Request;
   headers: Headers;
}

export type PluginInitResult<
   TGateways extends GatewayRegistry = GatewayRegistry,
   TEvents extends EventMap = EventMap,
   TSession extends Session = Session,
> = {
   context?: Partial<PluginContext<TGateways, TEvents, TSession>>;
};

export interface HyprPayPluginHook {
   matcher: (path: string) => boolean;
   handler: (ctx: PluginContext) => void | Promise<void>;
}

export type PluginRouter = AnyRouter;

export interface HyprPayPlugin<
   TRouter extends PluginRouter = PluginRouter,
   TInfer extends Record<string, unknown> = Record<string, unknown>,
   TErrorCodes extends Record<string, string> = Record<string, string>,
> {
   id: string;
   schema?: Record<string, TableSchema>;
   router?: TRouter;
   hooks?: {
      before?: HyprPayPluginHook[];
      after?: HyprPayPluginHook[];
   };
   init?: (ctx: PluginContext) => PluginInitResult | Promise<PluginInitResult>;
   $Infer?: TInfer;
   $ERROR_CODES?: TErrorCodes;
}

export type AnyHyprPayPlugin = HyprPayPlugin<PluginRouter>;

export type InferPluginRouter<P> =
   P extends HyprPayPlugin<infer R, infer _I, infer _E> ? R : never;

export type InferPluginInfer<P> =
   P extends HyprPayPlugin<infer _R, infer I, infer _E> ? I : never;

export type MergeRouters<TPlugins extends readonly AnyHyprPayPlugin[]> = {
   [K in TPlugins[number] as K["id"]]: InferPluginRouter<K>;
};

export type MergeInfer<TPlugins extends readonly AnyHyprPayPlugin[]> = {
   [K in TPlugins[number] as K["id"]]: InferPluginInfer<K>;
};
