import type { AnyRouter } from "@orpc/server";
import type { AnyHyprPayPlugin, PluginContext } from "../types";
import type { ErrorCodeMap } from "./errors";
import { mergeErrorCodes } from "./errors";
import { mergeSchemas, type MergedSchema } from "./schema-merger";

export interface LoadedPlugins {
   plugins: readonly AnyHyprPayPlugin[];
   schema: MergedSchema;
   routers: Record<string, AnyRouter>;
   errorCodes: Record<string, ErrorCodeMap>;
   ids: string[];
}

export interface LoadPluginsOptions {
   schemaName?: string;
}

export function loadPlugins(
   plugins: readonly AnyHyprPayPlugin[],
   options?: LoadPluginsOptions,
): LoadedPlugins {
   const ids = new Set<string>();
   for (const plugin of plugins) {
      if (ids.has(plugin.id)) {
         throw new Error(
            `[hyprpay] duplicate plugin id "${plugin.id}". Each plugin must have a unique id.`,
         );
      }
      ids.add(plugin.id);
   }

   const schema = mergeSchemas(
      plugins
         .filter((p) => p.schema)
         .map((p) => ({ pluginId: p.id, schema: p.schema! })),
      { schemaName: options?.schemaName },
   );

   const routers: Record<string, AnyRouter> = {};
   for (const plugin of plugins) {
      if (plugin.router) routers[plugin.id] = plugin.router;
   }

   const errorCodes = mergeErrorCodes(
      plugins.map((p) => ({ pluginId: p.id, codes: p.$ERROR_CODES })),
   );

   return {
      plugins,
      schema,
      routers,
      errorCodes,
      ids: Array.from(ids),
   };
}

export async function runInitChain(
   plugins: readonly AnyHyprPayPlugin[],
   baseContext: PluginContext,
): Promise<PluginContext> {
   let ctx = baseContext;
   for (const plugin of plugins) {
      if (!plugin.init) continue;
      const result = await plugin.init(ctx);
      if (result?.context) {
         ctx = mergeContext(ctx, result.context);
      }
   }
   return ctx;
}

function mergeContext(
   base: PluginContext,
   patch: Partial<PluginContext>,
): PluginContext {
   return {
      ...base,
      ...patch,
      gateways: { ...base.gateways, ...(patch.gateways ?? {}) },
   };
}
