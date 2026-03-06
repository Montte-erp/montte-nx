import {
	LoggingHandlerPlugin,
	type LoggingHandlerPluginOptions,
} from "@orpc/experimental-pino";
import type { Context } from "@orpc/server";
import type { FetchHandlerOptions, FetchHandlerPlugin } from "@orpc/server/fetch";

/**
 * Extends LoggingHandlerPlugin to satisfy FetchHandlerPlugin interface.
 *
 * LoggingHandlerPlugin implements StandardHandlerPlugin but RPCHandler expects
 * FetchHandlerPlugin (which adds an optional initRuntimeAdapter method).
 * This subclass bridges the gap without type casting.
 */
export class FetchLoggingPlugin<T extends Context>
	extends LoggingHandlerPlugin<T>
	implements FetchHandlerPlugin<T>
{
	constructor(options?: LoggingHandlerPluginOptions<T>) {
		super(options);
	}

	initRuntimeAdapter(_options: FetchHandlerOptions<T>): void {
		// No-op — LoggingHandlerPlugin doesn't need fetch-specific initialization
	}
}
