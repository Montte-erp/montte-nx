import pino from "pino";
import type { Logger, LoggerConfig } from "@core/logging/types";

const isDevelopment = process.env.NODE_ENV !== "production";

export function createLogger(config: LoggerConfig): Logger {
   const { name, level = "info" } = config;

   const targets: pino.TransportTargetOptions[] = [
      isDevelopment
         ? {
              target: "pino-pretty",
              options: {
                 colorize: true,
                 translateTime: "HH:MM:ss",
                 ignore: "pid,hostname",
              },
              level,
           }
         : { target: "pino/file", options: { destination: 1 }, level },
      { target: "pino-opentelemetry-transport", level },
   ];

   return pino({ name, level, transport: { targets } });
}

export function createSafeLogger(config: LoggerConfig): Logger {
   try {
      return createLogger(config);
   } catch {
      return pino({ name: config.name, level: config.level || "info" });
   }
}

export type { Logger, LoggerConfig, LogLevel } from "./types";
export { initLogger, getLogger } from "./root";
export { AppError, WebAppError, propagateError, validateInput } from "./errors";
export { startHealthHeartbeat, stopHealthHeartbeat } from "./health";
export type { HealthConfig } from "./health";
export { initOtel, shutdownOtel } from "./otel";
export type { OtelConfig } from "./otel";
export { FetchLoggingPlugin } from "./orpc-plugin";
