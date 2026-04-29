import type { DatabaseAdapter } from "./adapters/database";
import {
   createEventBus,
   type CoreEventMap,
   type EventBus,
} from "./core/event-bus";
import { HyprPayError } from "./core/errors";
import {
   createMemoryIdempotencyStore,
   type IdempotencyStore,
} from "./core/idempotency";
import { loadPlugins, runInitChain } from "./core/plugin-loader";
import {
   buildHandler,
   type FetchHandler,
   type RoutePrefix,
} from "./core/router-builder";
import { type RoutingEngine, type RoutingStrategy } from "./core/routing";
import type { MergedSchema } from "./core/schema-merger";
import type { GetSession } from "./core/session";
import type {
   AnyHyprPayPlugin,
   GatewayRegistry,
   MergeInfer,
   MergeRouters,
   PluginContext,
} from "./types";

export interface HyprPayConfig<
   TPlugins extends readonly AnyHyprPayPlugin[] = readonly AnyHyprPayPlugin[],
> {
   database: DatabaseAdapter;
   getSession: GetSession;
   plugins: TPlugins;
   schemaName?: string;
   prefix?: RoutePrefix;
   routing?: RoutingStrategy;
   idempotency?: IdempotencyStore;
   onEventBusError?: (err: unknown, type: string) => void;
}

export interface HyprPayInstance<
   TPlugins extends readonly AnyHyprPayPlugin[] = readonly AnyHyprPayPlugin[],
> {
   handler: FetchHandler;
   router: MergeRouters<TPlugins>;
   database: DatabaseAdapter;
   schema: MergedSchema;
   events: EventBus<CoreEventMap>;
   $Infer: MergeInfer<TPlugins>;
   $ERROR_CODES: Record<string, Record<string, string>>;
}

export function hyprpay<TPlugins extends readonly AnyHyprPayPlugin[]>(
   config: HyprPayConfig<TPlugins>,
): HyprPayInstance<TPlugins> {
   const loaded = loadPlugins(config.plugins, {
      schemaName: config.schemaName,
   });
   const events = createEventBus<CoreEventMap>({
      onError: config.onEventBusError,
   });
   const idempotency = config.idempotency ?? createMemoryIdempotencyStore();

   const buildContext = async (req: Request): Promise<PluginContext> => {
      const session = await config.getSession(req);
      if (!session) {
         throw HyprPayError.unauthorized(
            "SESSION_REQUIRED",
            "Sessão obrigatória para esta operação.",
         );
      }
      const baseGateways: GatewayRegistry = {};
      const base: PluginContext = {
         db: config.database,
         events,
         routing: placeholderRouting(),
         idempotency,
         gateways: baseGateways,
         session,
         request: req,
         headers: req.headers,
      };
      const ctx = await runInitChain(loaded.plugins, base);
      ctx.routing = buildRouting(config.routing, Object.keys(ctx.gateways));
      return ctx;
   };

   const handler = buildHandler(loaded.routers, {
      prefix: config.prefix,
      buildContext,
   });

   return {
      handler,
      router: loaded.routers as MergeRouters<TPlugins>,
      database: config.database,
      schema: loaded.schema,
      events,
      $Infer: {} as MergeInfer<TPlugins>,
      $ERROR_CODES: loaded.errorCodes,
   };
}

function placeholderRouting(): RoutingEngine<string> {
   const fail = () => {
      throw HyprPayError.internal(
         "ROUTING_NOT_INITIALIZED",
         "Roteamento ainda não inicializado — disponível apenas após init chain.",
      );
   };
   return { resolve: fail, candidates: fail };
}

function buildRouting(
   strategy: RoutingStrategy | undefined,
   available: string[],
): RoutingEngine<string> {
   if (!strategy) {
      const first = available[0];
      if (!first) {
         return {
            resolve: () => {
               throw HyprPayError.internal(
                  "ROUTING_NO_GATEWAYS",
                  "Nenhum gateway instalado para resolver roteamento.",
               );
            },
            candidates: () => [],
         };
      }
      return { resolve: () => first, candidates: () => [...available] };
   }
   return strategy(available);
}

export { HyprPayError } from "./core/errors";
export type { ErrorCategory } from "./core/errors";
export { createEventBus } from "./core/event-bus";
export type {
   CoreEventMap,
   EventBus,
   EventListener,
   EventMap,
} from "./core/event-bus";
export {
   createMemoryIdempotencyStore,
   deriveKey,
   retryKey,
   webhookKey,
} from "./core/idempotency";
export type { IdempotencyRecord, IdempotencyStore } from "./core/idempotency";
export { priority, rules, volumeSplit } from "./core/routing";
export type {
   RoutingDecisionContext,
   RoutingEngine,
   RoutingRule,
   RoutingStrategy,
} from "./core/routing";
export { mergeSchemas } from "./core/schema-merger";
export type {
   FieldSchema,
   FieldType,
   MergedSchema,
   MergeSchemasInput,
   MergeSchemasOptions,
   TableSchema,
} from "./core/schema-merger";
export type { GetSession, Session } from "./core/session";
export type {
   DatabaseAdapter,
   FindManyOptions,
   Where,
} from "./adapters/database";
export type {
   AnyHyprPayPlugin,
   GatewayCapability,
   GatewayRegistry,
   GatewaySubAdapters,
   HyprPayPlugin,
   HyprPayPluginHook,
   InferPluginInfer,
   InferPluginRouter,
   MergeInfer,
   MergeRouters,
   PluginContext,
   PluginInitResult,
   PluginRouter,
} from "./types";
